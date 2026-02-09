-- Direct test of RLS policies
-- Set user context
SELECT set_rls_context('5f15a454-3d67-4a2a-9b2a-5c3d8e2a1b7', 'user');

-- Check if context is set properly
SELECT 
    current_setting('app.current_user_id', true) as user_id_setting,
    current_setting('app.current_user_role', true) as user_role_setting;

-- Test user isolation policy directly
SELECT COUNT(*) as test_result
FROM users 
WHERE (current_setting('app.current_user_id', true) IS NOT NULL AND 
        id = current_setting('app.current_user_id', true)::uuid) 
       OR current_setting('app.current_user_role', true) = 'admin';

-- Test other user access
SELECT COUNT(*) as other_user_access
FROM users 
WHERE id != '5f15a454-3d67-4a2a-9b2a-5c3d8e2a1b7'
  AND (current_setting('app.current_user_id', true) IS NOT NULL AND 
        id = current_setting('app.current_user_id', true)::uuid);

-- Clear context
SELECT clear_rls_context();