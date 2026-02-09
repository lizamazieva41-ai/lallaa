-- Migration: Initial Schema for BIN Check API
-- Created: 2026-01-21

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Countries table
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

-- BINs table with full provenance metadata
CREATE TABLE IF NOT EXISTS bins (
  bin VARCHAR(8) PRIMARY KEY,
  length INTEGER,
  luhn BOOLEAN DEFAULT TRUE,
  scheme VARCHAR(50),
  brand VARCHAR(100),
  type VARCHAR(20),
  issuer VARCHAR(255),
  country VARCHAR(100),
  country_code CHAR(2),
  bank_code VARCHAR(50),
  branch_code VARCHAR(50),
  program_type VARCHAR(50),
  regulatory_type VARCHAR(50),
  bin_range_start VARCHAR(8),
  bin_range_end VARCHAR(8),
  url VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(100),
  -- Provenance fields
  source VARCHAR(100) NOT NULL,
  source_version VARCHAR(100),
  import_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE,
  -- Audit field
  raw JSONB,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Usage logs table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ETL audit table for tracking imports
CREATE TABLE IF NOT EXISTS etl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_bins_country ON bins(country_code);
CREATE INDEX IF NOT EXISTS idx_bins_type ON bins(type);
CREATE INDEX IF NOT EXISTS idx_bins_scheme ON bins(scheme);
CREATE INDEX IF NOT EXISTS idx_bins_brand ON bins(brand);
CREATE INDEX IF NOT EXISTS idx_bins_source ON bins(source);
CREATE INDEX IF NOT EXISTS idx_bins_import_date ON bins(import_date);
CREATE INDEX IF NOT EXISTS idx_bins_active ON bins(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_etl_runs_source ON etl_runs(source);
CREATE INDEX IF NOT EXISTS idx_etl_runs_started ON etl_runs(started_at DESC);

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
END
$$;

-- Comments for documentation
COMMENT ON TABLE bins IS 'BIN (Bank Identification Number) database with full provenance metadata';
COMMENT ON COLUMN bins.source IS 'Source repository name (e.g., binlist/data)';
COMMENT ON COLUMN bins.source_version IS 'Commit SHA or tag from source repository';
COMMENT ON COLUMN bins.import_date IS 'Timestamp when record was imported';
COMMENT ON COLUMN bins.raw IS 'Original raw data from source for audit purposes';
COMMENT ON TABLE etl_runs IS 'Audit table for tracking ETL run history';
