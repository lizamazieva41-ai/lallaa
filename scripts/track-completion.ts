#!/usr/bin/env ts-node

/**
 * Track completion status over time
 * Run periodically to track project completion trends
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../src/analysis/analyzer';

interface CompletionHistory {
  date: string;
  overall: number;
  byCategory: { [category: string]: number };
  gaps: number;
  criticalGaps: number;
  highGaps: number;
  mediumGaps: number;
  lowGaps: number;
}

async function trackCompletion(): Promise<void> {
  console.log('📊 Tracking Project Completion...\n');

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
  ]
    .map((f) => path.join(process.cwd(), f))
    .filter((f) => fs.existsSync(f));

  if (reportFiles.length === 0) {
    console.error('❌ No report files found!');
    process.exit(1);
  }

  // Run analysis
  const result = await analyzer.analyze(reportFiles);

  // Load history
  const historyFile = path.join(process.cwd(), 'reports', 'completion-history.json');
  let history: CompletionHistory[] = [];

  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
  }

  // Add current entry
  const byPriority = {
    CRITICAL: result.gaps.filter((g) => g.priority === 'CRITICAL'),
    HIGH: result.gaps.filter((g) => g.priority === 'HIGH'),
    MEDIUM: result.gaps.filter((g) => g.priority === 'MEDIUM'),
    LOW: result.gaps.filter((g) => g.priority === 'LOW'),
  };

  history.push({
    date: new Date().toISOString().split('T')[0],
    overall: result.completionStatus.overall,
    byCategory: result.completionStatus.byCategory,
    gaps: result.gaps.length,
    criticalGaps: byPriority.CRITICAL.length,
    highGaps: byPriority.HIGH.length,
    mediumGaps: byPriority.MEDIUM.length,
    lowGaps: byPriority.LOW.length,
  });

  // Keep last 52 weeks (1 year)
  if (history.length > 52) {
    history = history.slice(-52);
  }

  // Save history
  const reportsDir = path.dirname(historyFile);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

  // Generate trend report
  generateTrendReport(history, result);

  console.log('✅ Completion tracked successfully!');
  console.log(`📈 History: ${history.length} entries`);
  console.log(`📄 Trend report: reports/completion-trend.md\n`);
}

function generateTrendReport(
  history: CompletionHistory[],
  current: { completionStatus: { overall: number }; gaps: Array<{ priority: string }> }
): void {
  let report = `# Completion Trend Report\n\n`;
  report += `**Generated**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `**Current Completion**: ${current.completionStatus.overall.toFixed(1)}%\n\n`;

  if (history.length === 0) {
    report += `No historical data available yet.\n`;
    const trendFile = path.join(process.cwd(), 'reports', 'completion-trend.md');
    fs.writeFileSync(trendFile, report);
    return;
  }

  report += `## Overall Completion Trend\n\n`;
  report += `| Date | Overall | Gaps | Critical | High | Medium | Low |\n`;
  report += `|------|---------|------|----------|------|--------|-----|\n`;

  for (const entry of history) {
    report += `| ${entry.date} | ${entry.overall.toFixed(1)}% | ${entry.gaps} | ${entry.criticalGaps} | ${entry.highGaps} | ${entry.mediumGaps} | ${entry.lowGaps} |\n`;
  }

  // Calculate trends
  if (history.length >= 2) {
    const first = history[0];
    const last = history[history.length - 1];
    const improvement = last.overall - first.overall;
    const gapReduction = first.gaps - last.gaps;

    report += `\n## Trends\n\n`;
    report += `- **Completion Change**: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%\n`;
    report += `- **Gap Reduction**: ${gapReduction > 0 ? '-' : '+'}${Math.abs(gapReduction)} gaps\n`;
    report += `- **Time Period**: ${history.length} ${history.length === 1 ? 'entry' : 'entries'}\n`;

    if (improvement > 0) {
      report += `- **Trend**: 📈 Improving\n`;
    } else if (improvement < 0) {
      report += `- **Trend**: 📉 Declining\n`;
    } else {
      report += `- **Trend**: ➡️ Stable\n`;
    }
  }

  // Category trends
  if (history.length >= 2) {
    report += `\n## Category Trends\n\n`;
    const first = history[0];
    const last = history[history.length - 1];

    report += `| Category | Start | Current | Change |\n`;
    report += `|----------|-------|---------|--------|\n`;

    const allCategories = new Set([
      ...Object.keys(first.byCategory),
      ...Object.keys(last.byCategory),
    ]);

    for (const category of allCategories) {
      const start = first.byCategory[category] || 0;
      const current = last.byCategory[category] || 0;
      const change = current - start;
      const changeStr = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      report += `| ${category} | ${start.toFixed(1)}% | ${current.toFixed(1)}% | ${changeStr} |\n`;
    }
  }

  // Save trend report
  const trendFile = path.join(process.cwd(), 'reports', 'completion-trend.md');
  fs.writeFileSync(trendFile, report);
}

if (require.main === module) {
  trackCompletion().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
