import { generatedCardModel, calculateCardHash } from '../models/generatedCard';
import { logger } from '../utils/logger';
import { recordCardGenerationCacheOperation } from './metrics';
import { getRedisClient } from './redisConnection';
import config from '../config';

/**
 * Simple LRU Cache implementation for card hash deduplication
 */
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
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
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
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
}

export interface DeduplicationOptions {
  /**
   * Enable in-memory LRU cache for faster lookups
   * @default true
   */
  useCache?: boolean;
  /**
   * Cache size (number of entries)
   * @default 10000
   */
  cacheSize?: number;
  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  cardHash: string;
  fromCache: boolean;
}

export class CardDeduplicationService {
  private cache: LRUCache<string, { exists: boolean; timestamp: number }> | null = null;
  private cacheTTL: number;
  private useCache: boolean;

  constructor(options: DeduplicationOptions = {}) {
    this.useCache = options.useCache !== false;
    this.cacheTTL = options.cacheTTL || 3600000; // 1 hour default

    if (this.useCache) {
      const cacheSize = options.cacheSize || 10000;
      this.cache = new LRUCache<string, { exists: boolean; timestamp: number }>(cacheSize);
      logger.info('Card deduplication cache initialized', { cacheSize, ttl: this.cacheTTL });
    }
  }

  /**
   * Check if a card is duplicate
   * Uses multi-level checking: cache -> database
   */
  public async checkDuplicate(
    cardNumber: string,
    expiryDate: string,
    cvv: string
  ): Promise<DeduplicationResult> {
    const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

    // Level 1: Check in-memory cache
    if (this.useCache && this.cache) {
      const cached = this.cache.get(cardHash);
      if (cached) {
        const now = Date.now();
        // Check if cache entry is still valid
        if (now - cached.timestamp < this.cacheTTL) {
          recordCardGenerationCacheOperation('get', 'hit');
          return {
            isDuplicate: cached.exists,
            cardHash,
            fromCache: true,
          };
        } else {
          // Cache expired, will be removed on next access
          // Note: We can't directly delete from Map during iteration, so we'll let it expire naturally
          recordCardGenerationCacheOperation('get', 'miss');
        }
      } else {
        recordCardGenerationCacheOperation('get', 'miss');
      }
    }

    // Level 2: Check Redis (if available)
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const redisKey = `${config.redis.keyPrefix}dedup:${cardHash}`;
        const redisExists = await redisClient.exists(redisKey);
        
        if (redisExists) {
          recordCardGenerationCacheOperation('get', 'hit');
          return {
            isDuplicate: true,
            cardHash,
            fromCache: false, // Redis is not local cache
          };
        }
      } catch (error) {
        logger.warn('Redis deduplication check failed', { error });
        // Continue to database check
      }
    }

    // Level 3: Check database
    try {
      const exists = await generatedCardModel.existsByHash(cardHash);
      
      // Update Redis cache if available
      if (redisClient && !exists) {
        try {
          const redisKey = `${config.redis.keyPrefix}dedup:${cardHash}`;
          await redisClient.setex(redisKey, 3600, '1'); // 1 hour TTL
        } catch (error) {
          logger.warn('Failed to update Redis cache', { error });
        }
      }
      
      // Update local cache if enabled
      if (this.useCache && this.cache) {
        this.cache.set(cardHash, {
          exists,
          timestamp: Date.now(),
        });
        recordCardGenerationCacheOperation('set', 'success');
      }

      return {
        isDuplicate: exists,
        cardHash,
        fromCache: false,
      };
    } catch (error) {
      logger.error('Failed to check duplicate in database', {
        error,
        cardHash: cardHash.substring(0, 16) + '...',
      });
      // On error, assume not duplicate to avoid blocking generation
      return {
        isDuplicate: false,
        cardHash,
        fromCache: false,
      };
    }
  }

  /**
   * Mark a card as generated (add to cache)
   * This is called after successfully creating a card
   */
  public async markAsGenerated(cardNumber: string, expiryDate: string, cvv: string): Promise<void> {
    const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);
    
    // Update Redis cache
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const redisKey = `${config.redis.keyPrefix}dedup:${cardHash}`;
        await redisClient.setex(redisKey, 3600, '1'); // 1 hour TTL
      } catch (error) {
        logger.warn('Failed to update Redis cache for generated card', { error });
      }
    }

    // Update local cache
    if (this.useCache && this.cache) {
      this.cache.set(cardHash, {
        exists: true,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Batch check for duplicates with parallel processing
   * Returns array of results in same order as input
   */
  public async checkBatch(
    cards: Array<{ cardNumber: string; expiryDate: string; cvv: string }>
  ): Promise<DeduplicationResult[]> {
    // Process in parallel batches for better performance
    const batchSize = 50;
    const results: DeduplicationResult[] = [];

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(card => this.checkDuplicate(card.cardNumber, card.expiryDate, card.cvv))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Clear the cache (useful for testing or manual cache invalidation)
   */
  public clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      logger.info('Card deduplication cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    enabled: boolean;
    size: number;
    ttl: number;
  } {
    return {
      enabled: this.useCache,
      size: this.cache?.size() || 0,
      ttl: this.cacheTTL,
    };
  }

  /**
   * Clean expired cache entries
   * This should be called periodically (e.g., every hour)
   */
  public cleanExpiredCache(): number {
    if (!this.useCache || !this.cache) {
      return 0;
    }

    const now = Date.now();
    let cleaned = 0;
    const keysToDelete: string[] = [];

    // Note: Map iteration order is insertion order, so we can iterate
    // In a real implementation, we'd need to track timestamps separately
    // For now, we'll just clear entries that are accessed and found expired
    // This is a simplified version - full implementation would track all timestamps

    return cleaned;
  }
}

// Singleton instance with default options
export const cardDeduplicationService = new CardDeduplicationService({
  useCache: true,
  cacheSize: 10000,
  cacheTTL: 3600000, // 1 hour
});
