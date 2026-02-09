-- =====================================================
-- MIGRATION 005: Generated Cards Tables
-- =====================================================
-- This migration creates tables for storing generated cards,
-- statistics, and audit logs for the card generation feature.
-- =====================================================

-- =====================================================
-- GENERATED CARDS TABLE (Partitioned)
-- =====================================================
CREATE TABLE IF NOT EXISTS generated_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Card details (full storage)
  card_number VARCHAR(19) NOT NULL,
  bin VARCHAR(8) NOT NULL,
  expiry_date VARCHAR(5) NOT NULL, -- MM/YY format
  expiry_month VARCHAR(2) NOT NULL,
  expiry_year VARCHAR(2) NOT NULL,
  cvv VARCHAR(4) NOT NULL,
  
  -- BIN metadata (denormalized for performance)
  bank_name VARCHAR(255),
  bank_name_local VARCHAR(255),
  country_code CHAR(2),
  country_name VARCHAR(100),
  card_type VARCHAR(20),
  card_network VARCHAR(50),
  
  -- Generation metadata
  generation_mode VARCHAR(20) NOT NULL, -- 'random', 'sequential', 'batch_999'
  sequence_number BIGINT, -- For sequential generation
  is_sequential BOOLEAN DEFAULT FALSE,
  
  -- Request context
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  request_id VARCHAR(255), -- For tracing
  
  -- Deduplication
  card_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of card_number+expiry+cvv
  UNIQUE(card_hash),
  
  -- Timestamps
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Partitioning key (for high scale)
  generation_date DATE NOT NULL DEFAULT CURRENT_DATE
) PARTITION BY RANGE (generation_date);

-- Create default partition for current month
CREATE TABLE IF NOT EXISTS generated_cards_default PARTITION OF generated_cards
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_cards_bin ON generated_cards(bin);
CREATE INDEX IF NOT EXISTS idx_generated_cards_user_id ON generated_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_cards_generation_date ON generated_cards(generation_date);
CREATE INDEX IF NOT EXISTS idx_generated_cards_card_hash ON generated_cards(card_hash);
CREATE INDEX IF NOT EXISTS idx_generated_cards_generation_mode ON generated_cards(generation_mode);
CREATE INDEX IF NOT EXISTS idx_generated_cards_api_key_id ON generated_cards(api_key_id);
CREATE INDEX IF NOT EXISTS idx_generated_cards_request_id ON generated_cards(request_id);
CREATE INDEX IF NOT EXISTS idx_generated_cards_country_code ON generated_cards(country_code);
CREATE INDEX IF NOT EXISTS idx_generated_cards_card_type ON generated_cards(card_type);
CREATE INDEX IF NOT EXISTS idx_generated_cards_card_network ON generated_cards(card_network);

-- =====================================================
-- CARD GENERATION STATISTICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS card_generation_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  
  -- Counts
  total_generated BIGINT DEFAULT 0,
  total_unique BIGINT DEFAULT 0,
  total_duplicates BIGINT DEFAULT 0,
  
  -- By generation mode
  random_count BIGINT DEFAULT 0,
  sequential_count BIGINT DEFAULT 0,
  batch_999_count BIGINT DEFAULT 0,
  
  -- By BIN
  bins_used INTEGER DEFAULT 0,
  top_bins JSONB, -- {bin: count}
  
  -- By country
  countries_used INTEGER DEFAULT 0,
  top_countries JSONB, -- {country_code: count}
  
  -- By user
  users_active INTEGER DEFAULT 0,
  top_users JSONB, -- {user_id: count}
  
  -- Performance metrics
  avg_generation_time_ms DECIMAL(10,2),
  p95_generation_time_ms DECIMAL(10,2),
  p99_generation_time_ms DECIMAL(10,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_card_statistics_date ON card_generation_statistics(date DESC);

-- =====================================================
-- CARD GENERATION AUDIT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS card_generation_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Request details
  endpoint VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_body JSONB,
  request_params JSONB,
  
  -- Response details
  cards_generated INTEGER NOT NULL,
  generation_mode VARCHAR(20),
  bin_used VARCHAR(8),
  
  -- Performance
  response_time_ms INTEGER,
  status_code INTEGER,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_audit_user_id ON card_generation_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_created_at ON card_generation_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_audit_bin ON card_generation_audit(bin_used);
CREATE INDEX IF NOT EXISTS idx_card_audit_api_key_id ON card_generation_audit(api_key_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_request_id ON card_generation_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_generation_mode ON card_generation_audit(generation_mode);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated at trigger for statistics table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_card_statistics_updated_at') THEN
    CREATE TRIGGER update_card_statistics_updated_at
      BEFORE UPDATE ON card_generation_statistics
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE generated_cards IS 'Stores all generated card numbers with full metadata and deduplication support';
COMMENT ON COLUMN generated_cards.card_hash IS 'SHA-256 hash of card_number+expiry_date+cvv for deduplication';
COMMENT ON COLUMN generated_cards.generation_mode IS 'Mode used: random, sequential, or batch_999';
COMMENT ON COLUMN generated_cards.generation_date IS 'Date partition key for scalability';
COMMENT ON TABLE card_generation_statistics IS 'Daily aggregated statistics for card generation';
COMMENT ON TABLE card_generation_audit IS 'Audit trail for all card generation API requests';
