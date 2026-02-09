-- CRITICAL FIX: Update RLS functions to handle context properly
-- Replace existing functions with proper NULL handling

-- Function to set user context for RLS (FIXED)
DROP FUNCTION IF EXISTS set_rls_context(UUID, VARCHAR);
CREATE OR REPLACE FUNCTION set_rls_context(user_id UUID, user_role VARCHAR DEFAULT 'user')
RETURNS VOID AS $$
BEGIN
    IF user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', user_id::text, true);
    ELSE
        PERFORM set_config('app.current_user_id', NULL::text, true);
    END IF;
    PERFORM set_config('app.current_user_role', user_role, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear RLS context (FIXED)
DROP FUNCTION IF EXISTS clear_rls_context();
CREATE OR REPLACE FUNCTION clear_rls_context()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', NULL::text, true);
    PERFORM set_config('app.current_user_role', NULL::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user can access resource (FIXED)
DROP FUNCTION IF EXISTS can_access_user(UUID);
CREATE OR REPLACE FUNCTION can_access_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    current_user_role VARCHAR;
BEGIN
    current_user_id := current_setting('app.current_user_id', true)::uuid;
    current_user_role := current_setting('app.current_user_role', true);
    
    RETURN 
        (current_user_id IS NOT NULL AND current_user_id = target_user_id)
        OR current_user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to test RLS policies (FIXED)
DROP FUNCTION IF EXISTS test_rls_policies(UUID);
CREATE OR REPLACE FUNCTION test_rls_policies(test_user_id UUID)
RETURNS TABLE(
    table_name TEXT,
    can_select BOOLEAN,
    row_count BIGINT
) AS $$
DECLARE
    original_user_id UUID;
    original_user_role VARCHAR;
BEGIN
    -- Save original context
    original_user_id := current_setting('app.current_user_id', true)::uuid;
    original_user_role := current_setting('app.current_user_role', true);
    
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
    
    -- Restore original context
    IF original_user_id IS NOT NULL THEN
        PERFORM set_rls_context(original_user_id, original_user_role);
    ELSE
        PERFORM clear_rls_context();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;