#!/usr/bin/env node
/**
 * Baseline Measurement Script
 * Purpose: Measure current accuracy against golden set and generate baseline report
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { goldenSetManager } from '../../src/testing/goldenSet/goldenSetManager';
import { metricsCollector } from '../../src/services/accuracyMeasurement/metricsCollector';
import { AccuracyFramework } from '../../src/services/accuracyMeasurement/accuracyFramework';
import { FieldAccuracyCalculator } from '../../src/services/accuracyMeasurement/fieldAccuracy';
import { logger } from '../../src/utils/logger';

dotenv.config({ path: '.env' });

/**
 * Generate baseline report
 */
function generateBaselineReport(
  metrics: any,
  outputPath: string,
  options?: { warnings?: string[]; errors?: string[] }
): void {
  const report = {
    generatedAt: new Date().toISOString(),
    runtime: {
      warnings: options?.warnings || [],
      errors: options?.errors || [],
    },
    // Preserve the full raw metrics payload so other tooling (e.g. generateReport.ts) can build
    // higher-level reports even when we only have a single measurement available.
    metricsRaw: metrics,
    summary: {
      overallAccuracy: metrics.overall.accuracy.toFixed(2) + '%',
      totalComparisons: metrics.overall.totalComparisons,
      correctComparisons: metrics.overall.correctComparisons,
    },
    fieldAccuracies: {
      country: {
        accuracy: metrics.fields.country.accuracy.toFixed(2) + '%',
        total: metrics.fields.country.total,
        correct: metrics.fields.country.correct,
        mismatchCount: metrics.fields.country.mismatches.length,
      },
      network: {
        accuracy: metrics.fields.network.accuracy.toFixed(2) + '%',
        total: metrics.fields.network.total,
        correct: metrics.fields.network.correct,
        mismatchCount: metrics.fields.network.mismatches.length,
      },
      issuer: {
        accuracy: metrics.fields.issuer.accuracy.toFixed(2) + '%',
        total: metrics.fields.issuer.total,
        correct: metrics.fields.issuer.correct,
        mismatchCount: metrics.fields.issuer.mismatches.length,
        normalizedSimilarity:
          'normalizedSimilarity' in metrics.fields.issuer
            ? (metrics.fields.issuer.normalizedSimilarity * 100).toFixed(2) + '%'
            : 'N/A',
      },
      type: {
        accuracy: metrics.fields.type.accuracy.toFixed(2) + '%',
        total: metrics.fields.type.total,
        correct: metrics.fields.type.correct,
        mismatchCount: metrics.fields.type.mismatches.length,
      },
    },
    accuracyGaps: AccuracyFramework.identifyAccuracyGaps(metrics),
    mismatchPatterns: FieldAccuracyCalculator.analyzeMismatchPatterns(metrics),
    recommendations: [
      ...AccuracyFramework.identifyAccuracyGaps(metrics).map(gap => gap.recommendation),
      ...FieldAccuracyCalculator.analyzeMismatchPatterns(metrics).recommendations,
    ],
  };

  // Write report to file
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  logger.info('Baseline report generated', { outputPath });

  // Also generate markdown report
  const markdownPath = outputPath.replace('.json', '.md');
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(markdownPath, markdownReport, 'utf-8');
  logger.info('Markdown baseline report generated', { markdownPath });
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: any): string {
  return `# Baseline Accuracy Measurement Report

Generated: ${report.generatedAt}

## Summary

- **Overall Accuracy**: ${report.summary.overallAccuracy}
- **Total Comparisons**: ${report.summary.totalComparisons}
- **Correct Comparisons**: ${report.summary.correctComparisons}

## Field-Specific Accuracies

### Country
- **Accuracy**: ${report.fieldAccuracies.country.accuracy}
- **Total**: ${report.fieldAccuracies.country.total}
- **Correct**: ${report.fieldAccuracies.country.correct}
- **Mismatches**: ${report.fieldAccuracies.country.mismatchCount}

### Network
- **Accuracy**: ${report.fieldAccuracies.network.accuracy}
- **Total**: ${report.fieldAccuracies.network.total}
- **Correct**: ${report.fieldAccuracies.network.correct}
- **Mismatches**: ${report.fieldAccuracies.network.mismatchCount}

### Issuer
- **Accuracy**: ${report.fieldAccuracies.issuer.accuracy}
- **Total**: ${report.fieldAccuracies.issuer.total}
- **Correct**: ${report.fieldAccuracies.issuer.correct}
- **Mismatches**: ${report.fieldAccuracies.issuer.mismatchCount}
- **Normalized Similarity**: ${report.fieldAccuracies.issuer.normalizedSimilarity}

### Type
- **Accuracy**: ${report.fieldAccuracies.type.accuracy}
- **Total**: ${report.fieldAccuracies.type.total}
- **Correct**: ${report.fieldAccuracies.type.correct}
- **Mismatches**: ${report.fieldAccuracies.type.mismatchCount}

## Accuracy Gaps

${report.accuracyGaps.length > 0 ? report.accuracyGaps.map((gap: any) => `
### ${gap.field}
- **Current**: ${gap.currentAccuracy.toFixed(2)}%
- **Target**: ${gap.targetAccuracy}%
- **Gap**: ${gap.gap.toFixed(2)}%
- **Recommendation**: ${gap.recommendation}
`).join('\n') : 'No accuracy gaps identified.'}

## Recommendations

${report.recommendations.map((rec: string, idx: number) => `${idx + 1}. ${rec}`).join('\n')}

## Mismatch Patterns

${report.mismatchPatterns.patterns.length > 0 ? report.mismatchPatterns.patterns.slice(0, 20).map((pattern: any) => `
### ${pattern.field}: ${pattern.pattern}
- **Frequency**: ${pattern.frequency}
- **Examples**: ${pattern.examples.join(', ')}
`).join('\n') : 'No significant mismatch patterns identified.'}
`;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const goldenSetFile =
    args.find(a => a.startsWith('--golden-set='))?.split('=')[1] || 'golden-set.json';
  const outputFile =
    args.find(a => a.startsWith('--output='))?.split('=')[1] || 'baseline-report.json';
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(process.cwd(), outputFile);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    logger.info('Starting baseline measurement...', { goldenSetFile, outputPath });

    // Load golden set
    await goldenSetManager.loadFromFile(goldenSetFile);
    const records = goldenSetManager.getAllRecords();

    if (records.length === 0) {
      logger.error('No golden set records found. Please generate golden set first.');
      process.exit(1);
    }

    logger.info(`Loaded ${records.length} golden set records`);

    // Collect metrics
    let metrics: any;
    const runtimeErrors: string[] = [];
    const runtimeWarnings: string[] = [];
    try {
      metrics = await metricsCollector.collectMetrics(records);
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      runtimeErrors.push(`Failed to collect live metrics (DB/service unavailable?): ${msg}`);
      logger.warn('Falling back to empty baseline metrics due to runtime error', { error: msg });
      metrics = {
        fields: {
          country: { total: 0, correct: 0, accuracy: 0, mismatches: [] },
          network: { total: 0, correct: 0, accuracy: 0, mismatches: [] },
          issuer: { total: 0, correct: 0, accuracy: 0, mismatches: [], normalizedSimilarity: 0 },
          type: { total: 0, correct: 0, accuracy: 0, mismatches: [] },
        },
        overall: { totalComparisons: 0, correctComparisons: 0, accuracy: 0 },
        timestamp: new Date(),
      };
    }

    // Generate report
    generateBaselineReport(metrics, outputPath, { warnings: runtimeWarnings, errors: runtimeErrors });

    // Print summary
    logger.info('Baseline measurement completed', {
      overallAccuracy: metrics.overall.accuracy.toFixed(2) + '%',
      fieldAccuracies: {
        country: metrics.fields.country.accuracy.toFixed(2) + '%',
        network: metrics.fields.network.accuracy.toFixed(2) + '%',
        issuer: metrics.fields.issuer.accuracy.toFixed(2) + '%',
        type: metrics.fields.type.accuracy.toFixed(2) + '%',
      },
    });

    // Print accuracy gaps
    const gaps = AccuracyFramework.identifyAccuracyGaps(metrics);
    if (gaps.length > 0) {
      logger.warn('Accuracy gaps identified', {
        gaps: gaps.map(g => ({
          field: g.field,
          current: g.currentAccuracy.toFixed(2) + '%',
          target: g.targetAccuracy + '%',
          gap: g.gap.toFixed(2) + '%',
        })),
      });
    }

    process.exit(0);
  } catch (error) {
    logger.error('Baseline measurement failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in baseline measurement', { error });
    process.exit(1);
  });
}

export { generateBaselineReport, generateMarkdownReport };
