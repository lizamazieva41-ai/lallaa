/**
 * Data Migration Script
 * Populates uniqueness pool and bloom filter from existing cards
 * Run as: npm run migrate:data
 */

import database from '../src/database/connection';
import { logger } from '../src/utils/logger';
import { calculateCardHash } from '../src/models/generatedCard';
import { uniquenessPoolModel } from '../src/models/uniquenessPool';

interface MigrationStats {
  totalCards: number;
  uniquenessPoolPopulated: number;
  bloomFilterPopulated: number;
  errors: number;
  duration: number;
}

/**
 * Populate uniqueness pool from existing cards
 */
async function populateUniquenessPool(batchSize: number = 1000): Promise<number> {
  logger.info('Populating uniqueness pool from existing cards...');

  try {
    let offset = 0;
    let populated = 0;
    let totalProcessed = 0;

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM generated_cards`;
    const countResult = await database.query(countQuery);
    const totalCards = parseInt(countResult.rows[0].count, 10);

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

      // Add to uniqueness pool
      for (const row of batchResult.rows) {
        try {
          const cardHash = calculateCardHash(
            row.card_number,
            row.expiry_date,
            row.cvv
          );

          // Reserve in uniqueness pool (with long expiration)
          await uniquenessPoolModel.reserve(
            cardHash,
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            'migration'
          );
          populated++;
        } catch (error) {
          // Ignore duplicates - card already in pool
          logger.debug('Card already in uniqueness pool', {
            cardNumber: row.card_number.substring(0, 6) + '...',
          });
        }
      }

      totalProcessed += batchResult.rows.length;
      offset += batchSize;

      logger.info('Uniqueness pool migration progress', {
        processed: totalProcessed,
        populated,
        total: totalCards,
        progress: ((totalProcessed / totalCards) * 100).toFixed(2) + '%',
      });
    }

    logger.info('Uniqueness pool population completed', { populated });
    return populated;
  } catch (error) {
    logger.error('Failed to populate uniqueness pool', { error });
    throw error;
  }
}

/**
 * Populate bloom filter from existing cards
 */
async function populateBloomFilter(batchSize: number = 1000): Promise<number> {
  logger.info('Populating bloom filter from existing cards...');

  try {
    let offset = 0;
    let populated = 0;
    let totalProcessed = 0;

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM generated_cards`;
    const countResult = await database.query(countQuery);
    const totalCards = parseInt(countResult.rows[0].count, 10);

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

      // Add to bloom filter
      for (const row of batchResult.rows) {
        try {
          const cardHash = calculateCardHash(
            row.card_number,
            row.expiry_date,
            row.cvv
          );

          const bloomQuery = `SELECT add_card_hash_to_bloom($1)`;
          await database.query(bloomQuery, [cardHash]);
          populated++;
        } catch (error) {
          logger.warn('Failed to add to bloom filter', {
            error,
            cardNumber: row.card_number.substring(0, 6) + '...',
          });
        }
      }

      totalProcessed += batchResult.rows.length;
      offset += batchSize;

      logger.info('Bloom filter migration progress', {
        processed: totalProcessed,
        populated,
        total: totalCards,
        progress: ((totalProcessed / totalCards) * 100).toFixed(2) + '%',
      });
    }

    logger.info('Bloom filter population completed', { populated });
    return populated;
  } catch (error) {
    logger.error('Failed to populate bloom filter', { error });
    throw error;
  }
}

/**
 * Verify data migration completeness
 */
async function verifyMigration(): Promise<{
  uniquenessPoolCount: number;
  bloomFilterEnabled: boolean;
  totalCards: number;
}> {
  logger.info('Verifying data migration...');

  try {
    // Get uniqueness pool count
    const poolQuery = `SELECT COUNT(*) as count FROM card_uniqueness_pool`;
    const poolResult = await database.query(poolQuery);
    const uniquenessPoolCount = parseInt(poolResult.rows[0].count, 10);

    // Check bloom filter status
    const bloomQuery = `
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'pg_bloom'
      ) as exists
    `;
    const bloomResult = await database.query(bloomQuery);
    const bloomFilterEnabled = bloomResult.rows[0].exists;

    // Get total cards
    const totalQuery = `SELECT COUNT(*) as count FROM generated_cards`;
    const totalResult = await database.query(totalQuery);
    const totalCards = parseInt(totalResult.rows[0].count, 10);

    return {
      uniquenessPoolCount,
      bloomFilterEnabled,
      totalCards,
    };
  } catch (error) {
    logger.error('Failed to verify migration', { error });
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  try {
    await database.connect();
    logger.info('Database connected');

    const stats: MigrationStats = {
      totalCards: 0,
      uniquenessPoolPopulated: 0,
      bloomFilterPopulated: 0,
      errors: 0,
      duration: 0,
    };

    // Get total cards count
    const countQuery = `SELECT COUNT(*) as count FROM generated_cards`;
    const countResult = await database.query(countQuery);
    stats.totalCards = parseInt(countResult.rows[0].count, 10);

    console.log('\n=== Data Migration ===');
    console.log(`Total cards to migrate: ${stats.totalCards}`);
    console.log('======================\n');

    // Populate uniqueness pool
    if (process.env.SKIP_UNIQUENESS_POOL !== 'true') {
      console.log('Populating uniqueness pool...');
      stats.uniquenessPoolPopulated = await populateUniquenessPool(1000);
      console.log(`✅ Uniqueness pool populated: ${stats.uniquenessPoolPopulated} cards\n`);
    } else {
      console.log('⏭️  Skipping uniqueness pool population\n');
    }

    // Populate bloom filter
    if (process.env.SKIP_BLOOM_FILTER !== 'true') {
      console.log('Populating bloom filter...');
      stats.bloomFilterPopulated = await populateBloomFilter(1000);
      console.log(`✅ Bloom filter populated: ${stats.bloomFilterPopulated} cards\n`);
    } else {
      console.log('⏭️  Skipping bloom filter population\n');
    }

    // Verify migration
    console.log('Verifying migration...');
    const verification = await verifyMigration();
    console.log(`✅ Verification complete\n`);

    stats.duration = Date.now() - startTime;

    console.log('=== Migration Summary ===');
    console.log(`Total cards: ${stats.totalCards}`);
    console.log(`Uniqueness pool: ${stats.uniquenessPoolPopulated} cards`);
    console.log(`Bloom filter: ${stats.bloomFilterPopulated} cards`);
    console.log(`Duration: ${stats.duration}ms`);
    console.log(`Verification:`);
    console.log(`  - Uniqueness pool count: ${verification.uniquenessPoolCount}`);
    console.log(`  - Bloom filter enabled: ${verification.bloomFilterEnabled ? 'Yes' : 'No'}`);
    console.log('========================\n');

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Data migration script failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { populateUniquenessPool, populateBloomFilter, verifyMigration };
