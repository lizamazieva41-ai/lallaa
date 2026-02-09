import { database } from './connection';
import { logger } from '../utils/logger';

async function resetDatabase(): Promise<void> {
  try {
    logger.info('Resetting database...');
    
    // Drop all tables in correct order
    const dropTables = [
      'DROP TABLE IF EXISTS test_cards CASCADE',
      'DROP TABLE IF EXISTS card_gateways CASCADE',
      'DROP TABLE IF EXISTS usage_logs CASCADE',
      'DROP TABLE IF EXISTS audit_logs CASCADE',
      'DROP TABLE IF EXISTS api_keys CASCADE',
      'DROP TABLE IF EXISTS bins CASCADE',
      'DROP TABLE IF EXISTS countries CASCADE',
      'DROP TABLE IF EXISTS users CASCADE',
    ];

    for (const dropTable of dropTables) {
      await database.query(dropTable);
      logger.info(`Dropped table`);
    }

    logger.info('Database reset completed');
  } catch (error) {
    logger.error('Failed to reset database', { error });
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  resetDatabase().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Reset failed:', error);
    process.exit(1);
  });
}

export { resetDatabase };