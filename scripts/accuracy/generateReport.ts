#!/usr/bin/env node
/**
 * Accuracy Report Generation Script
 * Purpose: Generate accuracy reports from collected metrics
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { metricsCollector } from '../../src/services/accuracyMeasurement/metricsCollector';
import { logger } from '../../src/utils/logger';

dotenv.config({ path: '.env' });

/**
 * Generate accuracy report from metrics history
 */
function generateReport(outputPath: string, baselinePath?: string): void {
  const history = metricsCollector.getHistory();
  const aggregated = metricsCollector.getAggregatedMetrics();

  if (history.length === 0) {
    // Fallback: load baseline report (which contains metricsRaw) and build a single-point report.
    const fallbackPath =
      baselinePath || path.join(path.dirname(outputPath), 'baseline-report.json');
    if (!fs.existsSync(fallbackPath)) {
      logger.warn('No metrics history available and no baseline report found. Run baseline measurement first.', {
        fallbackPath,
      });
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    const latest = baseline.metricsRaw || null;
    if (!latest) {
      logger.warn('Baseline report found but missing metricsRaw; re-run baseline measurement.', {
        fallbackPath,
      });
      return;
    }

    const report = {
      generatedAt: new Date().toISOString(),
      source: { type: 'baseline-file', path: fallbackPath },
      summary: {
        totalMeasurements: 1,
        averageAccuracy: latest.overall.accuracy.toFixed(2) + '%',
        trends: [],
      },
      latest,
      history: [
        {
          timestamp: new Date(latest.timestamp).toISOString(),
          overall: latest.overall,
          fieldAccuracies: {
            country: latest.fields.country.accuracy.toFixed(2) + '%',
            network: latest.fields.network.accuracy.toFixed(2) + '%',
            issuer: latest.fields.issuer.accuracy.toFixed(2) + '%',
            type: latest.fields.type.accuracy.toFixed(2) + '%',
          },
        },
      ],
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    logger.info('Accuracy report generated (baseline fallback)', { outputPath });

    const markdownPath = outputPath.replace('.json', '.md');
    const markdownReport = generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownReport, 'utf-8');
    logger.info('Markdown accuracy report generated (baseline fallback)', { markdownPath });
    return;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalMeasurements: history.length,
      averageAccuracy: aggregated.average.accuracy.toFixed(2) + '%',
      trends: aggregated.trends,
    },
    latest: history[history.length - 1],
    history: history.map(m => ({
      timestamp: m.timestamp.toISOString(),
      overall: m.overall,
      fieldAccuracies: {
        country: m.fields.country.accuracy.toFixed(2) + '%',
        network: m.fields.network.accuracy.toFixed(2) + '%',
        issuer: m.fields.issuer.accuracy.toFixed(2) + '%',
        type: m.fields.type.accuracy.toFixed(2) + '%',
      },
    })),
  };

  // Write JSON report
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  logger.info('Accuracy report generated', { outputPath });

  // Generate markdown report
  const markdownPath = outputPath.replace('.json', '.md');
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(markdownPath, markdownReport, 'utf-8');
  logger.info('Markdown accuracy report generated', { markdownPath });
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: any): string {
  return `# Accuracy Report

Generated: ${report.generatedAt}

## Summary

- **Total Measurements**: ${report.summary.totalMeasurements}
- **Average Accuracy**: ${report.summary.averageAccuracy}

## Trends

${report.summary.trends.length > 0 ? report.summary.trends.map((trend: any) => `
### ${trend.field}
- **Trend**: ${trend.trend}
- **Change**: ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(2)}%
`).join('\n') : 'No trend data available.'}

## Latest Measurement

- **Overall Accuracy**: ${report.latest.overall.accuracy.toFixed(2)}%
- **Total Comparisons**: ${report.latest.overall.totalComparisons}
- **Correct Comparisons**: ${report.latest.overall.correctComparisons}

### Field Accuracies

- **Country**: ${report.latest.fields.country.accuracy.toFixed(2)}%
- **Network**: ${report.latest.fields.network.accuracy.toFixed(2)}%
- **Issuer**: ${report.latest.fields.issuer.accuracy.toFixed(2)}%
- **Type**: ${report.latest.fields.type.accuracy.toFixed(2)}%

## History

${report.history.slice(-10).map((h: any) => `
### ${new Date(h.timestamp).toLocaleString()}
- **Overall**: ${h.overall.accuracy.toFixed(2)}%
- **Country**: ${h.fieldAccuracies.country}
- **Network**: ${h.fieldAccuracies.network}
- **Issuer**: ${h.fieldAccuracies.issuer}
- **Type**: ${h.fieldAccuracies.type}
`).join('\n')}
`;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'accuracy-report.json';
  const baselineFile = args.find(a => a.startsWith('--baseline='))?.split('=')[1];
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(process.cwd(), outputFile);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    logger.info('Generating accuracy report...', { outputPath });
    generateReport(outputPath, baselineFile);
    process.exit(0);
  } catch (error) {
    logger.error('Report generation failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in report generation', { error });
    process.exit(1);
  });
}

export { generateReport, generateMarkdownReport };
