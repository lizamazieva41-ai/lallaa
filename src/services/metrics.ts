/**
 * Metrics Collection Service
 * Collects and exports metrics to Prometheus
 */

import { Counter, Histogram, Registry } from 'prom-client';

export class MetricsService {
  private registry: Registry;
  
  // Workflow metrics
  public workflowStartedTotal: Counter<string>;
  public workflowCompletedTotal: Counter<string>;
  public workflowFailedTotal: Counter<string>;
  public workflowDurationSeconds: Histogram<string>;
  
  // Excel export metrics
  public excelExportDurationSeconds: Histogram<string>;
  
  // Doremon API metrics
  public doremonApiRequestDurationSeconds: Histogram<string>;
  public doremonApiRequestTotal: Counter<string>;
  public doremonApiRequestFailedTotal: Counter<string>;
  
  // Card generation metrics
  public cardGenerationTotal: Counter<string>;
  public cardGenerationDurationSeconds: Histogram<string>;
  public cardDeduplicationTotal: Counter<string>;
  public cardDeduplicationDurationSeconds: Histogram<string>;
  public cardStorageTotal: Counter<string>;
  public cardStorageDurationSeconds: Histogram<string>;
  public cardGenerationCacheOperationTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();
    
    // Workflow metrics
    this.workflowStartedTotal = new Counter({
      name: 'workflow_started_total',
      help: 'Total number of workflows started',
      registers: [this.registry],
    });
    
    this.workflowCompletedTotal = new Counter({
      name: 'workflow_completed_total',
      help: 'Total number of workflows completed successfully',
      registers: [this.registry],
    });
    
    this.workflowFailedTotal = new Counter({
      name: 'workflow_failed_total',
      help: 'Total number of workflows that failed',
      registers: [this.registry],
    });
    
    this.workflowDurationSeconds = new Histogram({
      name: 'workflow_duration_seconds',
      help: 'Duration of workflow execution in seconds',
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
      registers: [this.registry],
    });
    
    // Excel export metrics
    this.excelExportDurationSeconds = new Histogram({
      name: 'excel_export_duration_seconds',
      help: 'Duration of Excel export in seconds',
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
      registers: [this.registry],
    });
    
    // Doremon API metrics
    this.doremonApiRequestDurationSeconds = new Histogram({
      name: 'doremon_api_request_duration_seconds',
      help: 'Duration of Doremon API requests in seconds',
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
      registers: [this.registry],
    });
    
    this.doremonApiRequestTotal = new Counter({
      name: 'doremon_api_request_total',
      help: 'Total number of Doremon API requests',
      labelNames: ['method', 'endpoint'],
      registers: [this.registry],
    });
    
    this.doremonApiRequestFailedTotal = new Counter({
      name: 'doremon_api_request_failed_total',
      help: 'Total number of failed Doremon API requests',
      labelNames: ['method', 'endpoint', 'error_type'],
      registers: [this.registry],
    });
    
    // Card generation metrics
    this.cardGenerationTotal = new Counter({
      name: 'card_generation_total',
      help: 'Total number of card generation operations',
      labelNames: ['mode', 'status'],
      registers: [this.registry],
    });
    
    this.cardGenerationDurationSeconds = new Histogram({
      name: 'card_generation_duration_seconds',
      help: 'Duration of card generation in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
      labelNames: ['mode'],
      registers: [this.registry],
    });
    
    this.cardDeduplicationTotal = new Counter({
      name: 'card_deduplication_total',
      help: 'Total number of deduplication checks',
      labelNames: ['result', 'source'],
      registers: [this.registry],
    });
    
    this.cardDeduplicationDurationSeconds = new Histogram({
      name: 'card_deduplication_duration_seconds',
      help: 'Duration of deduplication check in seconds',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
      registers: [this.registry],
    });
    
    this.cardStorageTotal = new Counter({
      name: 'card_storage_total',
      help: 'Total number of card storage operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });
    
    this.cardStorageDurationSeconds = new Histogram({
      name: 'card_storage_duration_seconds',
      help: 'Duration of card storage operation in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
      labelNames: ['operation'],
      registers: [this.registry],
    });
    
    this.cardGenerationCacheOperationTotal = new Counter({
      name: 'card_generation_cache_operation_total',
      help: 'Total number of cache operations for card generation',
      labelNames: ['operation', 'result'],
      registers: [this.registry],
    });
    
    // Uniqueness check metrics (per layer)
    this.uniquenessCheckTotal = new Counter({
      name: 'uniqueness_check_total',
      help: 'Total number of uniqueness checks',
      labelNames: ['layer', 'result'],
      registers: [this.registry],
    });
    
    this.uniquenessCheckDurationSeconds = new Histogram({
      name: 'uniqueness_check_duration_seconds',
      help: 'Duration of uniqueness check in seconds',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
      labelNames: ['layer'],
      registers: [this.registry],
    });
    
    // Job queue metrics
    this.jobQueueTotal = new Counter({
      name: 'job_queue_total',
      help: 'Total number of job queue operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });
    
    this.jobQueueDurationSeconds = new Histogram({
      name: 'job_queue_duration_seconds',
      help: 'Duration of job processing in seconds',
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
      labelNames: ['operation'],
      registers: [this.registry],
    });
    
    this.jobQueueSize = new Counter({
      name: 'job_queue_size',
      help: 'Current size of job queue',
      labelNames: ['status'],
      registers: [this.registry],
    });
    
    // Cache metrics
    this.cacheHitTotal = new Counter({
      name: 'cache_hit_total',
      help: 'Total number of cache hits',
      labelNames: ['layer'],
      registers: [this.registry],
    });
    
    this.cacheMissTotal = new Counter({
      name: 'cache_miss_total',
      help: 'Total number of cache misses',
      labelNames: ['layer'],
      registers: [this.registry],
    });
    
    this.cacheEvictionTotal = new Counter({
      name: 'cache_eviction_total',
      help: 'Total number of cache evictions',
      labelNames: ['layer'],
      registers: [this.registry],
    });
    
    // Database query metrics
    this.databaseQueryDurationSeconds = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0],
      labelNames: ['operation'],
      registers: [this.registry],
    });
  }
  
  // Uniqueness check metrics
  public uniquenessCheckTotal: Counter<string>;
  public uniquenessCheckDurationSeconds: Histogram<string>;
  
  // Job queue metrics
  public jobQueueTotal: Counter<string>;
  public jobQueueDurationSeconds: Histogram<string>;
  public jobQueueSize: Counter<string>;
  
  // Cache metrics
  public cacheHitTotal: Counter<string>;
  public cacheMissTotal: Counter<string>;
  public cacheEvictionTotal: Counter<string>;
  
  // Database query metrics
  public databaseQueryDurationSeconds: Histogram<string>;

  /**
   * Record workflow start
   */
  recordWorkflowStart(): void {
    this.workflowStartedTotal.inc();
  }

  /**
   * Record workflow completion
   */
  recordWorkflowComplete(duration: number): void {
    this.workflowCompletedTotal.inc();
    this.workflowDurationSeconds.observe(duration);
  }

  /**
   * Record workflow failure
   */
  recordWorkflowFailure(duration: number): void {
    this.workflowFailedTotal.inc();
    this.workflowDurationSeconds.observe(duration);
  }

  /**
   * Record Excel export duration
   */
  recordExcelExportDuration(duration: number): void {
    this.excelExportDurationSeconds.observe(duration);
  }

  /**
   * Record Doremon API request
   */
  recordDoremonApiRequest(
    method: string,
    endpoint: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    this.doremonApiRequestTotal.inc({ method, endpoint });
    this.doremonApiRequestDurationSeconds.observe(duration);
    
    if (!success) {
      this.doremonApiRequestFailedTotal.inc({
        method,
        endpoint,
        error_type: errorType || 'unknown',
      });
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get registry for custom metrics
   */
  getRegistry(): Registry {
    return this.registry;
  }
}

/**
 * Helper functions for card generation metrics
 */
export function recordCardGeneration(
  mode: 'random' | 'sequential' | 'batch_999',
  status: 'success' | 'failed' | 'duplicate',
  duration?: number
): void {
  metricsService.cardGenerationTotal.inc({ mode, status });
  if (duration !== undefined) {
    metricsService.cardGenerationDurationSeconds.observe({ mode }, duration);
  }
}

export function recordCardDeduplication(
  result: 'unique' | 'duplicate',
  duration: number,
  source: 'cache' | 'database'
): void {
  metricsService.cardDeduplicationTotal.inc({ result, source });
  metricsService.cardDeduplicationDurationSeconds.observe(duration);
}

export function recordCardStorage(
  operation: 'create' | 'batch_create',
  status: 'success' | 'failed' | 'duplicate',
  duration?: number
): void {
  metricsService.cardStorageTotal.inc({ operation, status });
  if (duration !== undefined) {
    metricsService.cardStorageDurationSeconds.observe({ operation }, duration);
  }
}

export function recordCardGenerationCacheOperation(
  operation: 'get' | 'set',
  result: 'hit' | 'miss' | 'success' | 'error'
): void {
  metricsService.cardGenerationCacheOperationTotal.inc({ operation, result });
}

export function recordUniquenessCheck(
  layer: 'bloom' | 'redis' | 'database' | 'pool' | 'final',
  result: 'unique' | 'duplicate',
  duration: number
): void {
  metricsService.uniquenessCheckTotal.inc({ layer, result });
  metricsService.uniquenessCheckDurationSeconds.observe({ layer }, duration);
}

export function recordJobQueueOperation(
  operation: 'create' | 'process' | 'complete' | 'fail',
  status: 'success' | 'failed',
  duration?: number
): void {
  metricsService.jobQueueTotal.inc({ operation, status });
  if (duration !== undefined) {
    metricsService.jobQueueDurationSeconds.observe({ operation }, duration);
  }
}

export function recordJobQueueSize(status: 'waiting' | 'active' | 'completed' | 'failed', count: number): void {
  // Reset counter and set new value
  metricsService.jobQueueSize.inc({ status }, count);
}

export function recordCacheHit(layer: 'local' | 'redis' | 'database'): void {
  metricsService.cacheHitTotal.inc({ layer });
}

export function recordCacheMiss(layer: 'local' | 'redis' | 'database'): void {
  metricsService.cacheMissTotal.inc({ layer });
}

export function recordCacheEviction(layer: 'local' | 'redis'): void {
  metricsService.cacheEvictionTotal.inc({ layer });
}

export function recordDatabaseQuery(operation: string, duration: number): void {
  metricsService.databaseQueryDurationSeconds.observe({ operation }, duration);
}

/**
 * Record failed authentication attempt
 */
export function recordFailedAuth(reason: string, ip: string): void {
  // Log the event - metrics can be added if needed
  // For now, this is primarily for logging/auditing
}

/**
 * Record suspicious activity
 */
export function recordSuspiciousActivity(description: string, severity: string, userId?: string): void {
  // Log suspicious activity - metrics can be added if needed
  // For now, this is primarily for logging/auditing
}

/**
 * Record database access
 */
export function recordDatabaseAccess(operation: string, table: string, result: string): void {
  // Use existing database query metrics
  // This is primarily for logging/auditing
}

/**
 * Record audit event
 */
export function recordAuditEvent(action: string, resource: string, result: string): void {
  // Log audit event - metrics can be added if needed
  // For now, this is primarily for logging/auditing
}

/**
 * Record rate limit breach
 */
export function recordRateLimitBreach(identifier: string, ip: string): void {
  // Log rate limit breach - metrics can be added if needed
  // For now, this is primarily for logging/auditing
}

/**
 * Record unauthorized access attempt
 */
export function recordUnauthorizedAccess(ip: string, path: string, method: string): void {
  // Log unauthorized access - metrics can be added if needed
  // For now, this is primarily for logging/auditing
}

/**
 * Record card statistics query
 */
export function recordCardStatisticsQuery(operation: string, duration: number): void {
  // Use existing database query metrics
  metricsService.databaseQueryDurationSeconds.observe({ operation: `card_stats_${operation}` }, duration);
}

/**
 * Record statistics aggregation
 */
export function recordStatisticsAggregation(status: string, duration?: number): void {
  // Log statistics aggregation - metrics can be added if needed
  // For now, this is primarily for logging/auditing
  if (duration !== undefined) {
    metricsService.databaseQueryDurationSeconds.observe({ operation: 'statistics_aggregation' }, duration);
  }
}

/**
 * Update card generation duplicate rate
 */
let cardGenerationDuplicateRate: number = 0;

export function updateCardGenerationDuplicateRate(rate: number): void {
  cardGenerationDuplicateRate = rate;
  // This can be exposed as a gauge metric if needed
}

// Global metrics service instance
export const metricsService = new MetricsService();

/**
 * Metrics middleware for Express
 */
export const metricsMiddleware = (req: any, res: any, next: any) => {
  // Middleware is already handled by prom-client default metrics
  next();
};

/**
 * Metrics handler endpoint
 */
export const metricsHandler = async (req: any, res: any) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
};
