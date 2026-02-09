#!/usr/bin/env node
/**
 * Cache Warming Script
 * Pre-load frequently accessed BINs based on usage patterns (optional predictive caching)
 */

import dotenv from 'dotenv';
import { optimizedCacheManager } from '../../src/services/advancedCaching/optimizedCache';
import { binModel } from '../../src/models/bin';
import { logger } from '../../src/utils/logger';
import database from '../../src/database/connection';

dotenv.config({ path: '.env' });

/**
 * Get frequently accessed BINs from database
 */
async function getFrequentlyAccessedBINs(limit: number = 1000): Promise<string[]> {
  logger.info('Fetching frequently accessed BINs...');

  try {
    // Query for BINs with most lookups (if tracking is available)
    // For now, we'll use a simple query to get active BINs
    const query = `
      SELECT DISTINCT bin
      FROM bins
      WHERE is_active = true
      ORDER BY updated_at DESC
      LIMIT $1
    `;

    const result = await database.query(query, [limit]);
    const bins = result.rows.map((row: any) => row.bin);

    logger.info(`Found ${bins.length} BINs to warm cache`);
    return bins;
  } catch (error) {
    logger.error('Failed to fetch frequently accessed BINs', { error });
    return [];
  }
}

/**
 * Warm cache with BINs
 */
async function warmCache(bins: string[]): Promise<void> {
  logger.info('Warming cache...', { binCount: bins.length });

  let successCount = 0;
  let errorCount = 0;

  for (const bin of bins) {
    try {
      await optimizedCacheManager.lookup(bin);
      successCount++;
      
      if (successCount % 100 === 0) {
        logger.debug(`Warmed ${successCount}/${bins.length} BINs`);
      }
    } catch (error) {
      errorCount++;
      logger.warn(`Failed to warm cache for BIN ${bin}`, { error });
    }
  }

  logger.info('Cache warming completed', {
    total: bins.length,
    success: successCount,
    errors: errorCount,
  });
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);

  try {
    logger.info('Starting cache warming...', { limit });

    // Get frequently accessed BINs
    const bins = await getFrequentlyAccessedBINs(limit);

    if (bins.length === 0) {
      logger.warn('No BINs found to warm cache');
      process.exit(0);
    }

    // Warm cache
    await warmCache(bins);

    // Print cache metrics
    const metrics = optimizedCacheManager.getMetrics();
    logger.info('Cache metrics after warming', {
      overallHitRate: metrics.overall.overallHitRate.toFixed(2) + '%',
      totalRequests: metrics.overall.totalRequests,
      cacheEfficiency: metrics.overall.cacheEfficiency.toFixed(2) + '%',
    });

    process.exit(0);
  } catch (error) {
    logger.error('Cache warming failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in cache warming', { error });
    process.exit(1);
  });
}

export { getFrequentlyAccessedBINs, warmCache };
