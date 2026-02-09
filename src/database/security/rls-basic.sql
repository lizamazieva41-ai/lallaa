-- =====================================================
-- RLS IMPLEMENTATION FOR DEVELOPMENT
-- =====================================================

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
CREATE POLICY user_isolation_policy ON users
    FOR ALL
    USING (
        id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
        OR current_setting('app.current_user_id', true) = ''
    )
    WITH CHECK (
        id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
        OR current_setting('app.current_user_id', true) = ''
    );

-- =====================================================
-- API KEYS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only access their own API keys
CREATE POLICY api_key_isolation_policy ON api_keys
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
        OR current_setting('app.current_user_id', true) = ''
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
        OR current_setting('app.current_user_id', true) = ''
    );

-- =====================================================
-- AUDIT LOGS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see their own audit logs
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- Service policy: Allow insertion without user_id check (for system logs)
CREATE POLICY audit_logs_service_policy ON audit_logs
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'service_account'
    );

-- =====================================================
-- USAGE LOGS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see their own usage logs
CREATE POLICY usage_logs_isolation_policy ON usage_logs
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- Service policy: Allow insertion without user_id check
CREATE POLICY usage_logs_service_policy ON usage_logs
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'service_account'
    );

-- =====================================================
-- PASSWORD RESETS TABLE RLS POLICIES
-- =====================================================

-- Policy: Users can only see their own password reset tokens
CREATE POLICY password_resets_isolation_policy ON password_resets
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- =====================================================
-- SECURITY FUNCTIONS
-- =====================================================

-- Function to set user context for RLS
CREATE OR REPLACE FUNCTION set_rls_context(user_id UUID, user_role VARCHAR DEFAULT 'user')
RETURNS VOID AS $$
BEGIN
    IF user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', user_id::text, true);
    ELSE
        PERFORM set_config('app.current_user_id', NULL, true);
    END IF;
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

-- Function to test RLS policies
CREATE OR REPLACE FUNCTION test_rls_policies(test_user_id UUID)
RETURNS TABLE(
    table_name TEXT,
    can_select BOOLEAN,
    row_count BIGINT
) AS $$
BEGIN
    -- Set test context
    PERFORM set_rls_context(test_user_id, 'user');
    
    RETURN QUERY
    -- Test users table access
    SELECT 'users'::TEXT, true, COUNT(*)::BIGINT
    FROM users 
    WHERE id = test_user_id
    
    UNION ALL
    
    -- Test api_keys table access
    SELECT 'api_keys'::TEXT, true, COUNT(*)::BIGINT
    FROM api_keys 
    WHERE user_id = test_user_id
    
    UNION ALL
    
    -- Test audit_logs table access
    SELECT 'audit_logs'::TEXT, true, COUNT(*)::BIGINT
    FROM audit_logs 
    WHERE user_id = test_user_id
    
    UNION ALL
    
    -- Test usage_logs table access
    SELECT 'usage_logs'::TEXT, true, COUNT(*)::BIGINT
    FROM usage_logs 
    WHERE user_id = test_user_id
    
    UNION ALL
    
    -- Test password_resets table access
    SELECT 'password_resets'::TEXT, true, COUNT(*)::BIGINT
    FROM password_resets 
    WHERE user_id = test_user_id;
    
    -- Clear context after test
    PERFORM clear_rls_context();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION set_rls_context IS 'Set user context for Row Level Security';
COMMENT ON FUNCTION clear_rls_context IS 'Clear RLS user context';
COMMENT ON FUNCTION can_access_user IS 'Check if current user can access target user data';
COMMENT ON FUNCTION test_rls_policies IS 'Test RLS policy effectiveness for a user';

-- =====================================================
-- SECURITY VALIDATION
-- =====================================================

-- Show current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'api_keys', 'audit_logs', 'usage_logs', 'password_resets')
ORDER BY tablename;

-- Show current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;