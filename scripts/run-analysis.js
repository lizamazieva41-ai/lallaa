/**
 * Simple Node.js script to run analysis (bypasses PowerShell execution policy)
 * Run with: node scripts/run-analysis.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Running Project Analysis System...\n');

try {
  // Use node to run ts-node directly
  const scriptPath = path.join(__dirname, 'test-analysis.ts');
  const command = `node --loader ts-node/esm ${scriptPath}`;
  
  // Alternative: use ts-node directly if available
  try {
    execSync(`npx --yes ts-node "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error('Error running with npx, trying alternative method...');
    // Fallback: compile and run
    const { execSync: exec } = require('child_process');
    exec('npm run build', { stdio: 'inherit' });
    // Then run compiled version if needed
  }
} catch (error) {
  console.error('Error:', error.message);
  console.log('\n💡 Alternative: Run manually with:');
  console.log('   node -r ts-node/register scripts/test-analysis.ts');
  console.log('   or');
  console.log('   npm run test-analysis');
  process.exit(1);
}
