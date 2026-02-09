import database from '../src/database/connection';
import { logger } from '../src/utils/logger';

/**
 * Script to create monthly partitions for generated_cards table
 * This should be run monthly (e.g., via cron) to create partitions in advance
 */

interface PartitionInfo {
  startDate: string;
  endDate: string;
  partitionName: string;
}

/**
 * Create a monthly partition for generated_cards table
 */
async function createPartition(startDate: Date, endDate: Date): Promise<void> {
  const partitionName = `generated_cards_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`;
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Check if partition already exists
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = $1
    ) as exists
  `;

  const checkResult = await database.query<{ exists: boolean }>(checkQuery, [partitionName]);
  
  if (checkResult.rows[0].exists) {
    logger.info(`Partition ${partitionName} already exists`, { startDate: startDateStr, endDate: endDateStr });
    return;
  }

  // Create partition
  const createQuery = `
    CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF generated_cards
    FOR VALUES FROM ($1) TO ($2)
  `;

  try {
    await database.query(createQuery, [startDateStr, endDateStr]);
    logger.info(`Created partition ${partitionName}`, { startDate: startDateStr, endDate: endDateStr });
  } catch (error) {
    logger.error(`Failed to create partition ${partitionName}`, { error, startDate: startDateStr, endDate: endDateStr });
    throw error;
  }
}

/**
 * Create partitions for the next N months
 */
async function createFuturePartitions(monthsAhead: number = 3): Promise<void> {
  const now = new Date();
  const partitions: PartitionInfo[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const startDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    
    partitions.push({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      partitionName: `generated_cards_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`,
    });
  }

  logger.info(`Creating ${partitions.length} future partitions`, { monthsAhead });

  for (const partition of partitions) {
    const startDate = new Date(partition.startDate);
    const endDate = new Date(partition.endDate);
    await createPartition(startDate, endDate);
  }
}

/**
 * Archive old partitions (older than N months)
 * This moves old partitions to an archive schema or marks them for deletion
 */
async function archiveOldPartitions(monthsToKeep: number = 12): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
  cutoffDate.setDate(1); // First day of the month

  const query = `
    SELECT
      schemaname,
      tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'generated_cards_%'
      AND tablename != 'generated_cards'
    ORDER BY tablename
  `;

  try {
    const result = await database.query<{ schemaname: string; tablename: string }>(query);
    
    for (const row of result.rows) {
      // Extract year and month from partition name (format: generated_cards_YYYY_MM)
      const match = row.tablename.match(/generated_cards_(\d{4})_(\d{2})/);
      if (!match) continue;

      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
      const partitionDate = new Date(year, month, 1);

      if (partitionDate < cutoffDate) {
        logger.info(`Partition ${row.tablename} is older than ${monthsToKeep} months`, {
          partitionDate: partitionDate.toISOString().split('T')[0],
          cutoffDate: cutoffDate.toISOString().split('T')[0],
        });
        // In production, you might want to:
        // 1. Move to archive schema
        // 2. Export to cold storage
        // 3. Delete (if data retention policy allows)
        // For now, we just log it
      }
    }
  } catch (error) {
    logger.error('Failed to check old partitions', { error });
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';

  try {
    await database.connect();
    logger.info('Database connected');

    switch (command) {
      case 'create':
        const monthsAhead = args[1] ? parseInt(args[1], 10) : 3;
        await createFuturePartitions(monthsAhead);
        break;

      case 'archive':
        const monthsToKeep = args[1] ? parseInt(args[1], 10) : 12;
        await archiveOldPartitions(monthsToKeep);
        break;

      case 'list':
        const listQuery = `
          SELECT
            tablename,
            pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename LIKE 'generated_cards_%'
          ORDER BY tablename
        `;
        const listResult = await database.query<{ tablename: string; size: string }>(listQuery);
        console.log('\nPartitions:');
        for (const row of listResult.rows) {
          console.log(`  ${row.tablename} - ${row.size}`);
        }
        break;

      default:
        console.log('Usage:');
        console.log('  npm run partition:create [monthsAhead]  - Create future partitions');
        console.log('  npm run partition:archive [monthsToKeep] - Archive old partitions');
        console.log('  npm run partition:list - List all partitions');
        process.exit(1);
    }

    await database.disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  } catch (error) {
    logger.error('Partition script failed', { error });
    await database.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createPartition, createFuturePartitions, archiveOldPartitions };
