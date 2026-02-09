-- Performance Indexes Migration
-- Add indexes for BIN lookups, country searches, and statistics queries

-- Index for BIN lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_bins_bin ON bins(bin);

-- Index for country code searches
CREATE INDEX IF NOT EXISTS idx_bins_country_code ON bins(country_code);

-- Index for card network searches
CREATE INDEX IF NOT EXISTS idx_bins_card_network ON bins(card_network);

-- Index for card type searches
CREATE INDEX IF NOT EXISTS idx_bins_card_type ON bins(card_type);

-- Index for active BINs filter
CREATE INDEX IF NOT EXISTS idx_bins_is_active ON bins(is_active) WHERE is_active = true;

-- Composite index for common search patterns (country + network)
CREATE INDEX IF NOT EXISTS idx_bins_country_network ON bins(country_code, card_network);

-- Composite index for country + type searches
CREATE INDEX IF NOT EXISTS idx_bins_country_type ON bins(country_code, card_type);

-- Index for source-based queries (for provenance tracking)
CREATE INDEX IF NOT EXISTS idx_bins_source ON bins(source);

-- Index for updated_at (for freshness queries)
CREATE INDEX IF NOT EXISTS idx_bins_updated_at ON bins(updated_at DESC);

-- Index for confidence score (for conflict resolution)
CREATE INDEX IF NOT EXISTS idx_bins_confidence_score ON bins(confidence_score DESC) WHERE confidence_score IS NOT NULL;

-- Partial index for active BINs by country and network (common query pattern)
CREATE INDEX IF NOT EXISTS idx_bins_active_country_network ON bins(country_code, card_network) WHERE is_active = true;

-- Index for bank name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_bins_bank_name_lower ON bins(LOWER(bank_name));

-- Index for statistics queries (counts by country)
CREATE INDEX IF NOT EXISTS idx_bins_stats_country ON bins(country_code, is_active);

-- Index for statistics queries (counts by network)
CREATE INDEX IF NOT EXISTS idx_bins_stats_network ON bins(card_network, is_active);

-- Index for statistics queries (counts by type)
CREATE INDEX IF NOT EXISTS idx_bins_stats_type ON bins(card_type, is_active);

-- Analyze tables after creating indexes
ANALYZE bins;
