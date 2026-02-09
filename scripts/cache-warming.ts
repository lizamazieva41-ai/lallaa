/**
 * Cache Warming Script
 * Pre-loads popular BINs and frequently accessed data to cache
 * Run as: npm run cache:warm
 */

import { binMultiTierCache, statisticsMultiTierCache } from '../src/services/multiTierCache';
import { binService } from '../src/services/bin';
import database from '../src/database/connection';
import { logger } from '../src/utils/logger';

interface WarmingStats {
  binsWarmed: number;
  statisticsWarmed: number;
  totalDuration: number;
}

/**
 * Warm cache with popular BINs
 */
async function warmBINCache(limit: number = 100): Promise<number> {
  logger.info('Warming BIN cache...');

  try {
    // Get most frequently used BINs
    const query = `
      SELECT bin, COUNT(*) as usage_count
      FROM generated_cards
      GROUP BY bin
      ORDER BY usage_count DESC
      LIMIT $1
    `;
    const result = await database.query(query, [limit]);

    let warmed = 0;
    for (const row of result.rows) {
      try {
        const binInfo = await binService.lookup(row.bin);
        await binMultiTierCache.set(`lookup:${row.bin}`, binInfo, 86400); // 24 hours
        warmed++;
      } catch (error) {
        logger.warn('Failed to warm BIN cache', { error, bin: row.bin });
      }
    }

    logger.info('BIN cache warming completed', { warmed, total: result.rows.length });
    return warmed;
  } catch (error) {
    logger.error('Failed to warm BIN cache', { error });
    throw error;
  }
}

/**
 * Warm cache with statistics
 */
async function warmStatisticsCache(): Promise<number> {
  logger.info('Warming statistics cache...');

  try {
    // Get recent statistics
    const queries = [
      {
        key: 'total_cards',
        query: 'SELECT COUNT(*) as count FROM generated_cards',
      },
      {
        key: 'cards_today',
        query: `
          SELECT COUNT(*) as count
          FROM generated_cards
          WHERE generation_date >= CURRENT_DATE
        `,
      },
      {
        key: 'cards_this_week',
        query: `
          SELECT COUNT(*) as count
          FROM generated_cards
          WHERE generation_date >= CURRENT_DATE - INTERVAL '7 days'
        `,
      },
    ];

    let warmed = 0;
    for (const item of queries) {
      try {
        const result = await database.query(item.query);
        const value = result.rows[0].count;
        await statisticsMultiTierCache.set(item.key, { count: value }, 300); // 5 minutes
        warmed++;
      } catch (error) {
        logger.warn('Failed to warm statistics cache', { error, key: item.key });
      }
    }

    logger.info('Statistics cache warming completed', { warmed });
    return warmed;
  } catch (error) {
    logger.error('Failed to warm statistics cache', { error });
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

    const binsWarmed = await warmBINCache(100);
    const statisticsWarmed = await warmStatisticsCache();

    const stats: WarmingStats = {
      binsWarmed,
      statisticsWarmed,
      totalDuration: Date.now() - startTime,
    };

    console.log('\n=== Cache Warming Report ===');
    console.log(`BINs warmed: ${stats.binsWarmed}`);
    console.log(`Statistics warmed: ${stats.statisticsWarmed}`);
    console.log(`Total duration: ${stats.totalDuration}ms`);
    console.log('===========================\n');

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Cache warming script failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { warmBINCache, warmStatisticsCache };
