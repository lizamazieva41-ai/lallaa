/**
 * Trend Analyzer
 * Analyze quality trends over 30/60/90 day periods
 */

import { QualityMetrics } from './qualityCalculator';
import { logger } from '../../utils/logger';

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: Date;
  metrics: QualityMetrics;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  period: '30d' | '60d' | '90d';
  dataPoints: TrendDataPoint[];
  trends: {
    accuracy: {
      current: number;
      previous: number;
      change: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
    completeness: {
      current: number;
      previous: number;
      change: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
    freshness: {
      current: number;
      previous: number;
      change: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
    consistency: {
      current: number;
      previous: number;
      change: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
  };
  summary: {
    overallTrend: 'improving' | 'degrading' | 'stable';
    criticalIssues: string[];
    recommendations: string[];
  };
}

/**
 * Trend Analyzer
 */
export class TrendAnalyzer {
  private history: TrendDataPoint[] = [];
  private maxHistoryDays: number = 90;

  /**
   * Add metrics to history
   */
  public addMetrics(metrics: QualityMetrics): void {
    this.history.push({
      date: new Date(),
      metrics,
    });

    // Keep only last 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxHistoryDays);
    this.history = this.history.filter(point => point.date >= cutoffDate);
  }

  /**
   * Analyze trends for a period
   */
  public analyzeTrends(period: '30d' | '60d' | '90d' = '30d'): TrendAnalysis {
    const days = period === '30d' ? 30 : period === '60d' ? 60 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const periodData = this.history.filter(point => point.date >= cutoffDate);

    if (periodData.length < 2) {
      // Not enough data for trend analysis
      return this.createEmptyTrendAnalysis(period);
    }

    // Split into current and previous periods
    const midpoint = Math.floor(periodData.length / 2);
    const previousPeriod = periodData.slice(0, midpoint);
    const currentPeriod = periodData.slice(midpoint);

    const previousAvg = this.calculateAverageMetrics(previousPeriod);
    const currentAvg = this.calculateAverageMetrics(currentPeriod);

    // Calculate trends
    const trends = {
      accuracy: this.calculateTrend(
        previousAvg.overall.accuracy,
        currentAvg.overall.accuracy
      ),
      completeness: this.calculateTrend(
        previousAvg.overall.completeness,
        currentAvg.overall.completeness
      ),
      freshness: this.calculateTrend(
        previousAvg.overall.freshness,
        currentAvg.overall.freshness
      ),
      consistency: this.calculateTrend(
        previousAvg.overall.consistency,
        currentAvg.overall.consistency
      ),
    };

    // Determine overall trend
    const overallTrend = this.determineOverallTrend(trends);

    // Identify critical issues
    const criticalIssues = this.identifyCriticalIssues(currentAvg, trends);

    // Generate recommendations
    const recommendations = this.generateRecommendations(trends, criticalIssues);

    return {
      period,
      dataPoints: periodData,
      trends,
      summary: {
        overallTrend,
        criticalIssues,
        recommendations,
      },
    };
  }

  /**
   * Calculate average metrics from data points
   */
  private calculateAverageMetrics(dataPoints: TrendDataPoint[]): QualityMetrics {
    if (dataPoints.length === 0) {
      return this.createEmptyMetrics();
    }

    const sums = {
      accuracy: 0,
      completeness: 0,
      freshness: 0,
      consistency: 0,
      overallScore: 0,
    };

    for (const point of dataPoints) {
      const overall = point.metrics.overall;
      sums.accuracy += overall.accuracy;
      sums.completeness += overall.completeness;
      sums.freshness += overall.freshness;
      sums.consistency += overall.consistency;
      sums.overallScore += overall.overallScore;
    }

    const count = dataPoints.length;
    return {
      overall: {
        accuracy: sums.accuracy / count,
        completeness: sums.completeness / count,
        freshness: sums.freshness / count,
        consistency: sums.consistency / count,
        overallScore: sums.overallScore / count,
      },
      byField: dataPoints[0].metrics.byField, // Use latest field metrics
      timestamp: new Date(),
    };
  }

  /**
   * Calculate trend between two values
   */
  private calculateTrend(
    previous: number,
    current: number
  ): {
    current: number;
    previous: number;
    change: number;
    trend: 'improving' | 'degrading' | 'stable';
  } {
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (changePercent > 1) {
      trend = 'improving';
    } else if (changePercent < -1) {
      trend = 'degrading';
    }

    return {
      current,
      previous,
      change: changePercent,
      trend,
    };
  }

  /**
   * Determine overall trend
   */
  private determineOverallTrend(trends: TrendAnalysis['trends']): 'improving' | 'degrading' | 'stable' {
    const improvingCount = Object.values(trends).filter(t => t.trend === 'improving').length;
    const degradingCount = Object.values(trends).filter(t => t.trend === 'degrading').length;

    if (improvingCount > degradingCount) return 'improving';
    if (degradingCount > improvingCount) return 'degrading';
    return 'stable';
  }

  /**
   * Identify critical issues
   */
  private identifyCriticalIssues(
    metrics: QualityMetrics,
    trends: TrendAnalysis['trends']
  ): string[] {
    const issues: string[] = [];

    if (metrics.overall.accuracy < 0.95) {
      issues.push('Overall accuracy below 95% threshold');
    }

    if (metrics.overall.completeness < 0.90) {
      issues.push('Data completeness below 90% threshold');
    }

    if (metrics.overall.freshness < 0.80) {
      issues.push('Data freshness below 80% threshold - consider running ETL');
    }

    if (trends.accuracy.trend === 'degrading' && trends.accuracy.change < -5) {
      issues.push('Accuracy degrading significantly (>5% drop)');
    }

    if (trends.completeness.trend === 'degrading' && trends.completeness.change < -5) {
      issues.push('Completeness degrading significantly (>5% drop)');
    }

    return issues;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    trends: TrendAnalysis['trends'],
    criticalIssues: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (trends.accuracy.trend === 'degrading') {
      recommendations.push('Review conflict resolution rules to improve accuracy');
      recommendations.push('Consider manual verification of high-confidence conflicts');
    }

    if (trends.completeness.trend === 'degrading') {
      recommendations.push('Review data sources for missing fields');
      recommendations.push('Consider adding new data sources');
    }

    if (trends.freshness.trend === 'degrading') {
      recommendations.push('Schedule more frequent ETL runs');
      recommendations.push('Review ETL pipeline performance');
    }

    if (criticalIssues.length > 0) {
      recommendations.push('Address critical issues immediately');
    }

    if (recommendations.length === 0) {
      recommendations.push('Quality metrics are stable - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Create empty trend analysis
   */
  private createEmptyTrendAnalysis(period: '30d' | '60d' | '90d'): TrendAnalysis {
    return {
      period,
      dataPoints: [],
      trends: {
        accuracy: { current: 0, previous: 0, change: 0, trend: 'stable' },
        completeness: { current: 0, previous: 0, change: 0, trend: 'stable' },
        freshness: { current: 0, previous: 0, change: 0, trend: 'stable' },
        consistency: { current: 0, previous: 0, change: 0, trend: 'stable' },
      },
      summary: {
        overallTrend: 'stable',
        criticalIssues: ['Insufficient data for trend analysis'],
        recommendations: ['Collect more quality metrics data'],
      },
    };
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): QualityMetrics {
    return {
      overall: {
        accuracy: 0,
        completeness: 0,
        freshness: 0,
        consistency: 0,
        overallScore: 0,
      },
      byField: {
        country: { accuracy: 0, completeness: 0, freshness: 0, consistency: 0 },
        network: { accuracy: 0, completeness: 0, freshness: 0, consistency: 0 },
        issuer: { accuracy: 0, completeness: 0, freshness: 0, consistency: 0 },
        type: { accuracy: 0, completeness: 0, freshness: 0, consistency: 0 },
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get history
   */
  public getHistory(): TrendDataPoint[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.history = [];
    logger.info('Trend analyzer history cleared');
  }
}

export const trendAnalyzer = new TrendAnalyzer();
