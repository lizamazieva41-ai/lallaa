#!/usr/bin/env ts-node

/**
 * Simple verification script to test analysis system components
 * This script tests the logic without requiring file I/O
 */

import { ReportParser } from '../src/analysis/reportParser';
import { DataExtractor } from '../src/analysis/dataExtractor';
import { GapAnalyzer } from '../src/analysis/gapAnalyzer';
import { WBSGenerator } from '../src/analysis/wbsGenerator';

async function verify(): Promise<void> {
  console.log('🔍 Verifying Analysis System Components...\n');

  try {
    // Test 1: Report Parser
    console.log('1. Testing Report Parser...');
    const parser = new ReportParser();
    const testContent = `# Test Report

## Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Test Coverage | 43.5 | 80 | ⚠️ Below Target |

## Completed

✅ JWT authentication
✅ Password hashing

## Pending

⚠️ Fix JWT security
⚠️ Increase test coverage
`;

    const parsed = parser.parseMarkdown(testContent, 'test.md');
    console.log('   ✅ Parser works');
    console.log(`   - Found ${parsed.sections.length} sections`);
    console.log(`   - Found ${parsed.allCheckboxes.length} checkboxes`);
    console.log(`   - Found ${parsed.allMetrics.length} metrics`);
    console.log(`   - Found ${parsed.completedItems.length} completed items`);
    console.log(`   - Found ${parsed.pendingItems.length} pending items\n`);

    // Test 2: Data Extractor
    console.log('2. Testing Data Extractor...');
    const extractor = new DataExtractor();
    const completionStatus = extractor.extractCompletionStatus([parsed]);
    console.log('   ✅ Extractor works');
    console.log(`   - Overall completion: ${completionStatus.overall.toFixed(1)}%`);
    console.log(`   - Completed: ${completionStatus.completedCount}`);
    console.log(`   - Pending: ${completionStatus.pendingCount}\n`);

    // Test 3: Gap Analyzer
    console.log('3. Testing Gap Analyzer...');
    const analyzer = new GapAnalyzer();
    const metrics = extractor.extractMetrics([parsed]);
    const pendingItems = extractor.extractPendingItems([parsed]);
    const gaps = analyzer.analyzeGaps(completionStatus, metrics, pendingItems);
    console.log('   ✅ Analyzer works');
    console.log(`   - Found ${gaps.length} gaps`);
    const classified = analyzer.classifyByPriority(gaps);
    console.log(`   - CRITICAL: ${classified.CRITICAL.length}`);
    console.log(`   - HIGH: ${classified.HIGH.length}`);
    console.log(`   - MEDIUM: ${classified.MEDIUM.length}`);
    console.log(`   - LOW: ${classified.LOW.length}\n`);

    // Test 4: WBS Generator
    console.log('4. Testing WBS Generator...');
    const wbsGenerator = new WBSGenerator();
    const wbs = wbsGenerator.generateWBS(gaps);
    console.log('   ✅ WBS Generator works');
    console.log(`   - Project: ${wbs.projectName}`);
    console.log(`   - Phases: ${wbs.phases.length}`);
    console.log(`   - Total duration: ${wbs.totalDuration} days`);
    console.log(`   - Total effort: ${wbs.totalEffort}\n`);

    console.log('✅ All components verified successfully!\n');
    console.log('💡 System is ready to use. Run with:');
    console.log('   npm run analyze-reports');
    console.log('   or');
    console.log('   npm run test-analysis\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  verify().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
