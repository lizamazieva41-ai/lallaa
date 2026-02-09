-- CRITICAL FIX: Update all RLS policies with proper NULL handling
-- Drop and recreate all policies with fixed logic

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS user_isolation_policy ON users;
DROP POLICY IF EXISTS api_key_isolation_policy ON api_keys;
DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;
DROP POLICY IF EXISTS audit_logs_service_policy ON audit_logs;
DROP POLICY IF EXISTS usage_logs_isolation_policy ON usage_logs;
DROP POLICY IF EXISTS usage_logs_service_policy ON usage_logs;
DROP POLICY IF EXISTS password_resets_isolation_policy ON password_resets;

-- USERS TABLE RLS POLICY (CRITICAL FIX)
CREATE POLICY user_isolation_policy ON users
    FOR ALL
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    )
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    );

-- Service account policy for users (allows service operations)
CREATE POLICY user_service_policy ON users
    FOR SELECT
    TO PUBLIC
    USING (current_setting('app.current_user_role', true) = 'service_account');

-- API KEYS TABLE RLS POLICY (CRITICAL FIX)
CREATE POLICY api_key_isolation_policy ON api_keys
    FOR ALL
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    )
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    );

-- Service account policy for api_keys
CREATE POLICY api_key_service_policy ON api_keys
    FOR ALL
    TO PUBLIC
    USING (current_setting('app.current_user_role', true) = 'service_account');

-- AUDIT LOGS TABLE RLS POLICIES (CRITICAL FIX)
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    );

CREATE POLICY audit_logs_service_policy ON audit_logs
    FOR INSERT
    TO PUBLIC
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'service_account'
        )
    );

-- USAGE LOGS TABLE RLS POLICIES (CRITICAL FIX)
CREATE POLICY usage_logs_isolation_policy ON usage_logs
    FOR ALL
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    );

CREATE POLICY usage_logs_service_policy ON usage_logs
    FOR INSERT
    TO PUBLIC
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'service_account'
        )
    );

-- PASSWORD RESETS TABLE RLS POLICY (CRITICAL FIX)
CREATE POLICY password_resets_isolation_policy ON password_resets
    FOR ALL
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    )
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'admin'
        )
    );

-- Service account policy for password_resets
CREATE POLICY password_resets_service_policy ON password_resets
    FOR INSERT
    TO PUBLIC
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL AND 
        (
            user_id = current_setting('app.current_user_id', true)::uuid 
            OR current_setting('app.current_user_role', true) = 'service_account'
        )
    );

-- Validation query to check policies
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