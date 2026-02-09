-- =====================================================
-- MASTER DATABASE SCHEMA FOR PAYMENT SANDBOX API
-- =====================================================
-- This schema consolidates all required fields from:
-- - src/database/connection.ts
-- - src/database/migrate.ts  
-- - src/database/migrations/001_initial_schema.sql
-- - ETL pipeline requirements
-- - Model queries
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  tier VARCHAR(20) DEFAULT 'free',
  quota_limit INTEGER DEFAULT 100,
  quota_used INTEGER DEFAULT 0,
  email_verified BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(255),
  -- 2FA backup codes for recovery
  backup_codes JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Ensure newer columns exist when upgrading an existing schema.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS backup_codes JSONB DEFAULT '[]';

-- =====================================================
-- COUNTRIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS countries (
  country_code CHAR(2) PRIMARY KEY,
  country_name VARCHAR(100) NOT NULL,
  continent VARCHAR(50) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  currency_name VARCHAR(50) NOT NULL,
  iban_length INTEGER NOT NULL,
  bank_code_length INTEGER NOT NULL,
  account_number_length INTEGER NOT NULL,
  example_iban VARCHAR(50) NOT NULL,
  iban_regex VARCHAR(500) NOT NULL,
  is_sepa BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- BINS TABLE - CONSOLIDATED WITH ETL FIELDS
-- =====================================================
CREATE TABLE IF NOT EXISTS bins (
  -- Primary key
  bin VARCHAR(8) PRIMARY KEY,
  
  -- Core BIN fields (from original schemas)
  bank_name VARCHAR(255) NOT NULL,
  bank_name_local VARCHAR(255),
  country_code CHAR(2) NOT NULL REFERENCES countries(country_code),
  country_name VARCHAR(100) NOT NULL,
  card_type VARCHAR(20) NOT NULL,
  card_network VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  bank_code VARCHAR(50),
  branch_code VARCHAR(50),
  program_type VARCHAR(50),
  regulatory_type VARCHAR(50),
  bin_range_start VARCHAR(8),
  bin_range_end VARCHAR(8),
  
  -- Additional fields for ETL pipeline
  length INTEGER,
  luhn BOOLEAN DEFAULT TRUE,
  scheme VARCHAR(50),
  brand VARCHAR(100),
  issuer VARCHAR(255),
  country VARCHAR(100), -- Full country name from source
  
  -- Location/contact fields
  url VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(100),
  
  -- ETL provenance fields
  source VARCHAR(100) NOT NULL,
  source_version VARCHAR(100),
  import_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE,
  raw JSONB, -- Original raw data from source for audit
  
  -- Quality/audit fields
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- API KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_id UUID UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  permissions JSONB DEFAULT '{}',
  rate_limit INTEGER DEFAULT 100,
  ip_whitelist JSONB DEFAULT '[]',
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method VARCHAR(10),
  status_code INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- USAGE LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL,
  query_params JSONB,
  response_time INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CARD GATEWAYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS card_gateways (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  docs_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TEST CARDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS test_cards (
  id SERIAL PRIMARY KEY,
  gateway_id INTEGER REFERENCES card_gateways(id) ON DELETE CASCADE,
  brand VARCHAR(50) NOT NULL,
  pan VARCHAR(19) NOT NULL,
  cvc VARCHAR(4),
  expiry_hint VARCHAR(50),
  expected_result VARCHAR(100),
  test_scenario VARCHAR(100),
  notes TEXT,
  source_link TEXT,
  is_3ds_enrolled BOOLEAN DEFAULT false,
  card_type VARCHAR(20) DEFAULT 'credit',
  region VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gateway_id, pan)
);

-- =====================================================
-- PASSWORD RESETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- Hashed token for security
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ETL RUNS TABLE - FOR TRACKING IMPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS etl_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(100) NOT NULL,
  source_version VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

-- Countries indexes
CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);

-- BINS indexes - optimized for queries
CREATE INDEX IF NOT EXISTS idx_bins_country ON bins(country_code);
CREATE INDEX IF NOT EXISTS idx_bins_type ON bins(card_type);
CREATE INDEX IF NOT EXISTS idx_bins_network ON bins(card_network);
CREATE INDEX IF NOT EXISTS idx_bins_active ON bins(is_active);
CREATE INDEX IF NOT EXISTS idx_bins_source ON bins(source);
CREATE INDEX IF NOT EXISTS idx_bins_import_date ON bins(import_date);
CREATE INDEX IF NOT EXISTS idx_bins_scheme ON bins(scheme);
CREATE INDEX IF NOT EXISTS idx_bins_brand ON bins(brand);
CREATE INDEX IF NOT EXISTS idx_bins_issuer ON bins(issuer);
CREATE INDEX IF NOT EXISTS idx_bins_bank_name ON bins(bank_name);

-- API Keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Usage logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);

-- Test cards indexes
CREATE INDEX IF NOT EXISTS idx_test_cards_gateway_id ON test_cards(gateway_id);
CREATE INDEX IF NOT EXISTS idx_test_cards_brand ON test_cards(brand);
CREATE INDEX IF NOT EXISTS idx_test_cards_expected_result ON test_cards(expected_result);
CREATE INDEX IF NOT EXISTS idx_test_cards_is_3ds_enrolled ON test_cards(is_3ds_enrolled);
CREATE INDEX IF NOT EXISTS idx_test_cards_card_type ON test_cards(card_type);

-- Card gateways indexes
CREATE INDEX IF NOT EXISTS idx_card_gateways_slug ON card_gateways(slug);
CREATE INDEX IF NOT EXISTS idx_card_gateways_is_active ON card_gateways(is_active);

-- Password resets indexes
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

-- ETL runs indexes
CREATE INDEX IF NOT EXISTS idx_etl_runs_source ON etl_runs(source);
CREATE INDEX IF NOT EXISTS idx_etl_runs_started ON etl_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_etl_runs_status ON etl_runs(status);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_countries_updated_at') THEN
    CREATE TRIGGER update_countries_updated_at
      BEFORE UPDATE ON countries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bins_updated_at') THEN
    CREATE TRIGGER update_bins_updated_at
      BEFORE UPDATE ON bins
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_api_keys_updated_at') THEN
    CREATE TRIGGER update_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_card_gateways_updated_at') THEN
    CREATE TRIGGER update_card_gateways_updated_at
      BEFORE UPDATE ON card_gateways
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_test_cards_updated_at') THEN
    CREATE TRIGGER update_test_cards_updated_at
      BEFORE UPDATE ON test_cards
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE bins IS 'BIN (Bank Identification Number) database with full provenance metadata and ETL support';
COMMENT ON COLUMN bins.source IS 'Source repository name (e.g., binlist/data)';
COMMENT ON COLUMN bins.source_version IS 'Commit SHA or tag from source repository';
COMMENT ON COLUMN bins.import_date IS 'Timestamp when record was imported';
COMMENT ON COLUMN bins.raw IS 'Original raw data from source for audit purposes';
COMMENT ON COLUMN bins.confidence_score IS 'Confidence score for data quality (0.0-1.0)';
COMMENT ON TABLE etl_runs IS 'Audit table for tracking ETL run history';
COMMENT ON TABLE password_resets IS 'Secure password reset tokens (hashed for security)';
COMMENT ON COLUMN password_resets.token_hash IS 'Hashed reset token - never store plaintext';
COMMENT ON COLUMN users.backup_codes IS 'Encrypted backup codes for 2FA recovery';

-- =====================================================
-- SECURITY POLICIES (for future implementation)
-- =====================================================

-- Add RLS (Row Level Security) policies in production
-- This is commented out for development but should be enabled in prod
/*
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
*/
