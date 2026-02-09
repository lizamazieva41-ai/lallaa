/**
 * Uniqueness Validation Script
 * Validates that no duplicate cards exist in the database
 * Run as: npm run validate:uniqueness
 */

import database from '../src/database/connection';
import { logger } from '../src/utils/logger';

interface ValidationStats {
  totalCards: number;
  duplicateCards: number;
  uniquenessPoolSize: number;
  bloomFilterEnabled: boolean;
  validationDuration: number;
}

/**
 * Validate uniqueness in database
 */
async function validateDatabaseUniqueness(): Promise<{
  totalCards: number;
  duplicateCards: number;
}> {
  logger.info('Validating database uniqueness...');

  try {
    // Check for duplicates using composite unique constraint
    const duplicateQuery = `
      SELECT card_number, expiry_date, cvv, COUNT(*) as count
      FROM generated_cards
      GROUP BY card_number, expiry_date, cvv
      HAVING COUNT(*) > 1
    `;
    const duplicateResult = await database.query(duplicateQuery);

    const totalQuery = `SELECT COUNT(*) as count FROM generated_cards`;
    const totalResult = await database.query(totalQuery);
    const totalCards = parseInt(totalResult.rows[0].count, 10);

    return {
      totalCards,
      duplicateCards: duplicateResult.rows.length,
    };
  } catch (error) {
    logger.error('Failed to validate database uniqueness', { error });
    throw error;
  }
}

/**
 * Check uniqueness pool integrity
 */
async function checkUniquenessPoolIntegrity(): Promise<number> {
  logger.info('Checking uniqueness pool integrity...');

  try {
    const query = `
      SELECT COUNT(*) as count
      FROM card_uniqueness_pool
      WHERE reserved_until > NOW()
    `;
    const result = await database.query(query);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to check uniqueness pool integrity', { error });
    throw error;
  }
}

/**
 * Check bloom filter status
 */
async function checkBloomFilterStatus(): Promise<boolean> {
  logger.info('Checking bloom filter status...');

  try {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'pg_bloom'
      ) as exists
    `;
    const result = await database.query(query);
    return result.rows[0].exists;
  } catch (error) {
    logger.error('Failed to check bloom filter status', { error });
    return false;
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

    const dbValidation = await validateDatabaseUniqueness();
    const poolSize = await checkUniquenessPoolIntegrity();
    const bloomFilterEnabled = await checkBloomFilterStatus();

    const stats: ValidationStats = {
      totalCards: dbValidation.totalCards,
      duplicateCards: dbValidation.duplicateCards,
      uniquenessPoolSize: poolSize,
      bloomFilterEnabled,
      validationDuration: Date.now() - startTime,
    };

    console.log('\n=== Uniqueness Validation Report ===');
    console.log(`Total cards: ${stats.totalCards}`);
    console.log(`Duplicate cards found: ${stats.duplicateCards}`);
    console.log(`Active uniqueness pool reservations: ${stats.uniquenessPoolSize}`);
    console.log(`Bloom filter enabled: ${stats.bloomFilterEnabled ? 'Yes' : 'No'}`);
    console.log(`Validation duration: ${stats.validationDuration}ms`);

    if (stats.duplicateCards > 0) {
      console.log('\n⚠️  WARNING: Duplicate cards detected!');
      console.log('This indicates a problem with the uniqueness guarantee.');
    } else {
      console.log('\n✅ No duplicates found - uniqueness guarantee maintained');
    }

    console.log('====================================\n');

    await database.disconnect();
    process.exit(stats.duplicateCards > 0 ? 1 : 0);
  } catch (error) {
    logger.error('Uniqueness validation script failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { validateDatabaseUniqueness, checkUniquenessPoolIntegrity, checkBloomFilterStatus };
