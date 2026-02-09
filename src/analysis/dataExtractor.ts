/**
 * Data Extractor - Extract specific data from parsed reports
 */

import {
  ParsedReport,
  CompletionStatus,
  Metric,
  Priority,
} from './types';
import { IDataExtractor } from './interfaces';
import {
  mergeMetrics,
  findMetricsByName,
  calculateOverallCompletion,
  groupMetricsByCategory,
} from './metricsExtractor';

export class DataExtractor implements IDataExtractor {
  /**
   * Extract completion status from parsed reports
   */
  extractCompletionStatus(reports: ParsedReport[]): CompletionStatus {
    // Extract all metrics
    const allMetrics = mergeMetrics(reports);

    // Calculate overall completion
    const overall = calculateOverallCompletion(allMetrics);

    // Group metrics by category
    const byCategory = groupMetricsByCategory(allMetrics);
    const categoryCompletion: { [category: string]: number } = {};

    for (const [category, metrics] of Object.entries(byCategory)) {
      categoryCompletion[category] = calculateOverallCompletion(metrics);
    }

    // Count completed and pending items
    let completedCount = 0;
    let pendingCount = 0;

    for (const report of reports) {
      completedCount += report.completedItems.length;
      pendingCount += report.pendingItems.length;
    }

    const totalCount = completedCount + pendingCount;

    return {
      overall,
      byCategory: categoryCompletion,
      metrics: allMetrics,
      completedCount,
      pendingCount,
      totalCount,
    };
  }

  /**
   * Extract metrics from parsed reports
   */
  extractMetrics(reports: ParsedReport[]): Metric[] {
    return mergeMetrics(reports);
  }

  /**
   * Extract completed items from parsed reports
   */
  extractCompletedItems(reports: ParsedReport[]): Array<{
    id: string;
    description: string;
    category: string;
  }> {
    const items: Array<{
      id: string;
      description: string;
      category: string;
    }> = [];

    for (const report of reports) {
      for (const item of report.completedItems) {
        items.push({
          id: item.id,
          description: item.description,
          category: item.category,
        });
      }
    }

    // Remove duplicates based on description
    const uniqueItems = new Map<string, typeof items[0]>();
    for (const item of items) {
      const key = item.description.toLowerCase().trim();
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, item);
      }
    }

    return Array.from(uniqueItems.values());
  }

  /**
   * Extract pending items from parsed reports
   */
  extractPendingItems(reports: ParsedReport[]): Array<{
    id: string;
    description: string;
    category: string;
    priority: Priority;
  }> {
    const items: Array<{
      id: string;
      description: string;
      category: string;
      priority: Priority;
    }> = [];

    for (const report of reports) {
      for (const item of report.pendingItems) {
        items.push({
          id: item.id,
          description: item.description,
          category: item.category,
          priority: item.priority,
        });
      }
    }

    // Remove duplicates based on description
    const uniqueItems = new Map<string, typeof items[0]>();
    for (const item of items) {
      const key = item.description.toLowerCase().trim();
      if (!uniqueItems.has(key) || this.isHigherPriority(item.priority, uniqueItems.get(key)!.priority)) {
        uniqueItems.set(key, item);
      }
    }

    return Array.from(uniqueItems.values());
  }

  /**
   * Check if priority1 is higher than priority2
   */
  private isHigherPriority(
    priority1: Priority,
    priority2: Priority
  ): boolean {
    const order: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    return order.indexOf(priority1) < order.indexOf(priority2);
  }

  /**
   * Extract specific metrics by name patterns
   */
  extractSpecificMetrics(
    reports: ParsedReport[],
    patterns: string[]
  ): Metric[] {
    const allMetrics = this.extractMetrics(reports);
    return findMetricsByName(allMetrics, patterns);
  }

  /**
   * Extract key metrics (test coverage, OWASP compliance, etc.)
   */
  extractKeyMetrics(reports: ParsedReport[]): {
    testCoverage?: Metric;
    owaspCompliance?: Metric;
    securityScore?: Metric;
    productionReadiness?: Metric;
  } {
    const allMetrics = this.extractMetrics(reports);

    const testCoverage = allMetrics.find(
      (m) =>
        m.name.toLowerCase().includes('test') &&
        m.name.toLowerCase().includes('coverage')
    );

    const owaspCompliance = allMetrics.find(
      (m) =>
        m.name.toLowerCase().includes('owasp') ||
        m.name.toLowerCase().includes('compliance')
    );

    const securityScore = allMetrics.find(
      (m) =>
        m.name.toLowerCase().includes('security') &&
        m.name.toLowerCase().includes('score')
    );

    const productionReadiness = allMetrics.find(
      (m) =>
        m.name.toLowerCase().includes('production') &&
        (m.name.toLowerCase().includes('readiness') ||
          m.name.toLowerCase().includes('ready'))
    );

    return {
      testCoverage,
      owaspCompliance,
      securityScore,
      productionReadiness,
    };
  }
}
