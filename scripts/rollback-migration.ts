/**
 * Rollback Migration Script
 * Safely rolls back uniqueness enhancements
 * Run as: npm run migrate:rollback
 */

import database from '../src/database/connection';
import { logger } from '../src/utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Execute rollback migration
 */
async function rollbackMigration(): Promise<void> {
  logger.info('Starting rollback migration...');

  try {
    // Read rollback migration file
    const rollbackPath = join(__dirname, '../src/database/migrations/008_rollback_uniqueness_enhancements.sql');
    const rollbackSQL = readFileSync(rollbackPath, 'utf8');

    // Execute rollback
    await database.query(rollbackSQL);

    logger.info('Rollback migration completed successfully');
  } catch (error) {
    logger.error('Rollback migration failed', { error });
    throw error;
  }
}

/**
 * Verify rollback
 */
async function verifyRollback(): Promise<{
  uniquenessPoolExists: boolean;
  bloomFilterEnabled: boolean;
  advisoryLocksExist: boolean;
}> {
  try {
    // Check if uniqueness pool table exists
    const poolCheck = await database.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'card_uniqueness_pool'
      ) as exists
    `);
    const uniquenessPoolExists = poolCheck.rows[0].exists;

    // Check if bloom filter extension is enabled
    const bloomCheck = await database.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'pg_bloom'
      ) as exists
    `);
    const bloomFilterEnabled = bloomCheck.rows[0].exists;

    // Check if advisory lock functions exist
    const functionCheck = await database.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'reserve_card_hash'
      ) as exists
    `);
    const advisoryLocksExist = functionCheck.rows[0].exists;

    return {
      uniquenessPoolExists,
      bloomFilterEnabled,
      advisoryLocksExist,
    };
  } catch (error) {
    logger.error('Failed to verify rollback', { error });
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

    console.log('\n=== Rollback Migration ===');
    console.log('WARNING: This will roll back uniqueness enhancements!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    // Wait 5 seconds for user to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Executing rollback...\n');

    await rollbackMigration();

    // Verify rollback
    console.log('Verifying rollback...');
    const verification = await verifyRollback();
    console.log(`✅ Rollback verification complete\n`);

    console.log('=== Rollback Summary ===');
    console.log(`Uniqueness pool table exists: ${verification.uniquenessPoolExists ? 'Yes' : 'No'}`);
    console.log(`Bloom filter enabled: ${verification.bloomFilterEnabled ? 'Yes' : 'No'}`);
    console.log(`Advisory lock functions exist: ${verification.advisoryLocksExist ? 'Yes' : 'No'}`);
    console.log('========================\n');

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Rollback script failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { rollbackMigration, verifyRollback };
