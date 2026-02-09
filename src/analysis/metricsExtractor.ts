/**
 * Metrics extraction utilities
 */

import { Metric } from './types';

/**
 * Extract metrics from multiple reports and merge them
 */
export function mergeMetrics(reports: Array<{ allMetrics: Metric[] }>): Metric[] {
  const metricMap = new Map<string, Metric>();

  for (const report of reports) {
    for (const metric of report.allMetrics) {
      const existing = metricMap.get(metric.name);
      if (existing) {
        // Keep the most recent or most complete metric
        if (
          typeof metric.current === 'number' &&
          typeof existing.current === 'number'
        ) {
          // Prefer higher values or more specific data
          if (metric.status !== 'needs_measurement' && existing.status === 'needs_measurement') {
            metricMap.set(metric.name, metric);
          } else if (
            metric.status === 'needs_measurement' &&
            existing.status !== 'needs_measurement'
          ) {
            // Keep existing
          } else {
            // Use the one with more complete data
            metricMap.set(metric.name, metric);
          }
        } else {
          metricMap.set(metric.name, metric);
        }
      } else {
        metricMap.set(metric.name, metric);
      }
    }
  }

  return Array.from(metricMap.values());
}

/**
 * Find specific metrics by name pattern
 */
export function findMetricsByName(
  metrics: Metric[],
  patterns: string[]
): Metric[] {
  return metrics.filter((metric) =>
    patterns.some((pattern) =>
      metric.name.toLowerCase().includes(pattern.toLowerCase())
    )
  );
}

/**
 * Calculate overall completion percentage from metrics
 */
export function calculateOverallCompletion(metrics: Metric[]): number {
  if (metrics.length === 0) return 0;

  const completionMetrics = metrics.filter(
    (m) =>
      typeof m.current === 'number' &&
      typeof m.target === 'number' &&
      m.target > 0
  );

  if (completionMetrics.length === 0) return 0;

  const totalCompletion = completionMetrics.reduce((sum, metric) => {
    const current = metric.current as number;
    const target = metric.target as number;
    const completion = Math.min((current / target) * 100, 100);
    return sum + completion;
  }, 0);

  return totalCompletion / completionMetrics.length;
}

/**
 * Group metrics by category
 */
export function groupMetricsByCategory(metrics: Metric[]): {
  [category: string]: Metric[];
} {
  const grouped: { [category: string]: Metric[] } = {};

  for (const metric of metrics) {
    // Determine category from metric name
    let category = 'General';
    const name = metric.name.toLowerCase();

    if (name.includes('test') || name.includes('coverage')) {
      category = 'Testing';
    } else if (name.includes('security') || name.includes('owasp')) {
      category = 'Security';
    } else if (name.includes('performance') || name.includes('response')) {
      category = 'Performance';
    } else if (name.includes('data') || name.includes('quality')) {
      category = 'Data Quality';
    } else if (name.includes('production') || name.includes('readiness')) {
      category = 'Production Readiness';
    }

    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(metric);
  }

  return grouped;
}
