/**
 * Cache Performance Metrics
 * Track hit rates, response times, cache efficiency
 */

import { logger } from '../../utils/logger';

/**
 * Cache metrics for a single cache tier
 */
export interface CacheTierMetrics {
  tier: string;
  hits: number;
  misses: number;
  hitRate: number;
  averageResponseTime: number; // in milliseconds
  totalRequests: number;
}

/**
 * Overall cache metrics
 */
export interface CacheMetrics {
  bloomFilter: CacheTierMetrics;
  lru: CacheTierMetrics;
  redis: CacheTierMetrics;
  database: CacheTierMetrics;
  overall: {
    totalRequests: number;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    averageResponseTime: number;
    cacheEfficiency: number; // Percentage of requests served from cache
  };
  timestamp: Date;
}

/**
 * Cache Metrics Tracker
 */
export class CacheMetricsTracker {
  private metrics: Map<string, CacheTierMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();

  /**
   * Record a cache hit
   */
  public recordHit(tier: string, responseTime: number = 0): void {
    const metrics = this.getOrCreateMetrics(tier);
    metrics.hits++;
    metrics.totalRequests++;
    this.recordResponseTime(tier, responseTime);
    this.updateHitRate(metrics);
  }

  /**
   * Record a cache miss
   */
  public recordMiss(tier: string, responseTime: number = 0): void {
    const metrics = this.getOrCreateMetrics(tier);
    metrics.misses++;
    metrics.totalRequests++;
    this.recordResponseTime(tier, responseTime);
    this.updateHitRate(metrics);
  }

  /**
   * Get metrics for a tier
   */
  public getMetrics(tier: string): CacheTierMetrics | undefined {
    return this.metrics.get(tier);
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): CacheMetrics {
    const bloomFilter = this.metrics.get('bloomFilter') || this.createEmptyMetrics('bloomFilter');
    const lru = this.metrics.get('lru') || this.createEmptyMetrics('lru');
    const redis = this.metrics.get('redis') || this.createEmptyMetrics('redis');
    const database = this.metrics.get('database') || this.createEmptyMetrics('database');

    // Each "lookup" can touch multiple tiers. Treat bloomFilter.totalRequests as the
    // canonical "lookup count" because every request passes through Tier 1.
    const totalLookups = bloomFilter.totalRequests > 0
      ? bloomFilter.totalRequests
      : Math.max(lru.totalRequests, redis.totalRequests, database.totalRequests);

    const totalCacheHits = bloomFilter.hits + lru.hits + redis.hits;
    const overallHitRate = totalLookups > 0 ? (totalCacheHits / totalLookups) * 100 : 0;

    const allResponseTimes: number[] = [];
    this.responseTimes.forEach(times => allResponseTimes.push(...times));
    const averageResponseTime =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length
        : 0;

    const cacheEfficiency = overallHitRate;

    return {
      bloomFilter,
      lru,
      redis,
      database,
      overall: {
        totalRequests: totalLookups,
        totalHits: totalCacheHits,
        totalMisses: totalLookups - totalCacheHits,
        overallHitRate,
        averageResponseTime,
        cacheEfficiency,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.metrics.clear();
    this.responseTimes.clear();
    logger.info('Cache metrics reset');
  }

  /**
   * Get or create metrics for a tier
   */
  private getOrCreateMetrics(tier: string): CacheTierMetrics {
    if (!this.metrics.has(tier)) {
      this.metrics.set(tier, this.createEmptyMetrics(tier));
    }
    return this.metrics.get(tier)!;
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(tier: string): CacheTierMetrics {
    return {
      tier,
      hits: 0,
      misses: 0,
      hitRate: 0,
      averageResponseTime: 0,
      totalRequests: 0,
    };
  }

  /**
   * Record response time
   */
  private recordResponseTime(tier: string, responseTime: number): void {
    if (!this.responseTimes.has(tier)) {
      this.responseTimes.set(tier, []);
    }

    const times = this.responseTimes.get(tier)!;
    times.push(responseTime);

    // Keep only last 1000 response times per tier
    if (times.length > 1000) {
      times.shift();
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(metrics: CacheTierMetrics): void {
    if (metrics.totalRequests > 0) {
      metrics.hitRate = (metrics.hits / metrics.totalRequests) * 100;
    }

    // Update average response time
    const times = this.responseTimes.get(metrics.tier) || [];
    if (times.length > 0) {
      metrics.averageResponseTime =
        times.reduce((sum, time) => sum + time, 0) / times.length;
    }
  }

  /**
   * Export metrics to JSON
   */
  public exportMetrics(): string {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }
}

export const cacheMetricsTracker = new CacheMetricsTracker();
