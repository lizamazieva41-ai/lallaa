#!/usr/bin/env node
/**
 * Query Analysis Script
 * Analyze query execution plans and identify optimization opportunities
 */

import dotenv from 'dotenv';
import database from '../../src/database/connection';
import { logger } from '../../src/utils/logger';

dotenv.config({ path: '.env' });

interface QueryPlan {
  query: string;
  plan: any;
  executionTime: number;
  cost: number;
  rows: number;
  indexUsed?: string;
  scanType?: string;
}

/**
 * Analyze query execution plan
 */
async function analyzeQuery(query: string, params: any[] = []): Promise<QueryPlan> {
  const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${query}`;
  
  try {
    const startTime = Date.now();
    const result = await database.query(explainQuery, params);
    const executionTime = Date.now() - startTime;

    const plan = result.rows[0]?.['QUERY PLAN']?.[0] || result.rows[0]?.['query plan']?.[0] || result.rows[0];

    return {
      query,
      plan,
      executionTime,
      cost: plan?.Plan?.Total_Cost || plan?.Plan?.['Total Cost'] || 0,
      rows: plan?.Plan?.['Actual Rows'] || plan?.Plan?.['actual rows'] || 0,
      indexUsed: extractIndexUsed(plan),
      scanType: plan?.Plan?.['Node Type'] || plan?.Plan?.['node type'] || 'unknown',
    };
  } catch (error) {
    logger.error('Failed to analyze query', { query, error });
    throw error;
  }
}

/**
 * Extract index used from plan
 */
function extractIndexUsed(plan: any): string | undefined {
  if (!plan) return undefined;

  const node = plan.Plan || plan;
  
  if (node['Index Name'] || node['index name']) {
    return node['Index Name'] || node['index name'];
  }

  if (node['Index Cond'] || node['index cond']) {
    return 'index scan (condition present)';
  }

  if (node['SubPlan Name'] || node['subplan name']) {
    return extractIndexUsed(node['SubPlan Name'] || node['subplan name']);
  }

  return undefined;
}

/**
 * Analyze common BIN queries
 */
async function analyzeCommonQueries(): Promise<void> {
  logger.info('Analyzing common BIN queries...');

  const queries: Array<{ name: string; query: string; params?: any[] }> = [
    {
      name: 'BIN Lookup',
      query: 'SELECT * FROM bins WHERE bin = $1 LIMIT 1',
      params: ['400000'],
    },
    {
      name: 'Country Search',
      query: 'SELECT * FROM bins WHERE country_code = $1 AND is_active = true ORDER BY bank_name ASC',
      params: ['US'],
    },
    {
      name: 'Network Search',
      query: 'SELECT * FROM bins WHERE card_network = $1 AND is_active = true LIMIT 50',
      params: ['visa'],
    },
    {
      name: 'Statistics Query',
      query: 'SELECT country_code, COUNT(*) as count FROM bins WHERE is_active = true GROUP BY country_code ORDER BY count DESC LIMIT 10',
    },
    {
      name: 'Composite Search',
      query: 'SELECT * FROM bins WHERE country_code = $1 AND card_network = $2 AND is_active = true LIMIT 50',
      params: ['US', 'visa'],
    },
  ];

  const results: QueryPlan[] = [];

  for (const { name, query, params = [] } of queries) {
    logger.info(`Analyzing: ${name}`);
    try {
      const plan = await analyzeQuery(query, params);
      results.push(plan);

      logger.info(`Query: ${name}`, {
        executionTime: `${plan.executionTime}ms`,
        cost: plan.cost,
        rows: plan.rows,
        indexUsed: plan.indexUsed || 'none',
        scanType: plan.scanType,
      });

      // Check for optimization opportunities
      if (!plan.indexUsed && plan.scanType === 'Seq Scan') {
        logger.warn(`⚠️  ${name}: Sequential scan detected - consider adding index`, {
          query: query.substring(0, 100),
        });
      }

      if (plan.executionTime > 100) {
        logger.warn(`⚠️  ${name}: Slow query detected (${plan.executionTime}ms)`, {
          query: query.substring(0, 100),
        });
      }
    } catch (error) {
      logger.error(`Failed to analyze ${name}`, { error });
    }
  }

  // Generate summary report
  logger.info('=== Query Analysis Summary ===');
  results.forEach(plan => {
    logger.info(`${plan.query.substring(0, 50)}...`, {
      time: `${plan.executionTime}ms`,
      index: plan.indexUsed || 'none',
      scan: plan.scanType,
    });
  });
}

/**
 * Check index usage
 */
async function checkIndexUsage(): Promise<void> {
  logger.info('Checking index usage...');

  const query = `
    SELECT
      schemaname,
      tablename,
      indexname,
      idx_scan as index_scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE tablename = 'bins'
    ORDER BY idx_scan DESC;
  `;

  try {
    const result = await database.query(query);
    
    logger.info('Index usage statistics:');
    result.rows.forEach((row: any) => {
      logger.info(`Index: ${row.indexname}`, {
        scans: row.index_scans,
        tuplesRead: row.tuples_read,
        tuplesFetched: row.tuples_fetched,
      });
    });

    // Check for unused indexes
    const unusedIndexes = result.rows.filter((row: any) => row.index_scans === 0);
    if (unusedIndexes.length > 0) {
      logger.warn('Unused indexes detected (consider removing):', {
        indexes: unusedIndexes.map((r: any) => r.indexname),
      });
    }
  } catch (error) {
    logger.error('Failed to check index usage', { error });
  }
}

/**
 * Check table statistics
 */
async function checkTableStatistics(): Promise<void> {
  logger.info('Checking table statistics...');

  const query = `
    SELECT
      schemaname,
      tablename,
      n_live_tup as live_tuples,
      n_dead_tup as dead_tuples,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    WHERE tablename = 'bins';
  `;

  try {
    const result = await database.query(query);
    
    if (result.rows.length > 0) {
      const stats = result.rows[0];
      logger.info('Table statistics:', {
        liveTuples: stats.live_tuples,
        deadTuples: stats.dead_tuples,
        lastVacuum: stats.last_vacuum || stats.last_autovacuum,
        lastAnalyze: stats.last_analyze || stats.last_autoanalyze,
      });

      // Check if VACUUM is needed
      if (stats.dead_tuples > stats.live_tuples * 0.1) {
        logger.warn('⚠️  High dead tuple ratio - consider running VACUUM', {
          deadTuples: stats.dead_tuples,
          liveTuples: stats.live_tuples,
          ratio: (stats.dead_tuples / stats.live_tuples * 100).toFixed(2) + '%',
        });
      }
    }
  } catch (error) {
    logger.error('Failed to check table statistics', { error });
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting query analysis...');

    // Connect to database
    await database.connect();

    // Analyze common queries
    await analyzeCommonQueries();

    // Check index usage
    await checkIndexUsage();

    // Check table statistics
    await checkTableStatistics();

    logger.info('Query analysis completed');

    process.exit(0);
  } catch (error) {
    logger.error('Query analysis failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in query analysis', { error });
    process.exit(1);
  });
}

export { analyzeQuery, checkIndexUsage, checkTableStatistics };
