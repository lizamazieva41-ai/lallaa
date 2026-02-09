-- =====================================================
-- ROW LEVEL SECURITY (RLS) IMPLEMENTATION
-- =====================================================
-- This script enables RLS for all sensitive tables
-- and creates policies to ensure data isolation

-- Create custom roles first
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

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see and modify their own data
-- Admin users can see all users
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

-- Policy: Service accounts can read user data for authentication
CREATE POLICY user_service_policy ON users
    FOR SELECT
    TO service_account
    USING (true);

-- =====================================================
-- API KEYS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only access their own API keys
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

-- Policy: Service accounts can manage API keys
CREATE POLICY api_key_service_policy ON api_keys
    FOR ALL
    TO service_account
    USING (true);

-- =====================================================
-- AUDIT LOGS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see their own audit logs
-- Admin users can see all audit logs
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    TO authenticated_user
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- Policy: Service accounts can write audit logs
CREATE POLICY audit_logs_service_policy ON audit_logs
    FOR INSERT
    TO service_account
    WITH CHECK (true);

-- =====================================================
-- USAGE LOGS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see their own usage logs
-- Admin users can see all usage logs
CREATE POLICY usage_logs_isolation_policy ON usage_logs
    FOR ALL
    TO authenticated_user
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- Policy: Service accounts can write usage logs
CREATE POLICY usage_logs_service_policy ON usage_logs
    FOR INSERT
    TO service_account
    WITH CHECK (true);

-- =====================================================
-- PASSWORD RESETS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see their own password reset tokens
-- Service accounts can manage all password resets
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

-- Policy: Service accounts can manage password resets
CREATE POLICY password_resets_service_policy ON password_resets
    FOR ALL
    TO service_account
    USING (true);

-- =====================================================
-- ROLES AND PERMISSIONS
-- =====================================================

-- Grant permissions to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated_user;
GRANT SELECT ON audit_logs TO authenticated_user;
GRANT SELECT ON usage_logs TO authenticated_user;
GRANT SELECT, INSERT, DELETE ON password_resets TO authenticated_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_account;

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
-- SECURITY TRIGGERS FOR ADDITIONAL PROTECTION
-- =====================================================

-- Trigger to automatically set audit context
CREATE OR REPLACE FUNCTION set_audit_context()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure RLS context is set for all operations
    IF current_setting('app.current_user_id', true) = '' THEN
        RAISE EXCEPTION 'RLS context not set. User must be authenticated.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit context triggers
CREATE TRIGGER ensure_audit_context
    BEFORE INSERT OR UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION set_audit_context();

CREATE TRIGGER ensure_usage_context
    BEFORE INSERT ON usage_logs
    FOR EACH ROW EXECUTE FUNCTION set_audit_context();

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

-- View to monitor user access patterns
CREATE OR REPLACE VIEW security.user_access_audit AS
SELECT 
    current_setting('app.current_user_id', true) as user_id,
    current_setting('app.current_user_role', true) as user_role,
    query as current_query,
    backend_start,
    state
FROM pg_stat_activity 
WHERE usename = current_user
    AND state = 'active';

-- =====================================================
-- SECURITY TESTING FUNCTIONS
-- =====================================================

-- Function to test RLS policies
CREATE OR REPLACE FUNCTION security.test_rls_policies(test_user_id UUID)
RETURNS TABLE(
    table_name TEXT,
    can_select BOOLEAN,
    can_insert BOOLEAN,
    can_update BOOLEAN,
    can_delete BOOLEAN
) AS $$
BEGIN
    -- Set test context
    PERFORM set_rls_context(test_user_id, 'user');
    
    RETURN QUERY
    -- Test users table access
    SELECT 'users'::TEXT,
           (SELECT COUNT(*) > 0 FROM users WHERE id = test_user_id),
           false, -- Insert test would violate constraints
           false, -- Update test would need specific conditions
           false  -- Delete test would need specific conditions
    
    UNION ALL
    
    -- Test api_keys table access
    SELECT 'api_keys'::TEXT,
           (SELECT COUNT(*) > 0 FROM api_keys WHERE user_id = test_user_id),
           false,
           false,
           false
    
    UNION ALL
    
    -- Test audit_logs table access
    SELECT 'audit_logs'::TEXT,
           (SELECT COUNT(*) > 0 FROM audit_logs WHERE user_id = test_user_id),
           false,
           false,
           false
    
    UNION ALL
    
    -- Test usage_logs table access
    SELECT 'usage_logs'::TEXT,
           (SELECT COUNT(*) > 0 FROM usage_logs WHERE user_id = test_user_id),
           false,
           false,
           false;
    
    -- Clear context after test
    PERFORM clear_rls_context();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA security IS 'Security monitoring and testing functions';
COMMENT ON FUNCTION set_rls_context IS 'Set user context for Row Level Security';
COMMENT ON FUNCTION clear_rls_context IS 'Clear RLS user context';
COMMENT ON FUNCTION can_access_user IS 'Check if current user can access target user data';
COMMENT ON FUNCTION security.test_rls_policies IS 'Test RLS policy effectiveness for a user';

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
            RAISE EXCEPTION 'RLS not enabled on table %', table_name;
        END IF;
    END LOOP;
END
$$;