/**
 * Simple script to run analysis using require and dynamic imports
 * This bypasses PowerShell execution policy issues
 */

const fs = require('fs');
const path = require('path');

async function runAnalysis() {
  console.log('🚀 Running Project Analysis System...\n');

  try {
    // Use dynamic import to load TypeScript modules
    // Note: This requires ts-node to be available
    const { ProjectAnalyzer } = await import('../src/analysis/analyzer.js');
    
    const analyzer = new ProjectAnalyzer();

    // Find report files
    const reportFiles = [
      'ANALYSIS_REPORT.md',
      'TECHNICAL_ANALYSIS.md',
      'SECURITY_ASSESSMENT.md',
      'DATA_QUALITY_REPORT.md',
      'PERFORMANCE_ANALYSIS.md',
      'RECOMMENDATIONS_ROADMAP.md',
      'PRODUCTION_COMPLETION_REPORT.md',
      'PRODUCTION_READY.md',
    ].map((file) => path.join(process.cwd(), file)).filter((file) => fs.existsSync(file));

    console.log(`📄 Found ${reportFiles.length} reports to analyze\n`);

    // Run analysis
    const result = await analyzer.analyze(reportFiles);

    // Generate reports
    const reports = analyzer.generateReports(result);

    // Save reports
    const outputDir = path.join(process.cwd(), 'reports', 'analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'PROJECT_COMPLETION_STATUS.md'),
      reports.completionStatus,
      'utf-8'
    );
    console.log('✅ PROJECT_COMPLETION_STATUS.md');

    fs.writeFileSync(
      path.join(outputDir, 'GAP_ANALYSIS_DETAILED.md'),
      reports.gapAnalysis,
      'utf-8'
    );
    console.log('✅ GAP_ANALYSIS_DETAILED.md');

    fs.writeFileSync(
      path.join(outputDir, 'WBS_COMPLETE.md'),
      reports.wbs,
      'utf-8'
    );
    console.log('✅ WBS_COMPLETE.md');

    fs.writeFileSync(
      path.join(outputDir, 'ACTION_PLAN_100_PERCENT.md'),
      reports.actionPlan,
      'utf-8'
    );
    console.log('✅ ACTION_PLAN_100_PERCENT.md');

    console.log(`\n✅ Analysis complete! Reports saved to: ${outputDir}\n`);

    // Print summary
    console.log('📊 Summary:');
    console.log(`   Completion: ${result.completionStatus.overall.toFixed(1)}%`);
    console.log(`   Gaps: ${result.gaps.length}`);
    console.log(`   Timeline: ${result.wbs.totalEffort}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Try running with ts-node instead:');
    console.log('   npm run test-analysis');
    console.log('   or');
    console.log('   node -r ts-node/register scripts/test-analysis.ts');
  }
}

// For now, create a note about how to run
console.log('📝 Note: This script requires TypeScript compilation.');
console.log('💡 Recommended: Use npm scripts instead:\n');
console.log('   npm run verify-analysis  # Verify components');
console.log('   npm run test-analysis    # Run full analysis\n');
console.log('📚 See HOW_TO_RUN_ANALYSIS.md for detailed instructions.\n');

// If ts-node is available, try to run
if (require.resolve('ts-node')) {
  runAnalysis().catch(console.error);
} else {
  console.log('⚠️  ts-node not found. Please run: npm install');
}
