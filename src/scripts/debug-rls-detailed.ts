import { Pool } from 'pg';

async function debugRLS() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bincheck',
    user: process.env.DB_USER || 'bincheck',
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔍 DEBUG RLS ISSUE');
    console.log('===================');

    // First, get all users without context
    console.log('\n📊 1. All users without RLS context:');
    const allUsers = await pool.query('SELECT id, email FROM users LIMIT 5');
    console.log(`Total users: ${allUsers.rows.length}`);
    allUsers.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.id.substring(0, 8)}... - ${user.email}`);
    });

    // Set RLS context as first user
    const testUserId = allUsers.rows[0].id;
    console.log(`\n👤 2. Setting RLS context for user: ${testUserId.substring(0, 8)}...`);
    
    await pool.query('SELECT set_rls_context($1, $2)', [testUserId, 'user']);
    
    // Test exact same query as in test script
    console.log('\n🔍 3. Testing "other user" query (should return 0):');
    const otherDataQuery = await pool.query(`
      SELECT id, email 
      FROM users 
      WHERE id != $1 
      LIMIT 1
    `, [testUserId]);
    
    console.log(`Other data query result: ${otherDataQuery.rows.length} rows`);
    if (otherDataQuery.rows.length > 0) {
      console.log('❌ FOUND OTHER USER DATA:');
      otherDataQuery.rows.forEach(user => {
        console.log(`  - ${user.id.substring(0, 8)}... - ${user.email}`);
      });
      
      // Check current settings
      console.log('\n⚙️  Current RLS settings:');
      const settings = await pool.query(`
        SELECT 
          current_setting('app.current_user_id', true) as user_id,
          current_setting('app.current_user_role', true) as user_role
      `);
      console.log('User ID setting:', settings.rows[0]);
      
      // Test the USING clause directly
      console.log('\n🧪 4. Testing USING clause directly:');
      const usingTest = await pool.query(`
        SELECT id, email 
        FROM users 
        WHERE (current_setting('app.current_user_id', true) != '' AND 
                id = current_setting('app.current_user_id', true)::uuid) 
               OR current_setting('app.current_user_role', true) = 'admin'
      `);
      console.log(`USING clause test: ${usingTest.rows.length} rows`);
      
      // Test individual conditions
      console.log('\n🔬 5. Testing individual conditions:');
      const conditionTest = await pool.query(`
        SELECT 
          current_setting('app.current_user_id', true) != '' as context_not_empty,
          current_setting('app.current_user_id', true) as user_id_setting,
          id = current_setting('app.current_user_id', true)::uuid as matches_user,
          current_setting('app.current_user_role', true) as user_role_setting
        FROM users 
        WHERE id = $1
        LIMIT 1
      `, [testUserId]);
      console.log('Condition test result:', conditionTest.rows[0]);
      
    } else {
      console.log('✅ CORRECTLY BLOCKED other user data');
    }
    
    // Clear context
    await pool.query('SELECT clear_rls_context()');
    
  } catch (error) {
    console.error('❌ DEBUG FAILED:', error);
  } finally {
    await pool.end();
  }
}

debugRLS();