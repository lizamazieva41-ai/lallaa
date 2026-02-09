/**
 * CLI Interface for Project Analysis System
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from './analyzer';

interface CLIOptions {
  inputDir?: string;
  outputDir?: string;
  reports?: string[];
  verbose?: boolean;
}

export class CLI {
  private analyzer: ProjectAnalyzer;

  constructor() {
    this.analyzer = new ProjectAnalyzer();
  }

  /**
   * Run analysis from command line
   */
  async run(options: CLIOptions): Promise<void> {
    try {
      // Find report files
      const reportFiles = await this.findReportFiles(options);

      if (reportFiles.length === 0) {
        console.error('❌ Không tìm thấy báo cáo nào!');
        process.exit(1);
      }

      console.log(`📄 Tìm thấy ${reportFiles.length} báo cáo:`);
      reportFiles.forEach((file) => console.log(`   - ${file}`));
      console.log('');

      // Run analysis
      const result = await this.analyzer.analyze(reportFiles);

      // Generate reports
      console.log('📝 Generating reports...');
      const reports = this.analyzer.generateReports(result);

      // Save reports
      const outputDir = options.outputDir || path.join(process.cwd(), 'reports', 'analysis');
      await this.saveReports(reports, outputDir);

      // Print summary
      this.printSummary(result);

      console.log(`\n✅ Hoàn thành! Reports đã được lưu tại: ${outputDir}`);
    } catch (error) {
      console.error('❌ Lỗi:', error);
      process.exit(1);
    }
  }

  /**
   * Find report files
   */
  private async findReportFiles(options: CLIOptions): Promise<string[]> {
    if (options.reports && options.reports.length > 0) {
      return options.reports;
    }

    const inputDir = options.inputDir || process.cwd();
    const reportFiles: string[] = [];

    // Common report file names
    const commonReports = [
      'ANALYSIS_REPORT.md',
      'TECHNICAL_ANALYSIS.md',
      'SECURITY_ASSESSMENT.md',
      'DATA_QUALITY_REPORT.md',
      'PERFORMANCE_ANALYSIS.md',
      'RECOMMENDATIONS_ROADMAP.md',
      'PRODUCTION_COMPLETION_REPORT.md',
      'PRODUCTION_READY.md',
    ];

    for (const reportName of commonReports) {
      const reportPath = path.join(inputDir, reportName);
      if (fs.existsSync(reportPath)) {
        reportFiles.push(reportPath);
      }
    }

    // Also search for any .md files in the directory
    try {
      const files = await fs.promises.readdir(inputDir);
      for (const file of files) {
        if (file.endsWith('.md') && !reportFiles.includes(path.join(inputDir, file))) {
          const filePath = path.join(inputDir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          // Check if it looks like a report
          if (
            content.includes('Báo Cáo') ||
            content.includes('Report') ||
            content.includes('Analysis') ||
            content.includes('Assessment')
          ) {
            reportFiles.push(filePath);
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return reportFiles;
  }

  /**
   * Save reports to files
   */
  private async saveReports(
    reports: {
      completionStatus: string;
      gapAnalysis: string;
      wbs: string;
      actionPlan: string;
    },
    outputDir: string
  ): Promise<void> {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }

    // Save each report
    await fs.promises.writeFile(
      path.join(outputDir, 'PROJECT_COMPLETION_STATUS.md'),
      reports.completionStatus,
      'utf-8'
    );

    await fs.promises.writeFile(
      path.join(outputDir, 'GAP_ANALYSIS_DETAILED.md'),
      reports.gapAnalysis,
      'utf-8'
    );

    await fs.promises.writeFile(
      path.join(outputDir, 'WBS_COMPLETE.md'),
      reports.wbs,
      'utf-8'
    );

    await fs.promises.writeFile(
      path.join(outputDir, 'ACTION_PLAN_100_PERCENT.md'),
      reports.actionPlan,
      'utf-8'
    );
  }

  /**
   * Print summary
   */
  private printSummary(result: {
    completionStatus: { overall: number; completedCount: number; pendingCount: number };
    gaps: Array<{ priority: string; title: string }>;
    wbs: { totalDuration: number; totalEffort: string };
  }): void {
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
  }
}
