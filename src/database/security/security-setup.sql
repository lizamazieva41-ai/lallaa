-- =====================================================
-- ADDITIONAL TABLES FOR PRODUCTION SECURITY
-- =====================================================

-- Create missing tables first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
-- INDEXES FOR NEW TABLES
-- =====================================================

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Usage logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);

-- Password resets indexes
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

-- =====================================================
-- SECURITY SCHEMA
-- =====================================================
CREATE SCHEMA IF NOT EXISTS security;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Create roles with appropriate permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_user') THEN
        CREATE ROLE authenticated_user;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_account') THEN
        CREATE ROLE service_account;
    END IF;
END
$$;

-- Grant permissions to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated_user;
GRANT SELECT ON audit_logs TO authenticated_user;
GRANT SELECT ON usage_logs TO authenticated_user;
GRANT SELECT, INSERT, DELETE ON password_resets TO authenticated_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_account;

-- USERS TABLE RLS POLICIES
CREATE POLICY user_isolation_policy ON users
    FOR ALL
    TO authenticated_user
    USING (
        id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY user_service_policy ON users
    FOR SELECT
    TO service_account
    USING (true);

-- API KEYS TABLE RLS POLICIES
CREATE POLICY api_key_isolation_policy ON api_keys
    FOR ALL
    TO authenticated_user
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY api_key_service_policy ON api_keys
    FOR ALL
    TO service_account
    USING (true);

-- AUDIT LOGS TABLE RLS POLICIES
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    TO authenticated_user
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY audit_logs_service_policy ON audit_logs
    FOR INSERT
    TO service_account
    WITH CHECK (true);

-- USAGE LOGS TABLE RLS POLICIES
CREATE POLICY usage_logs_isolation_policy ON usage_logs
    FOR ALL
    TO authenticated_user
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY usage_logs_service_policy ON usage_logs
    FOR INSERT
    TO service_account
    WITH CHECK (true);

-- PASSWORD RESETS TABLE RLS POLICIES
CREATE POLICY password_resets_isolation_policy ON password_resets
    FOR ALL
    TO authenticated_user
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY password_resets_service_policy ON password_resets
    FOR ALL
    TO service_account
    USING (true);

-- =====================================================
-- SECURITY FUNCTIONS
-- =====================================================

-- Function to set user context for RLS
CREATE OR REPLACE FUNCTION set_rls_context(user_id UUID, user_role VARCHAR DEFAULT 'user')
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, true);
    PERFORM set_config('app.current_user_role', user_role, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear RLS context
CREATE OR REPLACE FUNCTION clear_rls_context()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', true);
    PERFORM set_config('app.current_user_role', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user can access resource
CREATE OR REPLACE FUNCTION can_access_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN 
        current_setting('app.current_user_id', true)::uuid = target_user_id
        OR current_setting('app.current_user_role', true) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECURITY MONITORING VIEWS
-- =====================================================

-- View to monitor RLS policy effectiveness
CREATE OR REPLACE VIEW security.rls_policy_audit AS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- View to monitor user access patterns (simplified)
CREATE OR REPLACE VIEW security.user_access_audit AS
SELECT 
    current_setting('app.current_user_id', true) as user_id,
    current_setting('app.current_user_role', true) as user_role,
    'active' as state
LIMIT 1;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA security IS 'Security monitoring and testing functions';
COMMENT ON FUNCTION set_rls_context IS 'Set user context for Row Level Security';
COMMENT ON FUNCTION clear_rls_context IS 'Clear RLS user context';
COMMENT ON FUNCTION can_access_user IS 'Check if current user can access target user data';
COMMENT ON TABLE audit_logs IS 'Audit trail for all user actions';
COMMENT ON TABLE usage_logs IS 'API usage tracking for analytics';
COMMENT ON TABLE password_resets IS 'Secure password reset tokens (hashed for security)';
COMMENT ON COLUMN password_resets.token_hash IS 'Hashed reset token - never store plaintext';

-- =====================================================
-- SECURITY VALIDATION
-- =====================================================

-- Ensure all sensitive tables have RLS enabled
DO $$
DECLARE
    table_name TEXT;
    rls_enabled BOOLEAN;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'api_keys', 'audit_logs', 'usage_logs', 'password_resets')
    LOOP
        SELECT rowsecurity INTO rls_enabled 
        FROM pg_tables 
        WHERE tablename = table_name AND schemaname = 'public';
        
        IF NOT rls_enabled THEN
            RAISE NOTICE 'RLS not enabled on table %', table_name;
        END IF;
    END LOOP;
END
$$;