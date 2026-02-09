/**
 * Optimized Cache Manager
 * Multi-tier cache (Bloom → LRU → Redis → DB) with performance tracking
 */

import { bloomFilterService } from './bloomFilterService';
import { cacheMetricsTracker } from './cacheMetrics';
import { binCacheService } from '../redisCache';
import { binModel } from '../../models/bin';
import { BINLookupResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Cache lookup result
 */
export interface CacheLookupResult<T> {
  data: T | null;
  source: 'bloomFilter' | 'lru' | 'redis' | 'database' | 'not-found';
  responseTime: number;
  cached: boolean;
}

/**
 * Optimized Cache Manager - Multi-tier cache with performance tracking
 */
export class OptimizedCacheManager {
  private lruCache: Map<string, { value: BINLookupResult; expiry: number }> = new Map();
  private maxLRUSize: number = 10000;
  private lruTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Lookup BIN with multi-tier cache
   */
  public async lookup(bin: string): Promise<CacheLookupResult<BINLookupResult>> {
    const startTime = Date.now();
    const normalized = this.normalizeBIN(bin);

    // Tier 1: Bloom Filter (negative cache)
    if (bloomFilterService.definitelyNotExist(normalized)) {
      const responseTime = Date.now() - startTime;
      cacheMetricsTracker.recordHit('bloomFilter', responseTime);
      logger.debug('Bloom filter negative cache hit', { bin: normalized });
      return {
        data: null,
        source: 'bloomFilter',
        responseTime,
        cached: true,
      };
    }
    // Bloom filter checked and did NOT block: record as a miss for this tier
    cacheMetricsTracker.recordMiss('bloomFilter', Date.now() - startTime);

    // Tier 2: LRU Cache (in-memory)
    const lruResult = this.lruCache.get(normalized);
    if (lruResult && Date.now() < lruResult.expiry) {
      const responseTime = Date.now() - startTime;
      cacheMetricsTracker.recordHit('lru', responseTime);
      logger.debug('LRU cache hit', { bin: normalized });
      return {
        data: lruResult.value,
        source: 'lru',
        responseTime,
        cached: true,
      };
    }
    cacheMetricsTracker.recordMiss('lru', Date.now() - startTime);

    // Tier 3: Redis Cache
    const redisKey = `lookup:${normalized}`;
    const redisResult = await binCacheService.get<BINLookupResult>(redisKey);
    if (redisResult.hit && redisResult.data) {
      const responseTime = Date.now() - startTime;
      cacheMetricsTracker.recordHit('redis', responseTime);
      
      // Store in LRU for faster access
      this.setLRU(normalized, redisResult.data);
      
      logger.debug('Redis cache hit', { bin: normalized });
      return {
        data: redisResult.data,
        source: 'redis',
        responseTime,
        cached: true,
      };
    }
    cacheMetricsTracker.recordMiss('redis', Date.now() - startTime);

    // Tier 4: Database
    const dbStartTime = Date.now();
    try {
      const dbResult = await binModel.lookup(normalized);
      const dbResponseTime = Date.now() - dbStartTime;
      
      if (dbResult) {
        // Store in all cache tiers
        this.setLRU(normalized, dbResult);
        await binCacheService.set(redisKey, dbResult, 24 * 60 * 60); // 24h TTL
        
        const totalResponseTime = Date.now() - startTime;
        cacheMetricsTracker.recordHit('database', totalResponseTime);
        
        logger.debug('Database lookup', { bin: normalized, responseTime: totalResponseTime });
        return {
          data: dbResult,
          source: 'database',
          responseTime: totalResponseTime,
          cached: false,
        };
      } else {
        // BIN not found - add to bloom filter
        bloomFilterService.add(normalized);
        const totalResponseTime = Date.now() - startTime;
        cacheMetricsTracker.recordMiss('database', totalResponseTime);
        
        logger.debug('BIN not found, added to bloom filter', { bin: normalized });
        return {
          data: null,
          source: 'not-found',
          responseTime: totalResponseTime,
          cached: false,
        };
      }
    } catch (error) {
      const totalResponseTime = Date.now() - startTime;
      cacheMetricsTracker.recordMiss('database', totalResponseTime);
      logger.error('Database lookup failed', { bin: normalized, error });
      throw error;
    }
  }

  /**
   * Set value in LRU cache
   */
  private setLRU(key: string, value: BINLookupResult): void {
    // Evict oldest if at capacity
    if (this.lruCache.size >= this.maxLRUSize) {
      const firstKey = this.lruCache.keys().next().value;
      if (firstKey) {
        this.lruCache.delete(firstKey);
      }
    }

    this.lruCache.set(key, {
      value,
      expiry: Date.now() + this.lruTTL,
    });
  }

  /**
   * Clear LRU cache
   */
  public clearLRU(): void {
    this.lruCache.clear();
    logger.info('LRU cache cleared');
  }

  /**
   * Get LRU cache statistics
   */
  public getLRUStats(): { size: number; maxSize: number; ttlHours: number } {
    // Clean expired entries
    const now = Date.now();
    for (const [key, item] of this.lruCache.entries()) {
      if (now > item.expiry) {
        this.lruCache.delete(key);
      }
    }

    return {
      size: this.lruCache.size,
      maxSize: this.maxLRUSize,
      ttlHours: this.lruTTL / (60 * 60 * 1000),
    };
  }

  /**
   * Normalize BIN
   */
  private normalizeBIN(bin: string): string {
    return bin.replace(/\s/g, '').replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  /**
   * Get cache metrics
   */
  public getMetrics() {
    return cacheMetricsTracker.getAllMetrics();
  }

  /**
   * Clear all caches
   */
  public async clearAll(): Promise<void> {
    this.clearLRU();
    bloomFilterService.clear();
    // Redis cache clearing would be done via binCacheService
    logger.info('All caches cleared');
  }
}

export const optimizedCacheManager = new OptimizedCacheManager();
