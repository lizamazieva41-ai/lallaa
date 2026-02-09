import { AccuracyFramework, AccuracyMetrics, FieldAccuracyMetrics } from './accuracyFramework';
import { FieldAccuracyCalculator } from './fieldAccuracy';
import { GoldenSetRecord } from '../../testing/goldenSet/goldenSetTypes';
import { BINLookupResult } from '../../types';
import { binService } from '../bin';
import { logger } from '../../utils/logger';

/**
 * Metrics Collector - Collect and aggregate accuracy metrics
 */
export class MetricsCollector {
  private metricsHistory: AccuracyMetrics[] = [];
  private maxHistorySize: number = 100;

  /**
   * Collect accuracy metrics for golden set records
   */
  public async collectMetrics(
    goldenSetRecords: GoldenSetRecord[]
  ): Promise<AccuracyMetrics> {
    logger.info('Collecting accuracy metrics...', { recordCount: goldenSetRecords.length });

    // Perform lookups for all BINs in golden set
    const lookupResults = new Map<string, BINLookupResult | null>();
    const bins = goldenSetRecords.map(r => r.bin);

    logger.info(`Performing ${bins.length} BIN lookups...`);
    const batchResults = await binService.lookupBatch(bins);

    batchResults.forEach((result, bin) => {
      lookupResults.set(bin, result);
    });

    logger.info(`Completed ${lookupResults.size} lookups`);

    // Calculate accuracy metrics
    const metrics = AccuracyFramework.calculateAccuracyMetrics(
      goldenSetRecords,
      lookupResults
    );

    // Store in history
    this.addToHistory(metrics);

    return metrics;
  }

  /**
   * Collect field-specific metrics
   */
  public async collectFieldMetrics(
    goldenSetRecords: GoldenSetRecord[]
  ): Promise<FieldAccuracyMetrics> {
    logger.info('Collecting field-specific metrics...');

    // Perform lookups
    const lookupResults = new Map<string, BINLookupResult | null>();
    const bins = goldenSetRecords.map(r => r.bin);
    const batchResults = await binService.lookupBatch(bins);

    batchResults.forEach((result, bin) => {
      lookupResults.set(bin, result);
    });

    // Calculate field accuracies
    return FieldAccuracyCalculator.calculateAllFieldAccuracies(
      goldenSetRecords,
      lookupResults
    );
  }

  /**
   * Get aggregated metrics over time period
   */
  public getAggregatedMetrics(
    startDate?: Date,
    endDate?: Date
  ): {
    average: AccuracyMetrics['overall'];
    trends: {
      field: keyof FieldAccuracyMetrics;
      trend: 'improving' | 'degrading' | 'stable';
      change: number;
    }[];
  } {
    let filteredHistory = this.metricsHistory;

    if (startDate || endDate) {
      filteredHistory = this.metricsHistory.filter(metrics => {
        const metricsDate = metrics.timestamp;
        if (startDate && metricsDate < startDate) return false;
        if (endDate && metricsDate > endDate) return false;
        return true;
      });
    }

    if (filteredHistory.length === 0) {
      return {
        average: {
          totalComparisons: 0,
          correctComparisons: 0,
          accuracy: 0,
        },
        trends: [],
      };
    }

    // Calculate average
    const totalComparisons = filteredHistory.reduce(
      (sum, m) => sum + m.overall.totalComparisons,
      0
    );
    const correctComparisons = filteredHistory.reduce(
      (sum, m) => sum + m.overall.correctComparisons,
      0
    );

    const average = {
      totalComparisons: Math.round(totalComparisons / filteredHistory.length),
      correctComparisons: Math.round(correctComparisons / filteredHistory.length),
      accuracy: totalComparisons > 0 ? (correctComparisons / totalComparisons) * 100 : 0,
    };

    // Calculate trends
    const trends: Array<{
      field: keyof FieldAccuracyMetrics;
      trend: 'improving' | 'degrading' | 'stable';
      change: number;
    }> = [];

    if (filteredHistory.length >= 2) {
      const first = filteredHistory[0];
      const last = filteredHistory[filteredHistory.length - 1];

      (Object.keys(first.fields) as Array<keyof FieldAccuracyMetrics>).forEach(field => {
        const firstAccuracy = first.fields[field].accuracy;
        const lastAccuracy = last.fields[field].accuracy;
        const change = lastAccuracy - firstAccuracy;

        let trend: 'improving' | 'degrading' | 'stable';
        if (change > 1) {
          trend = 'improving';
        } else if (change < -1) {
          trend = 'degrading';
        } else {
          trend = 'stable';
        }

        trends.push({ field, trend, change });
      });
    }

    return { average, trends };
  }

  /**
   * Get metrics history
   */
  public getHistory(): AccuracyMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get latest metrics
   */
  public getLatestMetrics(): AccuracyMetrics | null {
    return this.metricsHistory.length > 0
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: AccuracyMetrics): void {
    this.metricsHistory.push(metrics);

    // Limit history size
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Clear metrics history
   */
  public clearHistory(): void {
    this.metricsHistory = [];
    logger.info('Cleared metrics history');
  }

  /**
   * Export metrics to JSON
   */
  public exportMetrics(): string {
    return JSON.stringify(
      {
        history: this.metricsHistory,
        aggregated: this.getAggregatedMetrics(),
      },
      null,
      2
    );
  }
}

export const metricsCollector = new MetricsCollector();
