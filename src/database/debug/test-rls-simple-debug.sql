-- Simple RLS test without complex functions
-- Clear any existing context first
SELECT clear_rls_context();

-- Create test user and get UUID
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Insert test user and get ID
    INSERT INTO users (email, password_hash, first_name, last_name, role, tier) 
    VALUES ('debug-test@test.com', 'hashed', 'Debug', 'User', 'user', 'free')
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