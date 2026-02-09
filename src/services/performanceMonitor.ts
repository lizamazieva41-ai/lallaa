/**
 * Performance Monitoring Service
 * Provides metrics collection and alerting for production monitoring
 */

// Avoid circular dependency - create local logger instance
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

export interface AlertConfig {
  threshold: number;
  windowMs: number;
  operator: 'gt' | 'gte' | 'lt' | 'eq';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // cooldown period in ms
}

export interface PerformanceMetrics {
  timestamp: string;
  duration: number;
  statusCode: number;
  method: string;
  route: string;
  userId?: string;
  userAgent?: string;
  ip: string;
  responseSize: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export interface Alert {
  id: string;
  type: 'performance' | 'security' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  metadata: Record<string, any>;
  resolved: boolean;
}

class PerformanceMonitor {
  private logger = logger;
  private metrics: PerformanceMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private alertConfigs: Map<string, AlertConfig> = new Map();

  constructor() {
    this.logger = logger;
    this.initializeAlertConfigs();
  }

  private initializeAlertConfigs(): void {
    // Default alert configurations
    this.alertConfigs.set('high_response_time', {
      threshold: 5000, // 5 seconds
      windowMs: 300000, // 5 minutes
      operator: 'gt',
      severity: 'high',
      cooldown: 600000 // 10 minutes
    });

    this.alertConfigs.set('error_rate', {
      threshold: 0.05, // 5% error rate
      windowMs: 60000, // 1 minute
      operator: 'gt',
      severity: 'medium',
      cooldown: 300000 // 5 minutes
    });

    this.alertConfigs.set('memory_usage', {
      threshold: 0.9, // 90% memory usage
      windowMs: 300000, // 5 minutes
      operator: 'gt',
      severity: 'medium',
      cooldown: 600000 // 10 minutes
    });
  }

  recordMetric(metric: Partial<PerformanceMetrics>): void {
    const fullMetric: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      duration: 0,
      statusCode: 0,
      method: '',
      route: '',
      userId: undefined,
      userAgent: undefined,
      ip: '',
      responseSize: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      ...metric
    };

    this.metrics.push(fullMetric);
    this.evaluateAlerts(fullMetric);
    
    // Keep only last 1000 metrics for memory efficiency
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    this.logger.debug('Metric recorded', fullMetric);
  }

  private evaluateAlerts(metric: PerformanceMetrics): void {
    const alerts: Alert[] = [];

    // Evaluate each alert configuration
    for (const [name, config] of this.alertConfigs.entries()) {
      if (this.shouldTriggerAlert(config, metric)) {
        const alert = this.createAlert(name, config, metric);
        alerts.push(alert);
      }
    }

    // Store active alerts
    alerts.forEach(alert => {
      if (!this.alerts.has(alert.id) || this.isCooldownExpired(alert)) {
        this.alerts.set(alert.id, alert);
        this.logger.warn('Alert triggered', alert);
      }
    });
  }

  private shouldTriggerAlert(config: AlertConfig, metric: PerformanceMetrics): boolean {
    switch (config.operator) {
      case 'gt':
        return metric.duration > config.threshold;
      case 'gte':
        return metric.duration >= config.threshold;
      case 'lt':
        return metric.duration < config.threshold;
      case 'eq':
        return metric.duration === config.threshold;
      default:
        return false;
    }
  }

  private createAlert(name: string, config: AlertConfig, metric: PerformanceMetrics): Alert {
    const alert: Alert = {
      id: `${name}_${Date.now()}`,
      type: 'performance' as const,
      severity: config.severity,
      message: `${this.getAlertMessage(name, config)}`,
      timestamp: new Date().toISOString(),
      metadata: {
        threshold: config.threshold,
        actualValue: config.operator === 'gt' ? metric.duration : metric.duration,
        metric: this.getMetricValue(name, metric)
      },
      resolved: false
    };

    return alert;
  }

  private getAlertMessage(name: string, config: AlertConfig): string {
    switch (name) {
      case 'high_response_time':
        return `High response time detected: ${(config.operator === 'gt' ? 'over' : 'under')} ${config.threshold}ms threshold`;
      case 'error_rate':
        return `Error rate exceeded: ${(config.threshold * 100).toFixed(1)}%`;
      case 'memory_usage':
        return `Memory usage critical: ${(config.threshold * 100).toFixed(1)}%`;
      default:
        return `${name} alert triggered`;
    }
  }

  private getMetricValue(name: string, metric: PerformanceMetrics): string {
    switch (name) {
      case 'high_response_time':
        return `${metric.duration}ms`;
      case 'error_rate':
        return 'N/A';
      case 'memory_usage':
        return `${(metric.memoryUsage.heapUsed / metric.memoryUsage.heapTotal * 100).toFixed(2)}%`;
      default:
        return String(metric.duration);
    }
  }

  private isCooldownExpired(alert: Alert): boolean {
    const cooldownPeriod = this.alertConfigs.get(alert.type)?.cooldown || 300000; // 5 minutes default
    return (Date.now() - new Date(alert.timestamp).getTime()) < cooldownPeriod;
  }

  getMetrics(timeRange?: { from?: string, to?: string }): PerformanceMetrics[] {
    let filtered = this.metrics;
    
    if (timeRange) {
      const fromTime = timeRange.from ? new Date(timeRange.from) : new Date(Date.now() - 3600000); // Default 1 hour
      const toTime = timeRange.to ? new Date(timeRange.to) : new Date();
      
      filtered = this.metrics.filter(metric => 
        new Date(metric.timestamp) >= fromTime && new Date(metric.timestamp) <= toTime
      );
    }

    return filtered;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = new Date().toISOString();
      this.logger.info('Alert resolved', alert);
    }
  }

  getMetricsSummary(timeRange?: { from?: string, to?: string }) {
    const metrics = this.getMetrics(timeRange);
    const count = metrics.length;
    
    if (count === 0) {
      return {
        count,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        errorRate: 0,
        memoryUsageAvg: 0
      };
    }

    const durations = metrics.map(m => m.duration);
    const errorRate = metrics.filter(m => m.statusCode >= 500).length / count;
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + (m.memoryUsage.heapUsed / m.memoryUsage.heapTotal * 100), 0) / count;

    return {
      count,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / count,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      errorRate,
      memoryUsageAvg: avgMemoryUsage.toFixed(2)
    };
  }

  exportMetrics(): void {
    // Log current metrics summary
    const summary = this.getMetricsSummary();
    this.logger.info('Performance metrics summary', summary);
  }
}

export const performanceMonitor = new PerformanceMonitor();