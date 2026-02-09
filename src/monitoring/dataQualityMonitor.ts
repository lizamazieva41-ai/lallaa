/**
 * Data Quality Monitor
 * Real-time quality monitoring with anomaly detection
 */

import { qualityCalculator } from '../services/qualityMetrics/qualityCalculator';
import { trendAnalyzer } from '../services/qualityMetrics/trendAnalyzer';
import { anomalyDetector } from './anomalyDetector';
import { QualityMetrics } from '../services/qualityMetrics/qualityCalculator';
import { TrendAnalysis } from '../services/qualityMetrics/trendAnalyzer';
import { AnomalyDetectionResult } from './anomalyDetector';
import { AccuracyMetrics } from '../services/accuracyMeasurement/accuracyFramework';
import { logger } from '../utils/logger';

/**
 * Quality monitoring result
 */
export interface QualityMonitoringResult {
  currentMetrics: QualityMetrics;
  trendAnalysis: TrendAnalysis;
  anomalies: AnomalyDetectionResult;
  alerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }>;
  timestamp: Date;
}

/**
 * Data Quality Monitor
 */
export class DataQualityMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private lastMetrics: QualityMetrics | null = null;

  /**
   * Start monitoring
   */
  public startMonitoring(intervalMinutes: number = 60): void {
    if (this.isMonitoring) {
      logger.warn('Quality monitoring already started');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting data quality monitoring', { intervalMinutes });

    // Run immediately
    this.collectMetrics().catch(error => {
      logger.error('Failed to collect initial quality metrics', { error });
    });

    // Then run at interval
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Failed to collect quality metrics', { error });
      });
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Data quality monitoring stopped');
  }

  /**
   * Collect and analyze quality metrics
   */
  public async collectMetrics(
    accuracyMetrics?: AccuracyMetrics
  ): Promise<QualityMonitoringResult> {
    try {
      logger.debug('Collecting quality metrics...');

      // Calculate current quality metrics
      const currentMetrics = await qualityCalculator.calculateOverallQuality(accuracyMetrics);

      // Add to trend analyzer
      trendAnalyzer.addMetrics(currentMetrics);

      // Analyze trends
      const trendAnalysis = trendAnalyzer.analyzeTrends('30d');

      // Detect anomalies
      const anomalies = anomalyDetector.detectAnomalies(currentMetrics, trendAnalysis);

      // Generate alerts
      const alerts = this.generateAlerts(currentMetrics, trendAnalysis, anomalies);

      // Store last metrics
      this.lastMetrics = currentMetrics;

      const result: QualityMonitoringResult = {
        currentMetrics,
        trendAnalysis,
        anomalies,
        alerts,
        timestamp: new Date(),
      };

      // Log critical issues
      if (anomalies.summary.bySeverity.critical > 0) {
        logger.error('Critical quality issues detected', {
          criticalCount: anomalies.summary.bySeverity.critical,
          anomalies: anomalies.anomalies.filter(a => a.severity === 'critical'),
        });
      } else if (anomalies.summary.bySeverity.high > 0) {
        logger.warn('High severity quality issues detected', {
          highCount: anomalies.summary.bySeverity.high,
        });
      } else {
        logger.info('Quality metrics collected', {
          overallScore: currentMetrics.overall.overallScore,
          anomalies: anomalies.summary.total,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to collect quality metrics', { error });
      throw error;
    }
  }

  /**
   * Get current monitoring status
   */
  public getStatus(): {
    isMonitoring: boolean;
    lastMetrics: QualityMetrics | null;
    lastUpdate: Date | null;
  } {
    return {
      isMonitoring: this.isMonitoring,
      lastMetrics: this.lastMetrics,
      lastUpdate: this.lastMetrics?.timestamp || null,
    };
  }

  /**
   * Generate alerts from metrics and anomalies
   */
  private generateAlerts(
    metrics: QualityMetrics,
    trends: TrendAnalysis,
    anomalies: AnomalyDetectionResult
  ): Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }> {
    const alerts: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: Date;
    }> = [];

    // Critical anomalies
    anomalies.anomalies
      .filter(a => a.severity === 'critical')
      .forEach(anomaly => {
        alerts.push({
          severity: 'critical',
          message: `CRITICAL: ${anomaly.title} - ${anomaly.description}`,
          timestamp: new Date(),
        });
      });

    // High severity anomalies
    anomalies.anomalies
      .filter(a => a.severity === 'high')
      .forEach(anomaly => {
        alerts.push({
          severity: 'high',
          message: `HIGH: ${anomaly.title} - ${anomaly.description}`,
          timestamp: new Date(),
        });
      });

    // Overall score alerts
    if (metrics.overall.overallScore < 0.85) {
      alerts.push({
        severity: 'high',
        message: `Overall quality score (${(metrics.overall.overallScore * 100).toFixed(2)}%) is below acceptable threshold`,
        timestamp: new Date(),
      });
    }

    // Trend alerts
    if (trends.summary.overallTrend === 'degrading') {
      alerts.push({
        severity: 'medium',
        message: `Quality metrics showing degrading trend over ${trends.period}`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Get quality dashboard data
   */
  public async getDashboardData(): Promise<{
    current: QualityMetrics;
    trends: {
      '30d': TrendAnalysis;
      '60d': TrendAnalysis;
      '90d': TrendAnalysis;
    };
    anomalies: AnomalyDetectionResult;
    alerts: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: Date;
    }>;
  }> {
    const current = this.lastMetrics || await qualityCalculator.calculateOverallQuality();

    return {
      current,
      trends: {
        '30d': trendAnalyzer.analyzeTrends('30d'),
        '60d': trendAnalyzer.analyzeTrends('60d'),
        '90d': trendAnalyzer.analyzeTrends('90d'),
      },
      anomalies: anomalyDetector.detectAnomalies(current),
      alerts: this.generateAlerts(
        current,
        trendAnalyzer.analyzeTrends('30d'),
        anomalyDetector.detectAnomalies(current)
      ),
    };
  }
}

export const dataQualityMonitor = new DataQualityMonitor();
