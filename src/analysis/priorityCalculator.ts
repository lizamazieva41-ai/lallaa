/**
 * Priority Calculator - Calculate priorities and risk levels
 */

import { Priority, RiskLevel } from './types';
import { IPriorityCalculator } from './interfaces';

export class PriorityCalculator implements IPriorityCalculator {
  /**
   * Calculate priority based on multiple factors
   */
  calculatePriority(
    category: string,
    riskLevel: RiskLevel,
    impact: string
  ): Priority {
    // Security-related items are always high priority
    if (
      category.toLowerCase().includes('security') ||
      category.toLowerCase().includes('owasp') ||
      category.toLowerCase().includes('vulnerability')
    ) {
      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        return 'CRITICAL';
      }
      return 'HIGH';
    }

    // Test coverage is high priority
    if (
      category.toLowerCase().includes('test') ||
      category.toLowerCase().includes('coverage')
    ) {
      return 'HIGH';
    }

    // Performance is medium priority
    if (category.toLowerCase().includes('performance')) {
      return 'MEDIUM';
    }

    // Documentation is low priority
    if (category.toLowerCase().includes('documentation')) {
      return 'LOW';
    }

    // Map risk level to priority
    switch (riskLevel) {
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
   * Determine risk level
   */
  determineRiskLevel(
    severity: string,
    probability: string,
    impact: string
  ): RiskLevel {
    const severityUpper = severity.toUpperCase();
    const probabilityUpper = probability.toUpperCase();
    const impactUpper = impact.toUpperCase();

    // Critical if severity is critical or high with high probability
    if (
      severityUpper.includes('CRITICAL') ||
      (severityUpper.includes('HIGH') &&
        probabilityUpper.includes('HIGH') &&
        impactUpper.includes('HIGH'))
    ) {
      return 'CRITICAL';
    }

    // High if severity is high or medium with high impact
    if (
      severityUpper.includes('HIGH') ||
      (severityUpper.includes('MEDIUM') && impactUpper.includes('HIGH'))
    ) {
      return 'HIGH';
    }

    // Medium if severity is medium
    if (severityUpper.includes('MEDIUM')) {
      return 'MEDIUM';
    }

    // Default to low
    return 'LOW';
  }

  /**
   * Estimate effort based on priority and category
   */
  estimateEffort(
    priority: Priority,
    category: string
  ): { days: number; weeks: number; description: string } {
    const categoryLower = category.toLowerCase();

    // Security fixes typically take 1-2 weeks
    if (categoryLower.includes('security')) {
      if (priority === 'CRITICAL') {
        return { days: 7, weeks: 1, description: '1 week' };
      }
      return { days: 14, weeks: 2, description: '2 weeks' };
    }

    // Test coverage improvements take 2-4 weeks
    if (categoryLower.includes('test') || categoryLower.includes('coverage')) {
      if (priority === 'HIGH') {
        return { days: 14, weeks: 2, description: '2 weeks' };
      }
      return { days: 28, weeks: 4, description: '4 weeks' };
    }

    // Performance optimization takes 2-3 weeks
    if (categoryLower.includes('performance')) {
      return { days: 14, weeks: 2, description: '2 weeks' };
    }

    // Documentation takes 1 week
    if (categoryLower.includes('documentation')) {
      return { days: 5, weeks: 1, description: '1 week' };
    }

    // Default estimates based on priority
    switch (priority) {
      case 'CRITICAL':
        return { days: 7, weeks: 1, description: '1 week' };
      case 'HIGH':
        return { days: 14, weeks: 2, description: '2 weeks' };
      case 'MEDIUM':
        return { days: 14, weeks: 2, description: '2 weeks' };
      case 'LOW':
        return { days: 5, weeks: 1, description: '1 week' };
      default:
        return { days: 10, weeks: 1.5, description: '1.5 weeks' };
    }
  }
}
