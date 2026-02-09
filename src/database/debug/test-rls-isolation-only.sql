-- Final RLS fix - Only isolation policies, no service policies

DROP POLICY IF EXISTS user_service_policy ON users;
DROP POLICY IF EXISTS api_key_service_policy ON api_keys;
DROP POLICY IF EXISTS audit_logs_service_policy ON audit_logs;
DROP POLICY IF EXISTS usage_logs_service_policy ON usage_logs;
DROP POLICY IF EXISTS password_resets_service_policy ON password_resets;

-- Test again with only isolation policies
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Get test user ID
    SELECT id INTO test_user_id FROM users WHERE email = 'test-rls-fixed@test.com' LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
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
    END IF;
END;
$$;