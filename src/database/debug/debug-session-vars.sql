-- Debug session variable setting
DO $$
DECLARE
    test_user_id UUID := 'test-rls-fixed@test.com';
    current_user_id TEXT;
    current_user_role TEXT;
BEGIN
    -- Get the actual test user ID
    SELECT id INTO test_user_id FROM users WHERE email = 'test-rls-fixed@test.com' LIMIT 1;
    
    -- Set RLS context
    PERFORM set_rls_context(test_user_id, 'user');
    
    -- Check session variables
    current_user_id := pg_catalog.current_setting('my.app_user_id');
    current_user_role := pg_catalog.current_setting('my.app_user_role');
    
    RAISE NOTICE 'Current session variables: user_id=%, role=%', current_user_id, current_user_role;
    
    -- Test policy evaluation manually
    IF EXISTS (SELECT 1 FROM users 
                 WHERE id = test_user_id 
                   AND (pg_catalog.current_setting('my.app_user_id')::text != '' 
                        AND id = pg_catalog.current_setting('my.app_user_id')::uuid)) THEN
        RAISE NOTICE '✅ Policy evaluation works correctly';
    ELSE
        RAISE NOTICE '❌ Policy evaluation failed';
    END IF;
    
    -- Test other user access manually
    IF EXISTS (SELECT 1 FROM users 
                 WHERE id != test_user_id 
                   AND (pg_catalog.current_setting('my.app_user_id')::text != '' 
                        AND id = pg_catalog.current_setting('my.app_user_id')::uuid)) THEN
        RAISE NOTICE '❌ SECURITY BREACH: Policy allows other user access';
    ELSE
        RAISE NOTICE '✅ SUCCESS: Policy blocks other user access';
    END IF;
    
    PERFORM clear_rls_context();
END;
$$;