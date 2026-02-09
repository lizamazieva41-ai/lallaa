/**
 * Anomaly Detector
 * Detect quality degradation, completeness drops, performance issues
 */

import { QualityMetrics } from '../services/qualityMetrics/qualityCalculator';
import { TrendAnalysis } from '../services/qualityMetrics/trendAnalyzer';
import { logger } from '../utils/logger';

/**
 * Anomaly type
 */
export type AnomalyType =
  | 'accuracy-drop'
  | 'completeness-drop'
  | 'freshness-degradation'
  | 'consistency-issue'
  | 'performance-degradation'
  | 'data-quality-issue';

/**
 * Anomaly severity
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Anomaly
 */
export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  detectedAt: Date;
  metrics: {
    current: number;
    threshold: number;
    change?: number;
  };
  recommendations: string[];
}

/**
 * Anomaly Detection Result
 */
export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  summary: {
    total: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<AnomalyType, number>;
  };
  timestamp: Date;
}

/**
 * Anomaly Detector
 */
export class AnomalyDetector {
  private thresholds = {
    accuracy: {
      warning: 0.95,
      critical: 0.90,
    },
    completeness: {
      warning: 0.90,
      critical: 0.85,
    },
    freshness: {
      warning: 0.80,
      critical: 0.70,
    },
    consistency: {
      warning: 0.85,
      critical: 0.80,
    },
    performance: {
      warning: 100, // ms
      critical: 200, // ms
    },
  };

  /**
   * Detect anomalies in quality metrics
   */
  public detectAnomalies(
    currentMetrics: QualityMetrics,
    trendAnalysis?: TrendAnalysis
  ): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];

    // Check accuracy
    if (currentMetrics.overall.accuracy < this.thresholds.accuracy.critical) {
      anomalies.push(this.createAnomaly(
        'accuracy-drop',
        'critical',
        'Critical Accuracy Drop',
        `Overall accuracy (${(currentMetrics.overall.accuracy * 100).toFixed(2)}%) is below critical threshold (${this.thresholds.accuracy.critical * 100}%)`,
        currentMetrics.overall.accuracy,
        this.thresholds.accuracy.critical,
        ['Review conflict resolution rules', 'Check data source quality', 'Run manual verification']
      ));
    } else if (currentMetrics.overall.accuracy < this.thresholds.accuracy.warning) {
      anomalies.push(this.createAnomaly(
        'accuracy-drop',
        'high',
        'Accuracy Warning',
        `Overall accuracy (${(currentMetrics.overall.accuracy * 100).toFixed(2)}%) is below warning threshold (${this.thresholds.accuracy.warning * 100}%)`,
        currentMetrics.overall.accuracy,
        this.thresholds.accuracy.warning,
        ['Monitor accuracy trends', 'Review recent ETL runs']
      ));
    }

    // Check completeness
    if (currentMetrics.overall.completeness < this.thresholds.completeness.critical) {
      anomalies.push(this.createAnomaly(
        'completeness-drop',
        'critical',
        'Critical Completeness Drop',
        `Data completeness (${(currentMetrics.overall.completeness * 100).toFixed(2)}%) is below critical threshold (${this.thresholds.completeness.critical * 100}%)`,
        currentMetrics.overall.completeness,
        this.thresholds.completeness.critical,
        ['Review data sources', 'Check ETL pipeline', 'Add missing data fields']
      ));
    } else if (currentMetrics.overall.completeness < this.thresholds.completeness.warning) {
      anomalies.push(this.createAnomaly(
        'completeness-drop',
        'high',
        'Completeness Warning',
        `Data completeness (${(currentMetrics.overall.completeness * 100).toFixed(2)}%) is below warning threshold (${this.thresholds.completeness.warning * 100}%)`,
        currentMetrics.overall.completeness,
        this.thresholds.completeness.warning,
        ['Monitor completeness trends', 'Review data source coverage']
      ));
    }

    // Check freshness
    if (currentMetrics.overall.freshness < this.thresholds.freshness.critical) {
      anomalies.push(this.createAnomaly(
        'freshness-degradation',
        'high',
        'Data Freshness Issue',
        `Data freshness (${(currentMetrics.overall.freshness * 100).toFixed(2)}%) is below critical threshold (${this.thresholds.freshness.critical * 100}%)`,
        currentMetrics.overall.freshness,
        this.thresholds.freshness.critical,
        ['Run ETL pipeline', 'Check data source update frequency', 'Review last_updated timestamps']
      ));
    }

    // Check consistency
    if (currentMetrics.overall.consistency < this.thresholds.consistency.critical) {
      anomalies.push(this.createAnomaly(
        'consistency-issue',
        'high',
        'Data Consistency Issue',
        `Data consistency (${(currentMetrics.overall.consistency * 100).toFixed(2)}%) is below critical threshold (${this.thresholds.consistency.critical * 100}%)`,
        currentMetrics.overall.consistency,
        this.thresholds.consistency.critical,
        ['Review conflict resolution', 'Check source agreement rates', 'Improve confidence scoring']
      ));
    }

    // Check trends for degradation
    if (trendAnalysis) {
      const { trends } = trendAnalysis;

      if (trends.accuracy.trend === 'degrading' && trends.accuracy.change < -5) {
        anomalies.push(this.createAnomaly(
          'accuracy-drop',
          'high',
          'Accuracy Degrading Trend',
          `Accuracy has decreased by ${Math.abs(trends.accuracy.change).toFixed(2)}% over the ${trendAnalysis.period} period`,
          trends.accuracy.current,
          trends.accuracy.previous,
          ['Investigate recent changes', 'Review conflict resolution decisions', 'Check data source updates'],
          trends.accuracy.change
        ));
      }

      if (trends.completeness.trend === 'degrading' && trends.completeness.change < -5) {
        anomalies.push(this.createAnomaly(
          'completeness-drop',
          'high',
          'Completeness Degrading Trend',
          `Completeness has decreased by ${Math.abs(trends.completeness.change).toFixed(2)}% over the ${trendAnalysis.period} period`,
          trends.completeness.current,
          trends.completeness.previous,
          ['Review data source coverage', 'Check ETL pipeline', 'Investigate missing fields'],
          trends.completeness.change
        ));
      }
    }

    // Calculate summary
    const summary = {
      total: anomalies.length,
      bySeverity: {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        high: anomalies.filter(a => a.severity === 'high').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        low: anomalies.filter(a => a.severity === 'low').length,
      },
      byType: {
        'accuracy-drop': anomalies.filter(a => a.type === 'accuracy-drop').length,
        'completeness-drop': anomalies.filter(a => a.type === 'completeness-drop').length,
        'freshness-degradation': anomalies.filter(a => a.type === 'freshness-degradation').length,
        'consistency-issue': anomalies.filter(a => a.type === 'consistency-issue').length,
        'performance-degradation': anomalies.filter(a => a.type === 'performance-degradation').length,
        'data-quality-issue': anomalies.filter(a => a.type === 'data-quality-issue').length,
      },
    };

    return {
      anomalies,
      summary,
      timestamp: new Date(),
    };
  }

  /**
   * Detect performance anomalies
   */
  public detectPerformanceAnomalies(
    averageResponseTime: number,
    cacheHitRate: number
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (averageResponseTime > this.thresholds.performance.critical) {
      anomalies.push(this.createAnomaly(
        'performance-degradation',
        'critical',
        'Critical Performance Degradation',
        `Average response time (${averageResponseTime.toFixed(2)}ms) exceeds critical threshold (${this.thresholds.performance.critical}ms)`,
        averageResponseTime,
        this.thresholds.performance.critical,
        ['Check database performance', 'Review cache configuration', 'Optimize queries', 'Check system load']
      ));
    } else if (averageResponseTime > this.thresholds.performance.warning) {
      anomalies.push(this.createAnomaly(
        'performance-degradation',
        'medium',
        'Performance Warning',
        `Average response time (${averageResponseTime.toFixed(2)}ms) exceeds warning threshold (${this.thresholds.performance.warning}ms)`,
        averageResponseTime,
        this.thresholds.performance.warning,
        ['Monitor performance trends', 'Review slow queries', 'Check cache hit rate']
      ));
    }

    if (cacheHitRate < 0.90) {
      anomalies.push(this.createAnomaly(
        'performance-degradation',
        'medium',
        'Low Cache Hit Rate',
        `Cache hit rate (${(cacheHitRate * 100).toFixed(2)}%) is below optimal threshold (90%)`,
        cacheHitRate,
        0.90,
        ['Warm cache', 'Review cache TTL settings', 'Check cache size']
      ));
    }

    return anomalies;
  }

  /**
   * Create anomaly
   */
  private createAnomaly(
    type: AnomalyType,
    severity: AnomalySeverity,
    title: string,
    description: string,
    current: number,
    threshold: number,
    recommendations: string[],
    change?: number
  ): Anomaly {
    return {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      severity,
      title,
      description,
      detectedAt: new Date(),
      metrics: {
        current,
        threshold,
        change,
      },
      recommendations,
    };
  }

  /**
   * Update thresholds
   */
  public updateThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Anomaly detection thresholds updated', { thresholds });
  }
}

export const anomalyDetector = new AnomalyDetector();
