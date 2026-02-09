#!/usr/bin/env ts-node

/**
 * Test script to run analysis system with real reports
 */

import { ProjectAnalyzer } from '../src/analysis/analyzer';
import * as path from 'path';

async function main(): Promise<void> {
  console.log('🚀 Starting Project Analysis System Test...\n');

  const analyzer = new ProjectAnalyzer();

  // List of report files to analyze
  const reportFiles = [
    'ANALYSIS_REPORT.md',
    'TECHNICAL_ANALYSIS.md',
    'SECURITY_ASSESSMENT.md',
    'DATA_QUALITY_REPORT.md',
    'PERFORMANCE_ANALYSIS.md',
    'RECOMMENDATIONS_ROADMAP.md',
    'PRODUCTION_COMPLETION_REPORT.md',
    'PRODUCTION_READY.md',
  ].map((file) => path.join(process.cwd(), file));

  console.log(`📄 Analyzing ${reportFiles.length} reports:\n`);
  reportFiles.forEach((file) => console.log(`   - ${path.basename(file)}`));
  console.log('');

  try {
    // Run analysis
    const result = await analyzer.analyze(reportFiles);

    // Generate reports
    console.log('\n📝 Generating reports...\n');
    const reports = analyzer.generateReports(result);

    // Create output directory
    const outputDir = path.join(process.cwd(), 'reports', 'analysis');
    const fs = await import('fs');
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }

    // Save reports
    console.log('💾 Saving reports...\n');
    await fs.promises.writeFile(
      path.join(outputDir, 'PROJECT_COMPLETION_STATUS.md'),
      reports.completionStatus,
      'utf-8'
    );
    console.log('   ✅ PROJECT_COMPLETION_STATUS.md');

    await fs.promises.writeFile(
      path.join(outputDir, 'GAP_ANALYSIS_DETAILED.md'),
      reports.gapAnalysis,
      'utf-8'
    );
    console.log('   ✅ GAP_ANALYSIS_DETAILED.md');

    await fs.promises.writeFile(
      path.join(outputDir, 'WBS_COMPLETE.md'),
      reports.wbs,
      'utf-8'
    );
    console.log('   ✅ WBS_COMPLETE.md');

    await fs.promises.writeFile(
      path.join(outputDir, 'ACTION_PLAN_100_PERCENT.md'),
      reports.actionPlan,
      'utf-8'
    );
    console.log('   ✅ ACTION_PLAN_100_PERCENT.md');

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TÓM TẮT PHÂN TÍCH');
    console.log('='.repeat(60));
    console.log(`\n✅ Tỷ lệ hoàn thành: ${result.completionStatus.overall.toFixed(1)}%`);
    console.log(`📝 Đã hoàn thành: ${result.completionStatus.completedCount} hạng mục`);
    console.log(`⏳ Đang chờ: ${result.completionStatus.pendingCount} hạng mục`);
    console.log(`🎯 Khoảng trống: ${result.gaps.length} hạng mục`);
    console.log(`\n⏱️  Tổng thời gian ước tính: ${result.wbs.totalEffort}`);
    console.log(`📅 Tổng số ngày: ${result.wbs.totalDuration} ngày`);

    // Group gaps by priority
    const byPriority = {
      CRITICAL: result.gaps.filter((g) => g.priority === 'CRITICAL'),
      HIGH: result.gaps.filter((g) => g.priority === 'HIGH'),
      MEDIUM: result.gaps.filter((g) => g.priority === 'MEDIUM'),
      LOW: result.gaps.filter((g) => g.priority === 'LOW'),
    };

    console.log(`\n🔴 CRITICAL: ${byPriority.CRITICAL.length}`);
    console.log(`🟡 HIGH: ${byPriority.HIGH.length}`);
    console.log(`🟠 MEDIUM: ${byPriority.MEDIUM.length}`);
    console.log(`🟢 LOW: ${byPriority.LOW.length}`);
    console.log('='.repeat(60));

    console.log(`\n✅ Hoàn thành! Reports đã được lưu tại: ${outputDir}\n`);
  } catch (error) {
    console.error('\n❌ Lỗi:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
