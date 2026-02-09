-- =====================================================
-- MIGRATION 007: Enhance Uniqueness Guarantee
-- =====================================================
-- This migration implements multi-layer uniqueness architecture:
-- 1. Composite unique constraint (card_number + expiry_date + cvv)
-- 2. Global uniqueness index across all partitions
-- 3. Pre-generation uniqueness pool with distributed locks
-- 4. Advisory lock functions for concurrent generation prevention
-- =====================================================

-- =====================================================
-- 1. COMPOSITE UNIQUE CONSTRAINT
-- =====================================================
-- Add composite unique constraint on (card_number, expiry_date, cvv)
-- This ensures no duplicate card combinations can exist
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_card_number_expiry_cvv'
  ) THEN
    -- Add unique constraint using concurrent index creation
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unique_card_number_expiry_cvv
    ON generated_cards(card_number, expiry_date, cvv);
    
    -- Add constraint using the index
    ALTER TABLE generated_cards
    ADD CONSTRAINT unique_card_number_expiry_cvv
    UNIQUE USING INDEX idx_unique_card_number_expiry_cvv;
    
    COMMENT ON CONSTRAINT unique_card_number_expiry_cvv ON generated_cards IS 
    'Ensures no duplicate card combinations (card_number + expiry_date + cvv)';
  END IF;
END
$$;

-- =====================================================
-- 2. GLOBAL UNIQUENESS INDEX ACROSS ALL PARTITIONS
-- =====================================================
-- Create a global index that spans all partitions for fast uniqueness checks
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_global_card_hash_unique
ON generated_cards(card_hash);

COMMENT ON INDEX idx_global_card_hash_unique IS 
'Global uniqueness index across all partitions for card_hash';

-- =====================================================
-- 3. CARD UNIQUENESS POOL TABLE
-- =====================================================
-- Table for pre-generation reservations to prevent race conditions
CREATE TABLE IF NOT EXISTS card_uniqueness_pool (
  card_hash VARCHAR(64) PRIMARY KEY,
  reserved_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reserved_by VARCHAR(255) NOT NULL, -- Process ID or worker ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Index for cleanup queries
  CONSTRAINT chk_reserved_until_future CHECK (reserved_until > created_at)
);

-- Index for cleanup queries (expired reservations)
CREATE INDEX IF NOT EXISTS idx_uniqueness_pool_reserved_until 
ON card_uniqueness_pool(reserved_until);

-- Index for reserved_by lookups
CREATE INDEX IF NOT EXISTS idx_uniqueness_pool_reserved_by 
ON card_uniqueness_pool(reserved_by);

COMMENT ON TABLE card_uniqueness_pool IS 
'Pre-generation uniqueness pool for reserving card hashes before generation to prevent race conditions';
COMMENT ON COLUMN card_uniqueness_pool.card_hash IS 
'SHA-256 hash of card_number+expiry_date+cvv';
COMMENT ON COLUMN card_uniqueness_pool.reserved_until IS 
'Timestamp when reservation expires (TTL-based cleanup)';
COMMENT ON COLUMN card_uniqueness_pool.reserved_by IS 
'Identifier of the process/worker that reserved this hash';

-- =====================================================
-- 4. ADVISORY LOCK FUNCTIONS
-- =====================================================

-- Function to reserve a card hash with advisory lock
CREATE OR REPLACE FUNCTION reserve_card_hash(
  p_card_hash VARCHAR(64),
  p_reserved_by VARCHAR(255),
  p_ttl_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_lock_id BIGINT;
  v_reserved_until TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Convert card_hash to lock ID (using hash)
  v_lock_id := ('x' || substr(md5(p_card_hash), 1, 16))::bit(64)::bigint;
  
  -- Calculate reservation expiry
  v_reserved_until := CURRENT_TIMESTAMP + (p_ttl_seconds || ' seconds')::INTERVAL;
  
  -- Try to acquire advisory lock (non-blocking)
  IF pg_try_advisory_lock(v_lock_id) THEN
    -- Check if hash already exists in pool or generated_cards
    IF EXISTS (
      SELECT 1 FROM card_uniqueness_pool 
      WHERE card_hash = p_card_hash 
      AND reserved_until > CURRENT_TIMESTAMP
    ) OR EXISTS (
      SELECT 1 FROM generated_cards 
      WHERE card_hash = p_card_hash
    ) THEN
      -- Release lock if already exists
      PERFORM pg_advisory_unlock(v_lock_id);
      RETURN FALSE;
    END IF;
    
    -- Insert reservation
    INSERT INTO card_uniqueness_pool (card_hash, reserved_until, reserved_by)
    VALUES (p_card_hash, v_reserved_until, p_reserved_by)
    ON CONFLICT (card_hash) DO UPDATE
    SET reserved_until = v_reserved_until,
        reserved_by = p_reserved_by,
        created_at = CURRENT_TIMESTAMP;
    
    -- Keep lock until explicitly released
    RETURN TRUE;
  ELSE
    -- Lock already held by another process
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_card_hash IS 
'Reserves a card hash with advisory lock to prevent concurrent generation. Returns TRUE if reservation successful, FALSE otherwise.';

-- Function to release a card hash reservation
CREATE OR REPLACE FUNCTION release_card_hash(
  p_card_hash VARCHAR(64)
) RETURNS BOOLEAN AS $$
DECLARE
  v_lock_id BIGINT;
BEGIN
  -- Convert card_hash to lock ID
  v_lock_id := ('x' || substr(md5(p_card_hash), 1, 16))::bit(64)::bigint;
  
  -- Remove from pool
  DELETE FROM card_uniqueness_pool 
  WHERE card_hash = p_card_hash;
  
  -- Release advisory lock
  PERFORM pg_advisory_unlock(v_lock_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_card_hash IS 
'Releases a card hash reservation and advisory lock.';

-- Function to cleanup expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations() 
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired reservations
  DELETE FROM card_uniqueness_pool
  WHERE reserved_until < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_reservations IS 
'Removes expired reservations from uniqueness pool. Returns count of deleted rows.';

-- =====================================================
-- 5. COMPOSITE INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index on (bin, generation_date DESC) for BIN-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_cards_bin_date 
ON generated_cards(bin, generation_date DESC);

-- Composite index on (user_id, generation_date DESC) for user-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_cards_user_date 
ON generated_cards(user_id, generation_date DESC)
WHERE user_id IS NOT NULL;

-- Partial index on recent cards (last 30 days) for faster recent queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_cards_recent 
ON generated_cards(generation_date DESC, created_at DESC)
WHERE generation_date >= CURRENT_DATE - INTERVAL '30 days';

COMMENT ON INDEX idx_generated_cards_bin_date IS 
'Composite index for BIN-based queries with date sorting';
COMMENT ON INDEX idx_generated_cards_user_date IS 
'Composite index for user-based queries with date sorting';
COMMENT ON INDEX idx_generated_cards_recent IS 
'Partial index on recent cards (last 30 days) for performance';

-- =====================================================
-- 6. AUTO-PARTITIONING TRIGGER
-- =====================================================

-- Function to auto-create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition_for_generated_cards()
RETURNS TRIGGER AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Calculate partition boundaries (first day of month to first day of next month)
  v_start_date := DATE_TRUNC('month', NEW.generation_date);
  v_end_date := v_start_date + INTERVAL '1 month';
  v_partition_name := 'generated_cards_' || TO_CHAR(v_start_date, 'YYYY_MM');
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = v_partition_name
  ) THEN
    -- Create partition
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF generated_cards FOR VALUES FROM (%L) TO (%L)',
      v_partition_name,
      v_start_date,
      v_end_date
    );
    
    -- Create indexes on new partition
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(bin)', 
      v_partition_name || '_bin_idx', v_partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(user_id)', 
      v_partition_name || '_user_idx', v_partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(card_hash)', 
      v_partition_name || '_hash_idx', v_partition_name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_monthly_partition_for_generated_cards IS 
'Auto-creates monthly partitions for generated_cards table when new data is inserted.';

-- Create trigger for auto-partitioning (BEFORE INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_create_partition'
  ) THEN
    CREATE TRIGGER trigger_auto_create_partition
    BEFORE INSERT ON generated_cards
    FOR EACH ROW
    EXECUTE FUNCTION create_monthly_partition_for_generated_cards();
  END IF;
END
$$;

-- =====================================================
-- 7. SCHEDULED CLEANUP JOB (using pg_cron if available)
-- =====================================================
-- Note: This requires pg_cron extension to be installed
-- If pg_cron is not available, cleanup should be done via external cron job

DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule cleanup job to run every hour
    PERFORM cron.schedule(
      'cleanup-expired-uniqueness-reservations',
      '0 * * * *', -- Every hour
      $$SELECT cleanup_expired_reservations()$$
    );
  END IF;
END
$$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE card_uniqueness_pool IS 
'Pre-generation uniqueness pool for reserving card hashes before generation to prevent race conditions in concurrent environments';

COMMENT ON INDEX idx_global_card_hash_unique IS 
'Global uniqueness index across all partitions ensuring card_hash uniqueness';

COMMENT ON CONSTRAINT unique_card_number_expiry_cvv ON generated_cards IS 
'Composite unique constraint ensuring no duplicate card combinations';
