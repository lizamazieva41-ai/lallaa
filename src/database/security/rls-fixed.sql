-- Fixed RLS policies that handle empty context properly

-- USERS TABLE RLS POLICY
CREATE POLICY user_isolation_policy ON users
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) != '' AND 
         id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        (current_setting('app.current_user_id', true) != '' AND 
         id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- API KEYS TABLE RLS POLICY
CREATE POLICY api_key_isolation_policy ON api_keys
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

-- AUDIT LOGS TABLE RLS POLICIES
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY audit_logs_service_policy ON audit_logs
    FOR INSERT
    WITH CHECK (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'service_account'
    );

-- USAGE LOGS TABLE RLS POLICIES
CREATE POLICY usage_logs_isolation_policy ON usage_logs
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );

CREATE POLICY usage_logs_service_policy ON usage_logs
    FOR INSERT
    WITH CHECK (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'service_account'
    );

-- PASSWORD RESETS TABLE RLS POLICY
CREATE POLICY password_resets_isolation_policy ON password_resets
    FOR ALL
    USING (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    )
    WITH CHECK (
        (current_setting('app.current_user_id', true) != '' AND 
         user_id = current_setting('app.current_user_id', true)::uuid) 
        OR current_setting('app.current_user_role', true) = 'admin'
    );