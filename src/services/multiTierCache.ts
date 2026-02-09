import { getRedisClient } from './redisConnection';
import { logger } from '../utils/logger';
import config from '../config';

/**
 * Simple LRU Cache implementation for local memory layer
 */
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; timestamp: number }>;
  private ttl: number;

  constructor(capacity: number, ttl: number) {
    this.capacity = capacity;
    this.ttl = ttl;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    const now = Date.now();

    if (this.cache.has(key)) {
      // Update existing: move to end
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, timestamp: now });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    const keysToDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      cleaned++;
    }

    return cleaned;
  }
}

export interface CacheResult<T> {
  hit: boolean;
  data?: T;
  layer: 'local' | 'redis' | 'database';
}

export interface CacheStats {
  local: {
    hits: number;
    misses: number;
    size: number;
    evictions: number;
  };
  redis: {
    hits: number;
    misses: number;
  };
  database: {
    hits: number;
    misses: number;
  };
}

/**
 * Multi-tier cache service implementing:
 * Layer 1: Local memory (LRU cache) - fastest
 * Layer 2: Redis Cluster - distributed cache
 * Layer 3: Database - source of truth
 */
export class MultiTierCacheService {
  private localCache: LRUCache<string, any>;
  private stats: CacheStats;
  private cachePrefix: string;

  constructor(prefix: string = 'multitier:') {
    this.cachePrefix = prefix;
    this.localCache = new LRUCache<string, any>(
      config.multiTierCache.localMemory.size,
      config.multiTierCache.localMemory.ttl
    );
    this.stats = {
      local: { hits: 0, misses: 0, size: 0, evictions: 0 },
      redis: { hits: 0, misses: 0 },
      database: { hits: 0, misses: 0 },
    };

    // Periodic cleanup of expired local cache entries
    setInterval(() => {
      const cleaned = this.localCache.cleanExpired();
      if (cleaned > 0) {
        logger.debug('Cleaned expired local cache entries', { cleaned });
      }
    }, 60000); // Every minute
  }

  /**
   * Get value from multi-tier cache
   * Checks: local memory -> Redis -> Database (via callback)
   */
  public async get<T>(
    key: string,
    fetchFromDatabase?: () => Promise<T | null>
  ): Promise<CacheResult<T>> {
    const fullKey = `${this.cachePrefix}${key}`;

    // Layer 1: Check local memory
    const localValue = this.localCache.get(fullKey);
    if (localValue !== undefined) {
      this.stats.local.hits++;
      return {
        hit: true,
        data: localValue as T,
        layer: 'local',
      };
    }
    this.stats.local.misses++;

    // Layer 2: Check Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const redisValue = await redisClient.get(fullKey);
        if (redisValue) {
          const data = JSON.parse(redisValue) as T;
          
          // Populate local cache
          this.localCache.set(fullKey, data);
          
          this.stats.redis.hits++;
          return {
            hit: true,
            data,
            layer: 'redis',
          };
        }
        this.stats.redis.misses++;
      } catch (error) {
        logger.warn('Redis cache get failed', { error, key });
        this.stats.redis.misses++;
      }
    }

    // Layer 3: Fetch from database if callback provided
    if (fetchFromDatabase) {
      try {
        const data = await fetchFromDatabase();
        if (data !== null) {
          // Populate both caches
          await this.set(key, data);
          
          this.stats.database.hits++;
          return {
            hit: true,
            data,
            layer: 'database',
          };
        }
        this.stats.database.misses++;
      } catch (error) {
        logger.error('Database fetch failed', { error, key });
        this.stats.database.misses++;
      }
    }

    return {
      hit: false,
      layer: 'database',
    };
  }

  /**
   * Set value in multi-tier cache
   * Updates: local memory -> Redis
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const fullKey = `${this.cachePrefix}${key}`;

    // Update local cache
    this.localCache.set(fullKey, value);

    // Update Redis cache
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const ttlSeconds = ttl || this.getDefaultTTL(key);
        const serialized = JSON.stringify(value);
        await redisClient.setex(fullKey, ttlSeconds, serialized);
        return true;
      } catch (error) {
        logger.warn('Redis cache set failed', { error, key });
        // Continue - local cache is updated
      }
    }

    return true;
  }

  /**
   * Delete value from all cache layers
   */
  public async delete(key: string): Promise<boolean> {
    const fullKey = `${this.cachePrefix}${key}`;

    // Delete from local cache
    this.localCache.delete(fullKey);

    // Delete from Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.del(fullKey);
      } catch (error) {
        logger.warn('Redis cache delete failed', { error, key });
      }
    }

    return true;
  }

  /**
   * Invalidate cache by pattern
   */
  public async invalidatePattern(pattern: string): Promise<number> {
    const fullPattern = `${this.cachePrefix}${pattern}`;
    let deleted = 0;

    // Delete from local cache
    const keysToDelete: string[] = [];
    // Note: LRU cache doesn't support pattern matching, so we'd need to track keys
    // For now, we'll just clear if pattern matches prefix
    if (pattern === '*') {
      this.localCache.clear();
      deleted += this.localCache.size();
    }

    // Delete from Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const keys = await redisClient.keys(fullPattern);
        if (keys.length > 0) {
          const count = await redisClient.del(...keys);
          deleted += count;
        }
      } catch (error) {
        logger.warn('Redis cache pattern delete failed', { error, pattern });
      }
    }

    return deleted;
  }

  /**
   * Get default TTL based on key type
   */
  private getDefaultTTL(key: string): number {
    if (key.startsWith('bin:')) {
      return config.multiTierCache.redis.ttl.bin;
    }
    if (key.startsWith('stats:')) {
      return config.multiTierCache.redis.ttl.statistics;
    }
    if (key.startsWith('card:')) {
      return config.multiTierCache.redis.ttl.card;
    }
    return 3600; // Default 1 hour
  }

  /**
   * Warm cache with popular data
   */
  public async warmCache<T>(
    items: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<number> {
    let warmed = 0;

    for (const item of items) {
      try {
        await this.set(item.key, item.value, item.ttl);
        warmed++;
      } catch (error) {
        logger.warn('Cache warming failed for key', { error, key: item.key });
      }
    }

    logger.info('Cache warming completed', { warmed, total: items.length });
    return warmed;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats & {
    localSize: number;
    hitRate: number;
  } {
    const totalHits = this.stats.local.hits + this.stats.redis.hits + this.stats.database.hits;
    const totalRequests = totalHits + this.stats.local.misses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      ...this.stats,
      localSize: this.localCache.size(),
      hitRate,
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      local: { hits: 0, misses: 0, size: 0, evictions: 0 },
      redis: { hits: 0, misses: 0 },
      database: { hits: 0, misses: 0 },
    };
  }
}

// Singleton instances for different use cases
export const binMultiTierCache = new MultiTierCacheService('bin:');
export const statisticsMultiTierCache = new MultiTierCacheService('stats:');
export const cardMultiTierCache = new MultiTierCacheService('card:');
