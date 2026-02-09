-- Debug RLS policy issue
SELECT set_rls_context('29240aa9-...', 'user');

-- Test what current user sees
SELECT 
    'users' as table_name,
    COUNT(*) as accessible_records,
    'Current user context: ' || current_setting('app.current_user_id', 'Not set') as context
FROM users

UNION ALL

SELECT 
    'api_keys' as table_name,
    COUNT(*) as accessible_records,
    'Current user role: ' || current_setting('app.current_user_role', 'Not set') as context
FROM api_keys

UNION ALL

-- Try to access other user data explicitly
SELECT 
    'explicit_other_user_access' as table_name,
    COUNT(*) as accessible_records,
    'Should be 0 if RLS working' as context
FROM users 
WHERE id != '29240aa9-...'

UNION ALL

-- Test without user context
SELECT set_rls_context('', '');

SELECT 
    'no_context_access' as table_name,
    COUNT(*) as accessible_records,
    'Should see all if no context' as context
FROM users

LIMIT 1;