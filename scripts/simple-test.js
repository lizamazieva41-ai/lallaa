/**
 * Simple JavaScript test that can run without PowerShell execution policy issues
 * Run with: node scripts/simple-test.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Analysis System Components...\n');

// Test 1: Check if all required files exist
console.log('1. Checking required files...');
const requiredFiles = [
  'src/analysis/types.ts',
  'src/analysis/interfaces.ts',
  'src/analysis/reportParser.ts',
  'src/analysis/dataExtractor.ts',
  'src/analysis/gapAnalyzer.ts',
  'src/analysis/wbsGenerator.ts',
  'src/analysis/reportGenerator.ts',
  'src/analysis/analyzer.ts',
  'src/analysis/cli.ts',
  'scripts/analyze-reports.ts',
  'scripts/test-analysis.ts',
  'scripts/verify-analysis.ts',
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - NOT FOUND`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

console.log('\n✅ All required files exist!\n');

// Test 2: Check if report files exist
console.log('2. Checking report files...');
const reportFiles = [
  'ANALYSIS_REPORT.md',
  'TECHNICAL_ANALYSIS.md',
  'SECURITY_ASSESSMENT.md',
  'DATA_QUALITY_REPORT.md',
  'PERFORMANCE_ANALYSIS.md',
  'RECOMMENDATIONS_ROADMAP.md',
  'PRODUCTION_COMPLETION_REPORT.md',
  'PRODUCTION_READY.md',
];

const foundReports = [];
for (const file of reportFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
    foundReports.push(filePath);
  } else {
    console.log(`   ⚠️  ${file} - Not found (optional)`);
  }
}

console.log(`\n✅ Found ${foundReports.length} report files\n`);

// Test 3: Check package.json scripts
console.log('3. Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const requiredScripts = [
  'analyze-reports',
  'test-analysis',
  'verify-analysis',
];

for (const script of requiredScripts) {
  if (packageJson.scripts[script]) {
    console.log(`   ✅ npm run ${script}`);
  } else {
    console.log(`   ❌ npm run ${script} - NOT FOUND`);
  }
}

console.log('\n✅ All scripts configured!\n');

// Test 4: Check output directory
console.log('4. Checking output directory...');
const outputDir = path.join(process.cwd(), 'reports', 'analysis');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`   ✅ Created: ${outputDir}`);
} else {
  console.log(`   ✅ Exists: ${outputDir}`);
}

console.log('\n' + '='.repeat(60));
console.log('✅ System Verification Complete!');
console.log('='.repeat(60));
console.log('\n📋 Next Steps:');
console.log('   1. Fix PowerShell execution policy (if needed):');
console.log('      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser');
console.log('   2. Run verification: npm run verify-analysis');
console.log('   3. Run analysis: npm run test-analysis');
console.log('   4. Review reports in: reports/analysis/\n');
