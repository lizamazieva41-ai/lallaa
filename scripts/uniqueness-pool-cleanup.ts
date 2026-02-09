/**
 * Uniqueness Pool Cleanup Script
 * Removes expired reservations from the card_uniqueness_pool table
 * Run as: npm run uniqueness:cleanup
 */

import database from '../src/database/connection';
import { logger } from '../src/utils/logger';
import config from '../src/config';

interface CleanupStats {
  expiredReservations: number;
  totalReservations: number;
  cleanupDuration: number;
}

/**
 * Cleanup expired reservations from uniqueness pool
 */
async function cleanupExpiredReservations(): Promise<CleanupStats> {
  const startTime = Date.now();
  logger.info('Starting uniqueness pool cleanup...');

  try {
    // Get count of expired reservations
    const countQuery = `
      SELECT COUNT(*) as count
      FROM card_uniqueness_pool
      WHERE reserved_until < NOW()
    `;
    const countResult = await database.query(countQuery);
    const expiredCount = parseInt(countResult.rows[0].count, 10);

    // Get total reservations
    const totalQuery = `
      SELECT COUNT(*) as count
      FROM card_uniqueness_pool
    `;
    const totalResult = await database.query(totalQuery);
    const totalCount = parseInt(totalResult.rows[0].count, 10);

    // Delete expired reservations
    const deleteQuery = `
      DELETE FROM card_uniqueness_pool
      WHERE reserved_until < NOW()
    `;
    await database.query(deleteQuery);

    const duration = Date.now() - startTime;

    const stats: CleanupStats = {
      expiredReservations: expiredCount,
      totalReservations: totalCount - expiredCount,
      cleanupDuration: duration,
    };

    logger.info('Uniqueness pool cleanup completed', stats);
    return stats;
  } catch (error) {
    logger.error('Failed to cleanup uniqueness pool', { error });
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

    const stats = await cleanupExpiredReservations();

    console.log('\n=== Uniqueness Pool Cleanup Report ===');
    console.log(`Expired reservations removed: ${stats.expiredReservations}`);
    console.log(`Remaining reservations: ${stats.totalReservations}`);
    console.log(`Cleanup duration: ${stats.cleanupDuration}ms`);
    console.log('=====================================\n');

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Cleanup script failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { cleanupExpiredReservations };
