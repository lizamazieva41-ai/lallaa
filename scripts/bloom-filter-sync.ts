/**
 * Bloom Filter Sync Script
 * Syncs card hashes from database to bloom filter
 * Run as: npm run bloom:sync
 */

import database from '../src/database/connection';
import { logger } from '../src/utils/logger';
import { calculateCardHash } from '../src/models/generatedCard';

interface SyncStats {
  totalCards: number;
  syncedCards: number;
  failedCards: number;
  syncDuration: number;
}

/**
 * Sync card hashes to bloom filter
 */
async function syncBloomFilter(batchSize: number = 1000): Promise<SyncStats> {
  const startTime = Date.now();
  logger.info('Starting bloom filter sync...');

  try {
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM generated_cards
    `;
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

          const bloomQuery = `SELECT add_card_hash_to_bloom($1)`;
          await database.query(bloomQuery, [cardHash]);
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
      logger.info('Bloom filter sync progress', {
        synced: syncedCards,
        failed: failedCards,
        total: totalCards,
        progress: ((syncedCards + failedCards) / totalCards * 100).toFixed(2) + '%',
      });
    }

    const duration = Date.now() - startTime;

    const stats: SyncStats = {
      totalCards,
      syncedCards,
      failedCards,
      syncDuration: duration,
    };

    logger.info('Bloom filter sync completed', stats);
    return stats;
  } catch (error) {
    logger.error('Failed to sync bloom filter', { error });
    throw error;
  }
}

/**
 * Verify sync completeness
 */
async function verifySync(): Promise<{
  totalCards: number;
  inBloomFilter: number;
  missing: number;
}> {
  try {
    // Sample check - verify a random set of cards
    const sampleQuery = `
      SELECT card_number, expiry_date, cvv
      FROM generated_cards
      ORDER BY RANDOM()
      LIMIT 100
    `;
    const sampleResult = await database.query(sampleQuery);

    let inBloomFilter = 0;
    let missing = 0;

    for (const row of sampleResult.rows) {
      const cardHash = calculateCardHash(
        row.card_number,
        row.expiry_date,
        row.cvv
      );

      const checkQuery = `SELECT check_card_hash_in_bloom($1) as exists`;
      const checkResult = await database.query(checkQuery, [cardHash]);

      if (checkResult.rows[0].exists) {
        inBloomFilter++;
      } else {
        missing++;
      }
    }

    const totalQuery = `SELECT COUNT(*) as count FROM generated_cards`;
    const totalResult = await database.query(totalQuery);
    const totalCards = parseInt(totalResult.rows[0].count, 10);

    return {
      totalCards,
      inBloomFilter,
      missing,
    };
  } catch (error) {
    logger.error('Failed to verify sync', { error });
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await database.connect();
    logger.info('Database connected');

    const stats = await syncBloomFilter(1000);

    console.log('\n=== Bloom Filter Sync Report ===');
    console.log(`Total cards: ${stats.totalCards}`);
    console.log(`Synced cards: ${stats.syncedCards}`);
    console.log(`Failed cards: ${stats.failedCards}`);
    console.log(`Sync duration: ${stats.syncDuration}ms`);
    console.log('================================\n');

    // Verify sync
    logger.info('Verifying sync completeness...');
    const verification = await verifySync();
    console.log('\n=== Sync Verification ===');
    console.log(`Total cards: ${verification.totalCards}`);
    console.log(`Sample in bloom filter: ${verification.inBloomFilter}/100`);
    console.log(`Sample missing: ${verification.missing}/100`);
    console.log('========================\n');

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Bloom filter sync script failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { syncBloomFilter, verifySync };
