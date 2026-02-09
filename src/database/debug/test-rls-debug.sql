-- Create a test user for debugging
INSERT INTO users (id, email, password_hash, first_name, last_name, role, tier) 
VALUES ('test-debug-user-id', 'debug@test.com', 'hashed', 'Debug', 'User', 'user', 'free')
ON CONFLICT (id) DO NOTHING;

-- Set user context properly using variable
DO $$
DECLARE
    test_user_id UUID := 'test-debug-user-id';
BEGIN
    PERFORM set_rls_context(test_user_id, 'user');
    
    -- Check if context is set
    RAISE NOTICE 'User ID setting: %', current_setting('app.current_user_id', true);
    
    -- Test user isolation
    PERFORM dblink_connect('host=localhost port=5432 dbname=bincheck user=bincheck password=bincheck_secret', 
        $$ SELECT 
            'User can access own data: ' || 
            CASE WHEN EXISTS (SELECT 1 FROM users WHERE id = $1) THEN 'YES' ELSE 'NO' END as result
        $$, test_user_id);
    
    -- Test other user access should fail
    PERFORM dblink_connect('host=localhost port=5432 dbname=bincheck user=bincheck password=bincheck_secret', 
        $$ SELECT 
            'User can access other data: ' || 
            CASE WHEN EXISTS (SELECT 1 FROM users WHERE id != $1 LIMIT 1) THEN 'YES (BUG!)' ELSE 'NO' as result
        $$, test_user_id);
    
    PERFORM clear_rls_context();
END;
$$;