import { generatedCardModel, calculateCardHash } from '../models/generatedCard';
import { uniquenessPoolModel } from '../models/uniquenessPool';
import { getRedisClient } from './redisConnection';
import { getBloomFilterService } from './bloomFilterService';
import config from '../config';
import { logger } from '../utils/logger';
import database from '../database/connection';

export interface UniquenessCheckResult {
  isUnique: boolean;
  layer: number; // Which layer detected the duplicate (0 = unique, 1-5 = layer number)
  checkedLayers: number[]; // Which layers were checked
  responseTime: number;
}

export interface UniquenessReservationResult {
  reserved: boolean;
  cardHash: string;
  ttl: number;
}

/**
 * UniquenessService implements a 5-layer uniqueness architecture:
 * Layer 1: Composite unique constraint (card_number + expiry_date + cvv)
 * Layer 2: Global uniqueness index across all partitions
 * Layer 3: Pre-generation uniqueness pool with distributed locks
 * Layer 4: Bloom filter for fast pre-filtering
 * Layer 5: Redis Cluster cache with TTL-based invalidation
 */
export class UniquenessService {
  private readonly processId: string;
  private readonly cachePrefix = `${config.redis.keyPrefix}uniqueness:`;

  constructor() {
    // Generate unique process ID for this service instance
    this.processId = `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if a card is unique using 5-layer architecture
   */
  public async checkUniqueness(
    cardNumber: string,
    expiryDate: string,
    cvv: string
  ): Promise<UniquenessCheckResult> {
    const startTime = Date.now();
    const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);
    const checkedLayers: number[] = [];

    try {
      // Layer 5: Redis Cluster cache (fastest check)
      checkedLayers.push(5);
      const redisCheck = await this.checkRedisCache(cardHash);
      if (!redisCheck.isUnique) {
        return {
          isUnique: false,
          layer: 5,
          checkedLayers,
          responseTime: Date.now() - startTime,
        };
      }

      // Layer 4: Bloom filter (fast pre-filtering)
      checkedLayers.push(4);
      const bloomCheck = await this.checkBloomFilter(cardHash);
      if (!bloomCheck.isUnique) {
        // Bloom filter may have false positives, so we continue to verify
        // But we mark it as potentially duplicate
        logger.debug('Bloom filter potential duplicate detected', { cardHash });
      }

      // Layer 3: Uniqueness pool (pre-generation reservations)
      checkedLayers.push(3);
      const poolCheck = await this.checkUniquenessPool(cardHash);
      if (!poolCheck.isUnique) {
        return {
          isUnique: false,
          layer: 3,
          checkedLayers,
          responseTime: Date.now() - startTime,
        };
      }

      // Layer 2: Global uniqueness index (database check)
      checkedLayers.push(2);
      const dbCheck = await this.checkDatabase(cardHash);
      if (!dbCheck.isUnique) {
        return {
          isUnique: false,
          layer: 2,
          checkedLayers,
          responseTime: Date.now() - startTime,
        };
      }

      // Layer 1: Composite unique constraint will be checked on insert
      checkedLayers.push(1);

      // All checks passed - card is unique
      return {
        isUnique: true,
        layer: 0,
        checkedLayers,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Uniqueness check failed', { error, cardHash });
      // On error, assume not unique to be safe
      return {
        isUnique: false,
        layer: 0, // Error case
        checkedLayers,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Reserve a card hash in the uniqueness pool (Layer 3)
   */
  public async reserveCardHash(
    cardNumber: string,
    expiryDate: string,
    cvv: string,
    ttlSeconds: number = config.uniquenessService.poolTtlSeconds
  ): Promise<UniquenessReservationResult> {
    const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

    try {
      // First check if already exists
      const checkResult = await this.checkUniqueness(cardNumber, expiryDate, cvv);
      if (!checkResult.isUnique) {
        return {
          reserved: false,
          cardHash,
          ttl: 0,
        };
      }

      // Reserve in uniqueness pool
      const reserved = await uniquenessPoolModel.reserve(cardHash, this.processId, ttlSeconds);
      
      if (reserved) {
        // Also cache in Redis (Layer 5)
        await this.cacheInRedis(cardHash, ttlSeconds);
        
        return {
          reserved: true,
          cardHash,
          ttl: ttlSeconds,
        };
      }

      return {
        reserved: false,
        cardHash,
        ttl: 0,
      };
    } catch (error) {
      logger.error('Failed to reserve card hash', { error, cardHash });
      throw error;
    }
  }

  /**
   * Release a card hash reservation
   */
  public async releaseCardHash(cardHash: string): Promise<boolean> {
    try {
      await uniquenessPoolModel.release(cardHash);
      await this.removeFromRedisCache(cardHash);
      return true;
    } catch (error) {
      logger.error('Failed to release card hash', { error, cardHash });
      return false;
    }
  }

  /**
   * Layer 5: Check Redis cache
   */
  private async checkRedisCache(cardHash: string): Promise<{ isUnique: boolean }> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        // Redis not available - skip this layer
        return { isUnique: true };
      }

      const cacheKey = `${this.cachePrefix}${cardHash}`;
      const exists = await redisClient.exists(cacheKey);
      
      if (exists) {
        // Found in cache - not unique
        return { isUnique: false };
      }

      return { isUnique: true };
    } catch (error) {
      logger.warn('Redis cache check failed', { error, cardHash });
      // On error, continue to next layer
      return { isUnique: true };
    }
  }

  /**
   * Layer 4: Check bloom filter
   */
  private async checkBloomFilter(cardHash: string): Promise<{ isUnique: boolean }> {
    try {
      const bloomFilterService = getBloomFilterService();
      const exists = await bloomFilterService.checkCardHash(cardHash);
      
      // Bloom filter may have false positives, so we return true to continue checking
      // But log if potential duplicate detected
      if (exists) {
        logger.debug('Bloom filter potential duplicate', { cardHash });
      }

      return { isUnique: true }; // Always continue to next layer
    } catch (error) {
      logger.warn('Bloom filter check failed', { error, cardHash });
      // On error, continue to next layer
      return { isUnique: true };
    }
  }

  /**
   * Layer 3: Check uniqueness pool
   */
  private async checkUniquenessPool(cardHash: string): Promise<{ isUnique: boolean }> {
    try {
      const isReserved = await uniquenessPoolModel.isReserved(cardHash);
      return { isUnique: !isReserved };
    } catch (error) {
      logger.warn('Uniqueness pool check failed', { error, cardHash });
      // On error, continue to next layer
      return { isUnique: true };
    }
  }

  /**
   * Layer 2: Check database (global uniqueness index)
   */
  private async checkDatabase(cardHash: string): Promise<{ isUnique: boolean }> {
    try {
      const exists = await generatedCardModel.existsByHash(cardHash);
      return { isUnique: !exists };
    } catch (error) {
      logger.error('Database uniqueness check failed', { error, cardHash });
      // On error, assume not unique to be safe
      return { isUnique: false };
    }
  }

  /**
   * Cache card hash in Redis (Layer 5)
   */
  private async cacheInRedis(cardHash: string, ttlSeconds: number): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return;
      }

      const cacheKey = `${this.cachePrefix}${cardHash}`;
      await redisClient.setex(cacheKey, ttlSeconds, '1');
    } catch (error) {
      logger.warn('Failed to cache in Redis', { error, cardHash });
      // Non-critical error - continue
    }
  }

  /**
   * Remove from Redis cache
   */
  private async removeFromRedisCache(cardHash: string): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        return;
      }

      const cacheKey = `${this.cachePrefix}${cardHash}`;
      await redisClient.del(cacheKey);
    } catch (error) {
      logger.warn('Failed to remove from Redis cache', { error, cardHash });
      // Non-critical error - continue
    }
  }

  /**
   * Mark card as generated (add to all layers)
   */
  public async markAsGenerated(
    cardNumber: string,
    expiryDate: string,
    cvv: string
  ): Promise<void> {
    const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

    try {
      // Add to bloom filter (Layer 4)
      const bloomFilterService = getBloomFilterService();
      await bloomFilterService.addCardHash(cardHash).catch((err) => {
        logger.warn('Failed to add to bloom filter', { error: err, cardHash });
      });

      // Cache in Redis (Layer 5) with longer TTL
      await this.cacheInRedis(cardHash, config.multiTierCache.redis.ttl.card);

      // Release from uniqueness pool (Layer 3) - card is now in database
      await this.releaseCardHash(cardHash).catch((err) => {
        logger.warn('Failed to release from uniqueness pool', { error: err, cardHash });
      });
    } catch (error) {
      logger.error('Failed to mark card as generated', { error, cardHash });
      // Non-critical - card is already in database
    }
  }

  /**
   * Check uniqueness and reserve card hash in one operation
   * This is the recommended method for card generation
   */
  public async checkAndReserveCardHash(
    cardNumber: string,
    expiryDate: string,
    cvv: string,
    ttlSeconds: number = config.uniquenessService.poolTtlSeconds
  ): Promise<{ isUnique: boolean; reserved: boolean; cardHash: string }> {
    const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

    try {
      // First check uniqueness
      const uniquenessCheck = await this.checkUniqueness(cardNumber, expiryDate, cvv);
      
      if (!uniquenessCheck.isUnique) {
        return {
          isUnique: false,
          reserved: false,
          cardHash,
        };
      }

      // If unique, reserve it
      const reservation = await this.reserveCardHash(cardNumber, expiryDate, cvv, ttlSeconds);
      
      return {
        isUnique: true,
        reserved: reservation.reserved,
        cardHash,
      };
    } catch (error) {
      logger.error('checkAndReserveCardHash failed', { error, cardHash });
      return {
        isUnique: false,
        reserved: false,
        cardHash,
      };
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  public async checkUniquenessWithRetry(
    cardNumber: string,
    expiryDate: string,
    cvv: string,
    maxRetries: number = config.uniquenessService.retryAttempts
  ): Promise<UniquenessCheckResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.checkUniqueness(cardNumber, expiryDate, cvv);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          const backoffDelay = config.uniquenessService.retryBackoffBase * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          logger.debug('Retrying uniqueness check', {
            attempt: attempt + 1,
            maxRetries,
            backoffDelay,
          });
        }
      }
    }

    // All retries failed
    logger.error('Uniqueness check failed after retries', {
      maxRetries,
      error: lastError,
    });
    throw lastError || new Error('Uniqueness check failed');
  }
}

export const uniquenessService = new UniquenessService();

/**
 * Initialize uniqueness service
 * Performs health checks and validates all layers
 */
export const initializeUniquenessService = async (): Promise<void> => {
  try {
    logger.info('Initializing uniqueness service...');
    
    // Health check - verify all layers are accessible
    const redisClient = getRedisClient();
    if (!redisClient) {
      logger.warn('Redis not available - uniqueness service will have reduced functionality');
    }

    // Test database connection
    const testQuery = await database.query('SELECT 1').catch(() => null);
    if (!testQuery) {
      logger.warn('Database not available - uniqueness service will have reduced functionality');
    }

    logger.info('Uniqueness service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize uniqueness service', { error });
    throw error;
  }
};
