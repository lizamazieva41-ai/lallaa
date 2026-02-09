/**
 * Gap Analyzer - Analyze gaps between current and target states
 */

import {
  CompletionStatus,
  Metric,
  Gap,
  Priority,
  RiskLevel,
} from './types';
import { IGapAnalyzer } from './interfaces';
import { PriorityCalculator } from './priorityCalculator';

interface PendingItem {
  id: string;
  description: string;
  category: string;
  priority: Priority;
}

export class GapAnalyzer implements IGapAnalyzer {
  private priorityCalculator: PriorityCalculator;

  constructor() {
    this.priorityCalculator = new PriorityCalculator();
  }

  /**
   * Analyze gaps between current and target states
   */
  analyzeGaps(
    completionStatus: CompletionStatus,
    metrics: Metric[],
    pendingItems: PendingItem[]
  ): Gap[] {
    const gaps: Gap[] = [];

    // Analyze metric gaps
    for (const metric of metrics) {
      if (
        typeof metric.current === 'number' &&
        typeof metric.target === 'number'
      ) {
        const current = metric.current;
        const target = metric.target;

        if (current < target) {
          const gap = this.createGapFromMetric(metric, current, target);
          gaps.push(gap);
        }
      }
    }

    // Analyze pending items as gaps
    for (const item of pendingItems) {
      const gap = this.createGapFromPendingItem(item);
      gaps.push(gap);
    }

    // Remove duplicates
    return this.deduplicateGaps(gaps);
  }

  /**
   * Create gap from metric
   */
  private createGapFromMetric(
    metric: Metric,
    current: number,
    target: number
  ): Gap {
    const category = this.determineCategory(metric.name);
    const priority = this.determinePriorityFromMetric(metric, category);
    const riskLevel = this.determineRiskLevelFromMetric(metric, category);
    const effort = this.priorityCalculator.estimateEffort(priority, category);

    return {
      id: `gap-${metric.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Improve ${metric.name}`,
      description: `Current: ${current}${metric.unit || ''}, Target: ${target}${metric.unit || ''}. Need to improve by ${(target - current).toFixed(2)}${metric.unit || ''}.`,
      category,
      currentValue: current,
      targetValue: target,
      priority,
      effort: effort.description,
      dependencies: [],
      riskLevel,
      estimatedDays: effort.days,
      estimatedWeeks: effort.weeks,
    };
  }

  /**
   * Create gap from pending item
   */
  private createGapFromPendingItem(item: PendingItem): Gap {
    const effort = this.priorityCalculator.estimateEffort(
      item.priority,
      item.category
    );
    const riskLevel = this.determineRiskLevelFromPriority(item.priority);

    return {
      id: item.id,
      title: item.description,
      description: item.description,
      category: item.category,
      currentValue: 0,
      targetValue: 100,
      priority: item.priority,
      effort: effort.description,
      dependencies: [],
      riskLevel,
      estimatedDays: effort.days,
      estimatedWeeks: effort.weeks,
    };
  }

  /**
   * Determine category from name
   */
  private determineCategory(name: string): string {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('test') || nameLower.includes('coverage')) {
      return 'Testing';
    }
    if (nameLower.includes('security') || nameLower.includes('owasp')) {
      return 'Security';
    }
    if (nameLower.includes('performance')) {
      return 'Performance';
    }
    if (nameLower.includes('data') || nameLower.includes('quality')) {
      return 'Data Quality';
    }
    if (nameLower.includes('production') || nameLower.includes('readiness')) {
      return 'Production Readiness';
    }

    return 'General';
  }

  /**
   * Determine priority from metric
   */
  private determinePriorityFromMetric(
    metric: Metric,
    category: string
  ): Priority {
    // Security metrics are critical
    if (category === 'Security') {
      return 'CRITICAL';
    }

    // Test coverage is high priority
    if (category === 'Testing') {
      return 'HIGH';
    }

    // Production readiness is high priority
    if (category === 'Production Readiness') {
      return 'HIGH';
    }

    // Performance is medium
    if (category === 'Performance') {
      return 'MEDIUM';
    }

    // Default based on gap size
    if (
      typeof metric.current === 'number' &&
      typeof metric.target === 'number'
    ) {
      const gap = metric.target - metric.current;
      const gapPercent = (gap / metric.target) * 100;

      if (gapPercent > 50) {
        return 'HIGH';
      }
      if (gapPercent > 25) {
        return 'MEDIUM';
      }
      return 'LOW';
    }

    return 'MEDIUM';
  }

  /**
   * Determine risk level from metric
   */
  private determineRiskLevelFromMetric(
    metric: Metric,
    category: string
  ): RiskLevel {
    if (category === 'Security') {
      return 'CRITICAL';
    }

    if (category === 'Testing' || category === 'Production Readiness') {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  /**
   * Determine risk level from priority
   */
  private determineRiskLevelFromPriority(priority: Priority): RiskLevel {
    switch (priority) {
      case 'CRITICAL':
        return 'CRITICAL';
      case 'HIGH':
        return 'HIGH';
      case 'MEDIUM':
        return 'MEDIUM';
      case 'LOW':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  /**
   * Deduplicate gaps
   */
  private deduplicateGaps(gaps: Gap[]): Gap[] {
    const uniqueGaps = new Map<string, Gap>();

    for (const gap of gaps) {
      const key = gap.title.toLowerCase().trim();
      if (!uniqueGaps.has(key)) {
        uniqueGaps.set(key, gap);
      } else {
        // Keep the one with higher priority
        const existing = uniqueGaps.get(key)!;
        if (this.isHigherPriority(gap.priority, existing.priority)) {
          uniqueGaps.set(key, gap);
        }
      }
    }

    return Array.from(uniqueGaps.values());
  }

  /**
   * Check if priority1 is higher than priority2
   */
  private isHigherPriority(priority1: Priority, priority2: Priority): boolean {
    const order: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    return order.indexOf(priority1) < order.indexOf(priority2);
  }

  /**
   * Classify gaps by priority
   */
  classifyByPriority(gaps: Gap[]): {
    CRITICAL: Gap[];
    HIGH: Gap[];
    MEDIUM: Gap[];
    LOW: Gap[];
  } {
    const classified = {
      CRITICAL: [] as Gap[],
      HIGH: [] as Gap[],
      MEDIUM: [] as Gap[],
      LOW: [] as Gap[],
    };

    for (const gap of gaps) {
      classified[gap.priority].push(gap);
    }

    return classified;
  }

  /**
   * Estimate effort for gaps
   */
  estimateEffort(gap: Gap): {
    days: number;
    weeks: number;
    description: string;
  } {
    return this.priorityCalculator.estimateEffort(gap.priority, gap.category);
  }
}
