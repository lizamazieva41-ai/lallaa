-- Create new policy names to avoid conflicts
DROP POLICY IF EXISTS user_isolation_policy ON users;
DROP POLICY IF EXISTS api_key_isolation_policy ON api_keys;
DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;
DROP POLICY IF EXISTS usage_logs_isolation_policy ON usage_logs;
DROP POLICY IF EXISTS password_resets_isolation_policy ON password_resets;

-- USERS TABLE RLS POLICY (FIXED)
CREATE POLICY user_secure_isolation_policy ON users
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- API KEYS TABLE RLS POLICY (FIXED)
CREATE POLICY api_key_secure_isolation_policy ON api_keys
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- AUDIT LOGS TABLE RLS POLICIES (FIXED)
CREATE POLICY audit_logs_secure_isolation_policy ON audit_logs
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY audit_logs_secure_service_policy ON audit_logs
    FOR INSERT
    WITH CHECK (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'service_account'
    );

-- USAGE LOGS TABLE RLS POLICIES (FIXED)
CREATE POLICY usage_logs_secure_isolation_policy ON usage_logs
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY usage_logs_secure_service_policy ON usage_logs
    FOR INSERT
    WITH CHECK (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'service_account'
    );

-- PASSWORD RESETS TABLE RLS POLICY (FIXED)
CREATE POLICY password_resets_secure_isolation_policy ON password_resets
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        (current_setting('app.current_user_id', true) IS NOT NULL AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );