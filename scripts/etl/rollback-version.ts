#!/usr/bin/env node
/**
 * ETL Data Rollback Script (by version hash)
 *
 * Purpose:
 *  - Use the ETL data version (stored in bins.source_version and etl_runs.source_version)
 *    to rollback a specific ETL run.
 *
 * Usage:
 *  - Rollback by explicit version hash:
 *      ts-node scripts/etl/rollback-version.ts --version=<hash>
 *
 *  - Rollback by ETL run id (UUID):
 *      ts-node scripts/etl/rollback-version.ts --run-id=<uuid>
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env' });

interface RollbackArgs {
  version?: string;
  runId?: string;
}

function parseArgs(argv: string[]): RollbackArgs {
  const version = argv.find(a => a.startsWith('--version='))?.split('=')[1];
  const runId = argv.find(a => a.startsWith('--run-id='))?.split('=')[1];
  return { version, runId };
}

async function resolveVersionFromRun(pool: Pool, runId: string): Promise<string> {
  const res = await pool.query(
    'SELECT source_version FROM etl_runs WHERE id = $1 LIMIT 1',
    [runId]
  );

  if (res.rows.length === 0 || !res.rows[0].source_version) {
    throw new Error(`No etl_runs entry found for id=${runId} with a source_version`);
  }

  return res.rows[0].source_version;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.version && !args.runId) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: rollback-version.ts --version=<hash> OR --run-id=<uuid>'
    );
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.connect();

    let version = args.version;
    if (!version && args.runId) {
      version = await resolveVersionFromRun(pool, args.runId);
    }

    if (!version) {
      throw new Error('Unable to resolve version hash from arguments');
    }

    // Count records before deletion
    const beforeRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM bins WHERE source_version = $1',
      [version]
    );
    const beforeCount: number = beforeRes.rows[0]?.count ?? 0;

    // eslint-disable-next-line no-console
    console.log(
      `Found ${beforeCount} records in bins with source_version=${version}. Proceeding with rollback...`
    );

    // Delete all records for this version
    await pool.query('DELETE FROM bins WHERE source_version = $1', [version]);

    const afterRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM bins WHERE source_version = $1',
      [version]
    );
    const afterCount: number = afterRes.rows[0]?.count ?? 0;

    // Optionally mark the ETL run as rolled_back
    if (args.runId) {
      await pool.query(
        "UPDATE etl_runs SET status = 'rolled_back' WHERE id = $1",
        [args.runId]
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `Rollback complete for version=${version}. Before=${beforeCount}, After=${afterCount}`
    );

    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Rollback failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

