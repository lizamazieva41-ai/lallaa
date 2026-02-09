-- Debug session variable setting with proper UUID
DO $$
DECLARE
    test_user_email TEXT := 'test-rls-fixed@test.com';
    current_user_id TEXT;
    current_user_role TEXT;
BEGIN
    -- Set RLS context
    PERFORM set_rls_context(
        (SELECT id FROM users WHERE email = test_user_email LIMIT 1),
        'user'
    );
    
    -- Check session variables
    current_user_id := pg_catalog.current_setting('my.app_user_id');
    current_user_role := pg_catalog.current_setting('my.app_user_role');
    
    RAISE NOTICE 'Current session variables: user_id=%, role=%', current_user_id, current_user_role;
    
    -- Test policy evaluation manually
    IF EXISTS (SELECT 1 FROM users 
                 WHERE email = test_user_email
                   AND (current_user_id IS NOT NULL 
                        AND id = current_user_id::uuid)) THEN
        RAISE NOTICE '✅ Policy evaluation works correctly for own user';
    ELSE
        RAISE NOTICE '❌ Policy evaluation failed for own user';
    END IF;
    
    -- Test other user access
    IF EXISTS (SELECT 1 FROM users 
                 WHERE email != test_user_email
                   AND (current_user_id IS NOT NULL 
                        AND id = current_user_id::uuid)) THEN
        RAISE NOTICE '❌ SECURITY BREACH: Policy allows other user access';
    ELSE
        RAISE NOTICE '✅ Policy correctly blocks other user access';
    END IF;
    
    PERFORM clear_rls_context();
END;
$$;