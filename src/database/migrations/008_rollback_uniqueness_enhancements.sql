-- =====================================================
-- MIGRATION 008: Rollback Uniqueness Enhancements
-- =====================================================
-- This migration safely rolls back the uniqueness enhancements
-- from migration 007. Use with caution in production.
-- =====================================================

-- =====================================================
-- 1. REMOVE SCHEDULED CLEANUP JOB
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-expired-uniqueness-reservations');
  END IF;
END
$$;

-- =====================================================
-- 2. DROP AUTO-PARTITIONING TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_create_partition ON generated_cards;

-- =====================================================
-- 3. DROP AUTO-PARTITIONING FUNCTION
-- =====================================================
DROP FUNCTION IF EXISTS create_monthly_partition_for_generated_cards();

-- =====================================================
-- 4. DROP COMPOSITE INDEXES
-- =====================================================
DROP INDEX CONCURRENTLY IF EXISTS idx_generated_cards_bin_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_generated_cards_user_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_generated_cards_recent;

-- =====================================================
-- 5. DROP ADVISORY LOCK FUNCTIONS
-- =====================================================
DROP FUNCTION IF EXISTS cleanup_expired_reservations();
DROP FUNCTION IF EXISTS release_card_hash(VARCHAR(64));
DROP FUNCTION IF EXISTS reserve_card_hash(VARCHAR(64), VARCHAR(255), INTEGER);

-- =====================================================
-- 6. DROP UNIQUENESS POOL TABLE
-- =====================================================
-- Note: This will delete all reservations. Only do this if you're sure.
-- DROP TABLE IF EXISTS card_uniqueness_pool;

-- =====================================================
-- 7. DROP GLOBAL UNIQUENESS INDEX
-- =====================================================
DROP INDEX CONCURRENTLY IF EXISTS idx_global_card_hash_unique;

-- =====================================================
-- 8. DROP COMPOSITE UNIQUE CONSTRAINT
-- =====================================================
ALTER TABLE generated_cards DROP CONSTRAINT IF EXISTS unique_card_number_expiry_cvv;
DROP INDEX CONCURRENTLY IF EXISTS idx_unique_card_number_expiry_cvv;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
-- Note: The card_uniqueness_pool table is NOT dropped by default
-- to preserve any active reservations. If you need to drop it,
-- uncomment the DROP TABLE statement above.
