-- Alternative RLS approach using session variables
-- Drop all existing policies and recreate with simpler logic

DROP POLICY IF EXISTS user_isolation_policy ON users;
DROP POLICY IF EXISTS api_key_isolation_policy ON api_keys;
DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;
DROP POLICY IF EXISTS usage_logs_isolation_policy ON usage_logs;
DROP POLICY IF EXISTS password_resets_isolation_policy ON password_resets;
DROP POLICY IF EXISTS user_service_policy ON users;
DROP POLICY IF EXISTS api_key_service_policy ON api_keys;
DROP POLICY IF EXISTS audit_logs_service_policy ON audit_logs;
DROP POLICY IF EXISTS usage_logs_service_policy ON usage_logs;
DROP POLICY IF EXISTS password_resets_service_policy ON password_resets;

-- Simplified RLS functions
DROP FUNCTION IF EXISTS set_rls_context(UUID, VARCHAR);
CREATE OR REPLACE FUNCTION set_rls_context(user_id UUID, user_role VARCHAR DEFAULT 'user')
RETURNS VOID AS $$
BEGIN
    -- Store user ID in session variable
    PERFORM pg_catalog.set_config('my.app_user_id', user_id::text, false);
    PERFORM pg_catalog.set_config('my.app_user_role', user_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS clear_rls_context();
CREATE OR REPLACE FUNCTION clear_rls_context()
RETURNS VOID AS $$
BEGIN
    PERFORM pg_catalog.set_config('my.app_user_id', '', false);
    PERFORM pg_catalog.set_config('my.app_user_role', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USERS TABLE RLS POLICY (SIMPLIFIED)
CREATE POLICY user_isolation_policy ON users
    FOR ALL
    USING (
        pg_catalog.current_setting('my.app_user_id')::text != '' AND 
        id = pg_catalog.current_setting('my.app_user_id')::uuid
        OR pg_catalog.current_setting('my.app_user_role')::text = 'admin'
    );

-- Service policy for users
CREATE POLICY user_service_policy ON users
    FOR SELECT
    TO PUBLIC
    USING (pg_catalog.current_setting('my.app_user_role')::text = 'service_account');

-- API KEYS TABLE RLS POLICY (SIMPLIFIED)
CREATE POLICY api_key_isolation_policy ON api_keys
    FOR ALL
    USING (
        pg_catalog.current_setting('my.app_user_id')::text != '' AND 
        user_id = pg_catalog.current_setting('my.app_user_id')::uuid
        OR pg_catalog.current_setting('my.app_user_role')::text = 'admin'
    );

-- Service policy for api_keys
CREATE POLICY api_key_service_policy ON api_keys
    FOR ALL
    TO PUBLIC
    USING (pg_catalog.current_setting('my.app_user_role')::text = 'service_account');

-- AUDIT LOGS RLS POLICY (SIMPLIFIED)
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    USING (
        pg_catalog.current_setting('my.app_user_id')::text != '' AND 
        user_id = pg_catalog.current_setting('my.app_user_id')::uuid
        OR pg_catalog.current_setting('my.app_user_role')::text = 'admin'
    );

-- Service policy for audit_logs
CREATE POLICY audit_logs_service_policy ON audit_logs
    FOR INSERT
    TO PUBLIC
    USING (pg_catalog.current_setting('my.app_user_role')::text = 'service_account');

-- USAGE LOGS RLS POLICY (SIMPLIFIED)
CREATE POLICY usage_logs_isolation_policy ON usage_logs
    FOR ALL
    USING (
        pg_catalog.current_setting('my.app_user_id')::text != '' AND 
        user_id = pg_catalog.current_setting('my.app_user_id')::uuid
        OR pg_catalog.current_setting('my.app_user_role')::text = 'admin'
    );

-- Service policy for usage_logs
CREATE POLICY usage_logs_service_policy ON usage_logs
    FOR INSERT
    TO PUBLIC
    USING (pg_catalog.current_setting('my.app_user_role')::text = 'service_account');

-- PASSWORD RESETS RLS POLICY (SIMPLIFIED)
CREATE POLICY password_resets_isolation_policy ON password_resets
    FOR ALL
    USING (
        pg_catalog.current_setting('my.app_user_id')::text != '' AND 
        user_id = pg_catalog.current_setting('my.app_user_id')::uuid
        OR pg_catalog.current_setting('my.app_user_role')::text = 'admin'
    );

-- Service policy for password_resets
CREATE POLICY password_resets_service_policy ON password_resets
    FOR ALL
    TO PUBLIC
    USING (pg_catalog.current_setting('my.app_user_role')::text = 'service_account');

-- Test the new implementation
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Insert test user
    INSERT INTO users (email, password_hash, first_name, last_name, role, tier) 
    VALUES ('test-rls-fixed@test.com', 'hashed', 'Test', 'User', 'user', 'free')
    RETURNING id INTO test_user_id;
    
    -- Set RLS context
    PERFORM set_rls_context(test_user_id, 'user');
    
    -- Test user access
    IF EXISTS (SELECT 1 FROM users WHERE id = test_user_id) THEN
        RAISE NOTICE '✅ SUCCESS: User can access own data';
    ELSE
        RAISE NOTICE '❌ FAILED: User cannot access own data';
    END IF;
    
    -- Test other user access
    IF EXISTS (SELECT 1 FROM users WHERE id != test_user_id LIMIT 1) THEN
        RAISE NOTICE '❌ SECURITY BREACH: User can access other data';
    ELSE
        RAISE NOTICE '✅ SUCCESS: User cannot access other data';
    END IF;
    
    -- Clear context
    PERFORM clear_rls_context();
END;
$$;