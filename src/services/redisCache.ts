import { getRedisClient } from './redisConnection';
import { logger } from '../utils/logger';
import config from '../config';

export interface CacheOptions {
  /**
   * TTL in seconds
   * @default 3600 (1 hour)
   */
  ttl?: number;
  /**
   * Key prefix
   * @default config.redis.keyPrefix
   */
  prefix?: string;
}

export interface CacheResult<T> {
  hit: boolean;
  data?: T;
}

/**
 * Redis Cache Service
 * Provides caching functionality for BIN lookups and statistics queries
 */
export class RedisCacheService {
  private prefix: string;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || `${config.redis.keyPrefix}cache:`;
    this.defaultTTL = options.ttl || 3600; // 1 hour default
  }

  /**
   * Get Redis client
   */
  private getClient() {
    const client = getRedisClient();
    if (!client) {
      logger.warn('Redis client not available, cache operations will be skipped');
      return null;
    }
    return client;
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get value from cache
   */
  public async get<T>(key: string): Promise<CacheResult<T>> {
    const client = this.getClient();
    if (!client) {
      return { hit: false };
    }

    try {
      const cacheKey = this.buildKey(key);
      const value = await client.get(cacheKey);
      
      if (!value) {
        return { hit: false };
      }

      const data = JSON.parse(value) as T;
      return { hit: true, data };
    } catch (error) {
      logger.error('Redis cache get error', { error, key });
      return { hit: false };
    }
  }

  /**
   * Set value in cache
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key);
      const ttlSeconds = ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      
      // ioredis uses lowercase command helpers
      await client.setex(cacheKey, ttlSeconds, serialized);
      return true;
    } catch (error) {
      logger.error('Redis cache set error', { error, key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key);
      await client.del(cacheKey);
      return true;
    } catch (error) {
      logger.error('Redis cache delete error', { error, key });
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  public async deletePattern(pattern: string): Promise<number> {
    const client = this.getClient();
    if (!client) {
      return 0;
    }

    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await client.del(keys);
      return deleted;
    } catch (error) {
      logger.error('Redis cache deletePattern error', { error, pattern });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key);
      const result = await client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Redis cache exists error', { error, key });
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  public async getTTL(key: string): Promise<number> {
    const client = this.getClient();
    if (!client) {
      return -1;
    }

    try {
      const cacheKey = this.buildKey(key);
      const ttl = await client.ttl(cacheKey);
      return ttl;
    } catch (error) {
      logger.error('Redis cache getTTL error', { error, key });
      return -1;
    }
  }

  /**
   * Increment a numeric value
   */
  public async increment(key: string, by: number = 1): Promise<number | null> {
    const client = this.getClient();
    if (!client) {
      return null;
    }

    try {
      const cacheKey = this.buildKey(key);
      // ioredis uses lowercase command helpers
      const result = await client.incrby(cacheKey, by);
      return result;
    } catch (error) {
      logger.error('Redis cache increment error', { error, key });
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    enabled: boolean;
    prefix: string;
    defaultTTL: number;
  }> {
    const client = this.getClient();
    return {
      enabled: client !== null,
      prefix: this.prefix,
      defaultTTL: this.defaultTTL,
    };
  }
}

// Singleton instances for different use cases
export const binCacheService = new RedisCacheService({
  prefix: `${config.redis.keyPrefix}bin:`,
  ttl: 86400, // 24 hours for BIN lookups
});

export const statisticsCacheService = new RedisCacheService({
  prefix: `${config.redis.keyPrefix}stats:`,
  ttl: 300, // 5 minutes for statistics (shorter TTL as data changes more frequently)
});

export const cardGenerationCacheService = new RedisCacheService({
  prefix: `${config.redis.keyPrefix}cardgen:`,
  ttl: 3600, // 1 hour for card generation related data
});
