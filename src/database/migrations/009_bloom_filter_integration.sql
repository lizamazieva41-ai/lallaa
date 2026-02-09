-- =====================================================
-- MIGRATION 009: Bloom Filter Integration
-- =====================================================
-- This migration installs and configures pg_bloom extension
-- for fast pre-filtering of duplicate card hashes.
-- =====================================================

-- =====================================================
-- 1. INSTALL PG_BLOOM EXTENSION
-- =====================================================
-- Note: pg_bloom extension must be installed on the PostgreSQL server
-- If not available, this will fail gracefully
DO $$
BEGIN
  -- Check if pg_bloom extension exists
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions 
    WHERE name = 'bloom'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS bloom;
    RAISE NOTICE 'pg_bloom extension installed successfully';
  ELSE
    RAISE WARNING 'pg_bloom extension not available. Please install it manually.';
  END IF;
END
$$;

-- =====================================================
-- 2. CREATE BLOOM FILTER TABLE STRUCTURE
-- =====================================================
-- Create a table to store bloom filter metadata
CREATE TABLE IF NOT EXISTS card_hash_bloom_filter (
  id SERIAL PRIMARY KEY,
  filter_name VARCHAR(100) UNIQUE NOT NULL DEFAULT 'card_hash_filter',
  capacity BIGINT NOT NULL DEFAULT 100000000, -- 100M cards
  error_rate DECIMAL(10,9) NOT NULL DEFAULT 0.001, -- 0.1% false positive rate
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  total_hashes BIGINT DEFAULT 0
);

COMMENT ON TABLE card_hash_bloom_filter IS 
'Metadata table for bloom filter tracking card hash uniqueness';
COMMENT ON COLUMN card_hash_bloom_filter.capacity IS 
'Maximum number of card hashes the bloom filter can hold';
COMMENT ON COLUMN card_hash_bloom_filter.error_rate IS 
'False positive rate (0.001 = 0.1%)';
COMMENT ON COLUMN card_hash_bloom_filter.total_hashes IS 
'Total number of hashes currently in the bloom filter';

-- =====================================================
-- 3. CREATE BLOOM FILTER INDEX
-- =====================================================
-- Create bloom filter index on card_hash column
-- This will be used for fast duplicate detection
DO $$
BEGIN
  -- Check if pg_bloom is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'bloom'
  ) THEN
    -- Create bloom filter index on generated_cards.card_hash
    -- Note: Bloom indexes are created on the actual table, not a separate structure
    -- We'll use a materialized approach with a separate table for the bloom filter
    
    -- Create a materialized bloom filter table
    CREATE TABLE IF NOT EXISTS card_hash_bloom_data (
      card_hash_prefix CHAR(8) PRIMARY KEY, -- First 8 chars of hash for indexing
      hash_count INTEGER DEFAULT 1,
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create GIN index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_card_hash_bloom_gin 
    ON card_hash_bloom_data USING gin(card_hash_prefix gin_trgm_ops);
    
    RAISE NOTICE 'Bloom filter data table created successfully';
  ELSE
    RAISE WARNING 'pg_bloom extension not available. Bloom filter features will be limited.';
  END IF;
END
$$;

-- =====================================================
-- 4. BLOOM FILTER MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to add card hash to bloom filter
CREATE OR REPLACE FUNCTION add_card_hash_to_bloom(p_card_hash VARCHAR(64))
RETURNS BOOLEAN AS $$
DECLARE
  v_prefix CHAR(8);
BEGIN
  -- Use first 8 characters as prefix for bloom filter
  v_prefix := LEFT(p_card_hash, 8);
  
  -- Insert or update bloom filter data
  INSERT INTO card_hash_bloom_data (card_hash_prefix, hash_count, last_updated)
  VALUES (v_prefix, 1, CURRENT_TIMESTAMP)
  ON CONFLICT (card_hash_prefix) DO UPDATE
  SET hash_count = card_hash_bloom_data.hash_count + 1,
      last_updated = CURRENT_TIMESTAMP;
  
  -- Update metadata
  UPDATE card_hash_bloom_filter
  SET total_hashes = total_hashes + 1,
      updated_at = CURRENT_TIMESTAMP,
      last_sync_at = CURRENT_TIMESTAMP
  WHERE filter_name = 'card_hash_filter';
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_card_hash_to_bloom IS 
'Adds a card hash to the bloom filter for fast duplicate detection';

-- Function to check if hash exists in bloom filter
CREATE OR REPLACE FUNCTION check_card_hash_in_bloom(p_card_hash VARCHAR(64))
RETURNS BOOLEAN AS $$
DECLARE
  v_prefix CHAR(8);
  v_exists BOOLEAN;
BEGIN
  -- Use first 8 characters as prefix
  v_prefix := LEFT(p_card_hash, 8);
  
  -- Check if prefix exists in bloom filter
  SELECT EXISTS(
    SELECT 1 FROM card_hash_bloom_data 
    WHERE card_hash_prefix = v_prefix
  ) INTO v_exists;
  
  -- If prefix exists, it MIGHT be a duplicate (bloom filter can have false positives)
  -- Return true if prefix exists (potential duplicate)
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_card_hash_in_bloom IS 
'Checks if a card hash prefix exists in bloom filter. Returns TRUE if potential duplicate (may be false positive), FALSE if definitely not in filter.';

-- Function to sync bloom filter from database
CREATE OR REPLACE FUNCTION sync_bloom_filter_from_database()
RETURNS TABLE(hashes_added BIGINT, sync_duration_ms INTEGER) AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_hashes_added BIGINT;
  v_sync_duration INTEGER;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Insert all unique card_hash prefixes from generated_cards
  INSERT INTO card_hash_bloom_data (card_hash_prefix, hash_count, last_updated)
  SELECT 
    LEFT(card_hash, 8) as card_hash_prefix,
    COUNT(*) as hash_count,
    MAX(created_at) as last_updated
  FROM generated_cards
  WHERE LEFT(card_hash, 8) NOT IN (
    SELECT card_hash_prefix FROM card_hash_bloom_data
  )
  GROUP BY LEFT(card_hash, 8)
  ON CONFLICT (card_hash_prefix) DO UPDATE
  SET hash_count = EXCLUDED.hash_count,
      last_updated = EXCLUDED.last_updated;
  
  GET DIAGNOSTICS v_hashes_added = ROW_COUNT;
  
  -- Update metadata
  UPDATE card_hash_bloom_filter
  SET total_hashes = (SELECT COUNT(*) FROM card_hash_bloom_data),
      updated_at = CURRENT_TIMESTAMP,
      last_sync_at = CURRENT_TIMESTAMP
  WHERE filter_name = 'card_hash_filter';
  
  v_end_time := clock_timestamp();
  v_sync_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
  
  RETURN QUERY SELECT v_hashes_added, v_sync_duration::INTEGER;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_bloom_filter_from_database IS 
'Syncs bloom filter with all card hashes from generated_cards table. Returns number of hashes added and sync duration.';

-- Initialize bloom filter metadata
INSERT INTO card_hash_bloom_filter (filter_name, capacity, error_rate)
VALUES ('card_hash_filter', 100000000, 0.001)
ON CONFLICT (filter_name) DO NOTHING;

-- =====================================================
-- 5. AUTOMATIC BLOOM FILTER UPDATES
-- =====================================================
-- Trigger to automatically add new card hashes to bloom filter
CREATE OR REPLACE FUNCTION auto_update_bloom_filter()
RETURNS TRIGGER AS $$
BEGIN
  -- Add new card hash to bloom filter
  PERFORM add_card_hash_to_bloom(NEW.card_hash);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_update_bloom_filter IS 
'Automatically adds new card hashes to bloom filter when cards are inserted';

-- Create trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_update_bloom_filter'
  ) THEN
    CREATE TRIGGER trigger_auto_update_bloom_filter
    AFTER INSERT ON generated_cards
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_bloom_filter();
  END IF;
END
$$;

-- =====================================================
-- 6. PERIODIC SYNC JOB (using pg_cron if available)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule sync job to run every hour
    PERFORM cron.schedule(
      'sync-bloom-filter',
      '0 * * * *', -- Every hour
      $$SELECT sync_bloom_filter_from_database()$$
    );
  END IF;
END
$$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE card_hash_bloom_data IS 
'Bloom filter data table storing card hash prefixes for fast duplicate detection';

COMMENT ON FUNCTION add_card_hash_to_bloom IS 
'Adds a card hash to the bloom filter';

COMMENT ON FUNCTION check_card_hash_in_bloom IS 
'Checks if a card hash might exist in the bloom filter (may have false positives)';

COMMENT ON FUNCTION sync_bloom_filter_from_database IS 
'Syncs bloom filter with all existing card hashes from the database';
