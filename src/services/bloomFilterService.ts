/**
 * Bloom Filter Service
 * Service for interacting with PostgreSQL pg_bloom extension
 */

import database from '../database/connection';
import { logger } from '../utils/logger';
import { calculateCardHash } from '../models/generatedCard';

class BloomFilterService {
  private isEnabled: boolean = false;

  /**
   * Initialize bloom filter service
   */
  public async initialize(): Promise<void> {
    try {
      // Check if pg_bloom extension is enabled
      const checkQuery = `
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_bloom'
        ) as exists
      `;
      const result = await database.query(checkQuery);
      this.isEnabled = result.rows[0].exists;

      if (this.isEnabled) {
        logger.info('Bloom filter service initialized', { enabled: true });
      } else {
        logger.warn('Bloom filter extension not enabled', { enabled: false });
      }
    } catch (error) {
      logger.error('Failed to initialize bloom filter service', { error });
      this.isEnabled = false;
    }
  }

  /**
   * Check if bloom filter is enabled
   */
  public isBloomFilterEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Add card hash to bloom filter
   */
  public async addCardHash(cardHash: string): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const query = `SELECT add_card_hash_to_bloom($1)`;
      await database.query(query, [cardHash]);
      return true;
    } catch (error) {
      logger.warn('Failed to add card hash to bloom filter', { error, cardHash: cardHash.substring(0, 16) + '...' });
      return false;
    }
  }

  /**
   * Check if card hash exists in bloom filter
   */
  public async checkCardHash(cardHash: string): Promise<boolean> {
    if (!this.isEnabled) {
      return false; // If not enabled, return false (will fall through to next layer)
    }

    try {
      const query = `SELECT check_card_hash_in_bloom($1) as exists`;
      const result = await database.query(query, [cardHash]);
      return result.rows[0].exists;
    } catch (error) {
      logger.warn('Failed to check card hash in bloom filter', { error, cardHash: cardHash.substring(0, 16) + '...' });
      return false; // On error, return false to allow fall through
    }
  }

  /**
   * Sync bloom filter from database
   */
  public async syncBloomFilterFromDb(batchSize: number = 1000): Promise<{
    totalCards: number;
    syncedCards: number;
    failedCards: number;
  }> {
    if (!this.isEnabled) {
      logger.warn('Bloom filter not enabled, skipping sync');
      return { totalCards: 0, syncedCards: 0, failedCards: 0 };
    }

    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM generated_cards`;
      const countResult = await database.query(countQuery);
      const totalCards = parseInt(countResult.rows[0].count, 10);

      let syncedCards = 0;
      let failedCards = 0;
      let offset = 0;

      // Process in batches
      while (offset < totalCards) {
        const batchQuery = `
          SELECT card_number, expiry_date, cvv
          FROM generated_cards
          ORDER BY id
          LIMIT $1 OFFSET $2
        `;
        const batchResult = await database.query(batchQuery, [batchSize, offset]);

        if (batchResult.rows.length === 0) {
          break;
        }

        // Add each card hash to bloom filter
        for (const row of batchResult.rows) {
          try {
            const cardHash = calculateCardHash(
              row.card_number,
              row.expiry_date,
              row.cvv
            );

            await this.addCardHash(cardHash);
            syncedCards++;
          } catch (error) {
            logger.warn('Failed to sync card to bloom filter', {
              error,
              cardNumber: row.card_number.substring(0, 6) + '...',
            });
            failedCards++;
          }
        }

        offset += batchSize;

        if (offset % (batchSize * 10) === 0) {
          logger.info('Bloom filter sync progress', {
            synced: syncedCards,
            failed: failedCards,
            total: totalCards,
            progress: ((syncedCards + failedCards) / totalCards * 100).toFixed(2) + '%',
          });
        }
      }

      logger.info('Bloom filter sync completed', {
        totalCards,
        syncedCards,
        failedCards,
      });

      return { totalCards, syncedCards, failedCards };
    } catch (error) {
      logger.error('Failed to sync bloom filter from database', { error });
      throw error;
    }
  }

  /**
   * Get bloom filter statistics
   */
  public async getStatistics(): Promise<{
    enabled: boolean;
    totalItems?: number;
  }> {
    if (!this.isEnabled) {
      return { enabled: false };
    }

    try {
      // Get approximate count from bloom filter table
      const query = `SELECT COUNT(*) as count FROM bloom_filter_cards`;
      const result = await database.query(query);
      return {
        enabled: true,
        totalItems: parseInt(result.rows[0].count, 10),
      };
    } catch (error) {
      logger.warn('Failed to get bloom filter statistics', { error });
      return { enabled: true };
    }
  }

  /**
   * Health check for bloom filter
   */
  public async healthCheck(): Promise<{ status: string; enabled: boolean }> {
    try {
      if (!this.isEnabled) {
        return { status: 'disabled', enabled: false };
      }

      // Simple check - try to query the bloom filter table
      await database.query('SELECT 1 FROM bloom_filter_cards LIMIT 1');
      return { status: 'healthy', enabled: true };
    } catch (error) {
      logger.error('Bloom filter health check failed', { error });
      return { status: 'unhealthy', enabled: this.isEnabled };
    }
  }
}

// Singleton instance
let bloomFilterServiceInstance: BloomFilterService | null = null;

export const getBloomFilterService = (): BloomFilterService => {
  if (!bloomFilterServiceInstance) {
    bloomFilterServiceInstance = new BloomFilterService();
  }
  return bloomFilterServiceInstance;
};

export const initializeBloomFilterService = async (): Promise<void> => {
  const service = getBloomFilterService();
  await service.initialize();
};
