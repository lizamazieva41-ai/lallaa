#!/usr/bin/env node
/**
 * ETL Main Orchestrator
 * Purpose: Coordinate the full ETL pipeline: Extract -> Normalize -> Merge -> Load
 * Usage: npx ts-node scripts/etl/etl.ts [--source <source>] [--dry-run]
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import {
  extractFromJSON,
  extractFromCSV,
  extractFromYAML,
  extractFromDirectory,
  extractFromHandyAPI,
  ExtractionResult,
  SourceInfo,
  SOURCE_PRIORITY,
} from './extract';

import {
  normalizeBatch,
  validateNormalized,
  NormalizedRecord,
} from './normalize';

import {
  mergeRecords,
  deduplicate,
  validateMerged,
  getMergeStats,
  MergeResult,
} from './merge';

import {
  loadRecords,
  rebuildIndexes,
  getLastETLRun,
  LoadOptions,
} from './load';

import { enrichWithBinlist } from './enrich-binlist';

dotenv.config({ path: '.env' });

// Configuration
const SOURCES_DIR = process.env.ETL_SOURCES_DIR || './data/sources';
const LICENSE_DIR = './licenses';
const DRY_RUN = process.argv.includes('--dry-run') || process.env.ETL_DRY_RUN === 'true';
const SOURCE_FILTER = process.argv.find(a => a.startsWith('--source='))?.split('=')[1];
const ENRICH = process.argv.find(a => a.startsWith('--enrich='))?.split('=')[1];
const ENRICH_ONLY = process.argv.includes('--enrich-only');
const ENRICH_LIMIT = parseInt(
  (process.argv.find(a => a.startsWith('--enrich-limit='))?.split('=')[1] || ''),
  10
) || 5;
const ENRICH_DELAY_MS = parseInt(
  (process.argv.find(a => a.startsWith('--enrich-delay-ms='))?.split('=')[1] || ''),
  10
) || 1250;
const API_URL = process.env.API_URL || 'http://localhost:8080';
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.error('ERROR: ADMIN_SECRET environment variable is required for ETL operations');
  process.exit(1);
}

interface ETLConfig {
  sourcesDir: string;
  licenseDir: string;
  dryRun: boolean;
  batchSize: number;
  skipValidation: boolean;
}

interface SourceConfig {
  name: string;
  path: string;
  format: 'json' | 'csv' | 'yaml' | 'directory';
  version?: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: ETLConfig = {
  sourcesDir: SOURCES_DIR,
  licenseDir: LICENSE_DIR,
  dryRun: DRY_RUN,
  batchSize: 500,
  skipValidation: false,
};

// Source configurations
const SOURCE_CONFIGS: SourceConfig[] = [
  {
    name: 'binlist/data',
    // binlist/data repository provides a CSV of IIN ranges (ranges.csv)
    // https://github.com/binlist/data
    path: './data/sources/binlist-data/ranges.csv',
    format: 'csv',
    version: 'latest',
    enabled: true,
  },
  {
    name: 'venelinkochev/bin-list-data',
    // https://github.com/venelinkochev/bin-list-data
    path: './data/sources/bin-list-data/bin-list-data.csv',
    format: 'csv',
    version: 'latest',
    enabled: true,
  },
  {
    name: 'aderyabin/bin_list',
    // https://github.com/aderyabin/bin_list
    path: './data/sources/bin_list/bin_list.yml',
    format: 'yaml',
    version: 'latest',
    enabled: true,
  },
  {
    name: 'handyapi/card-bin-list',
    // HandyAPI integration is supported via a cached JSON file.
    // To enable: set enabled=true and ensure the cache exists at the configured path,
    // or extend the ETL to fetch/refresh it before extraction.
    path: './data/sources/handyapi/card-bin-list.json',
    format: 'json',
    version: process.env.HANDYAPI_VERSION || 'latest',
    enabled: false,
  },
];

async function getSourceVersion(sourcePath: string): Promise<string> {
  const gitPath = path.join(sourcePath, '.git');
  if (fs.existsSync(gitPath)) {
    try {
      const { execSync } = await import('child_process');
      return execSync('git rev-parse HEAD', { cwd: sourcePath, encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Flush API cache after successful ETL
 */
async function flushCache(): Promise<boolean> {
  if (DRY_RUN) {
    console.log('[Cache] Would flush cache (dry run)');
    return true;
  }

  try {
    const cacheFlushUrl = `${API_URL}/api/v1/admin/cache/flush`;
    const response = await axios.post(
      cacheFlushUrl,
      {},
      {
        headers: {
          'X-Admin-Secret': ADMIN_SECRET,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data.success) {
      console.log(`[Cache] Flushed successfully (previous size: ${response.data.previousSize})`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[Cache] Cache flush failed (API may not be running)');
    console.warn(`[Cache] Error: ${(error as Error).message}`);
    return false;
  }
}

async function runETL(config: ETLConfig): Promise<{
  success: boolean;
  result: {
    extracted: number;
    normalized: number;
    merged: number;
    loaded: { inserted: number; updated: number; failed: number };
    stats: ReturnType<typeof getMergeStats>;
  };
  errors: string[];
}> {
  const errors: string[] = [];
  let extractedTotal = 0;
  let normalizedTotal = 0;
  let mergedTotal = 0;
  const loadedStats = { inserted: 0, updated: 0, failed: 0 };

  console.log('='.repeat(60));
  console.log('ETL Pipeline Started');
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Gather and check licenses
  console.log('[Step 1/4] Gathering and checking licenses...');
  
  // Run license gathering script if not in dry run
  if (!config.dryRun) {
    try {
      const { execSync } = await import('child_process');
      execSync('./scripts/licenses/gather.sh', { cwd: process.cwd(), stdio: 'inherit' });
      console.log('License gathering completed successfully');
    } catch (error) {
      console.warn('License gathering failed, continuing with existing licenses');
      console.warn(`Error: ${(error as Error).message}`);
    }
  }
  
  const licenseCheck = await checkLicenses(config.sourcesDir, config.licenseDir);
  if (!licenseCheck.valid) {
    console.warn('Warning: Some licenses could not be verified');
    licenseCheck.missing.forEach(m => console.warn(`  - ${m}`));
    if (!config.dryRun) {
      console.error('ETL cannot proceed without proper license compliance');
      process.exit(1);
    }
  }
  console.log(`Licenses OK (${licenseCheck.found.length} sources)`);
  console.log('');

  // Create database pool
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'bincheck',
    password: process.env.POSTGRES_PASSWORD || 'bincheck_secret',
    database: process.env.POSTGRES_DB || 'bincheck',
    max: 10,
  });

  try {
    // Step 2: Extract
    console.log('[Step 2/4] Extracting data...');
    const extractionResults: ExtractionResult[] = [];

    for (const sourceConfig of SOURCE_CONFIGS) {
      if (SOURCE_FILTER && sourceConfig.name !== SOURCE_FILTER) {
        continue;
      }

      if (!sourceConfig.enabled) {
        console.log(`  Skipping: ${sourceConfig.name} (disabled)`);
        continue;
      }

      const sourcePath = path.resolve(sourceConfig.path);
      if (!fs.existsSync(sourcePath)) {
        console.log(`  Skipping: ${sourceConfig.name} (path not found: ${sourcePath})`);
        continue;
      }

      console.log(`  Extracting from ${sourceConfig.name}...`);
      const version = await getSourceVersion(sourcePath);

      try {
        let result: ExtractionResult;

        switch (sourceConfig.format) {
          case 'json':
            if (sourceConfig.name === 'handyapi/card-bin-list') {
              result = await extractFromHandyAPI(sourcePath, sourceConfig.name, version);
            } else {
              result = await extractFromJSON(sourcePath, sourceConfig.name, version);
            }
            break;
          case 'csv':
            // Some sources use different CSV header conventions
            if (sourceConfig.name === 'binlist/data') {
              // ranges.csv headers:
              // iin_start,iin_end,number_length,number_luhn,scheme,brand,type,prepaid,country,bank_name,...
              result = await extractFromCSV(sourcePath, sourceConfig.name, version, {
                bin: 'iin_start',
                scheme: 'scheme',
                type: 'type',
                issuer: 'bank_name',
                country: 'country',
                countryCode: 'country',
              });
            } else if (sourceConfig.name === 'venelinkochev/bin-list-data') {
              // bin-list-data.csv headers:
              // BIN,Brand,Type,Category,Issuer,IssuerPhone,IssuerUrl,isoCode2,isoCode3,CountryName
              result = await extractFromCSV(sourcePath, sourceConfig.name, version, {
                bin: 'BIN',
                scheme: 'Brand',
                type: 'Type',
                issuer: 'Issuer',
                country: 'CountryName',
                countryCode: 'isoCode2',
              });
            } else {
              result = await extractFromCSV(sourcePath, sourceConfig.name, version);
            }
            break;
          case 'yaml':
            result = await extractFromYAML(sourcePath, sourceConfig.name, version);
            break;
          case 'directory':
            result = await extractFromDirectory(sourcePath, sourceConfig.name, version);
            break;
          default:
            continue;
        }

        extractionResults.push(result);
        extractedTotal += result.records.length;

        if (result.errors.length > 0) {
          errors.push(...result.errors.map(e => `${sourceConfig.name}: ${e}`));
        }

        console.log(`    Extracted ${result.records.length} records`);
      } catch (err) {
        errors.push(`Extraction error for ${sourceConfig.name}: ${(err as Error).message}`);
        console.error(`    Error: ${(err as Error).message}`);
      }
    }

    console.log(`Extracted ${extractedTotal} total records`);
    console.log('');

    // Step 3: Normalize
    console.log('[Step 3/4] Normalizing data...');
    const allNormalized: Array<{ info: SourceInfo; records: NormalizedRecord[] }> = [];

    for (const result of extractionResults) {
      const normalized = normalizeBatch(result.records, result.source.priority);
      const validation = validateNormalized(normalized.records);

      console.log(`  ${result.source.name}: ${normalized.records.length} normalized, ${validation.invalid.length} invalid`);

      if (validation.valid.length > 0) {
        allNormalized.push({
          info: result.source,
          records: validation.valid,
        });
      }

      normalizedTotal += normalized.records.length;
      errors.push(...normalized.errors);
    }

    console.log(`Normalized ${normalizedTotal} total records`);
    console.log('');

    // Step 4: Merge
    console.log('[Step 4/4] Merging and loading data...');

    // Deduplicate
    const allRecords = allNormalized.flatMap(n => n.records);
    const dedupResult = deduplicate(allRecords);
    console.log(`  Deduplicated: ${allRecords.length} -> ${dedupResult.unique.length} (removed ${dedupResult.duplicates})`);

    // Merge
    const mergeResult = await mergeRecords(
      allNormalized.map(n => ({
        info: n.info,
        records: n.records,
      }))
    );

    // Validate merged
    const mergedValidation = validateMerged(mergeResult.merged);
    console.log(`  Merged: ${mergeResult.merged.length} unique BINs`);
    console.log(`  Valid: ${mergedValidation.valid.length}, Invalid: ${mergedValidation.invalid.length}`);

    mergedTotal = mergedValidation.valid.length;

    // Optional enrichment (API tier) - intentionally capped to avoid violating remote rate limits.
    if (ENRICH === 'binlist' && mergedValidation.valid.length > 0) {
      console.log('');
      console.log(`[Enrich] binlist.net enabled (limit=${ENRICH_LIMIT}, delayMs=${ENRICH_DELAY_MS})`);
      const enrichResult = await enrichWithBinlist(mergedValidation.valid, {
        enrichLimit: ENRICH_LIMIT,
        delayMs: ENRICH_DELAY_MS,
        cacheFilePath: path.join(config.sourcesDir, '..', 'cache', 'binlist.net.json'),
        onlyIfMissing: true,
        timeoutMs: 10000,
      });
      console.log(
        `[Enrich] attempted=${enrichResult.attempted} enriched=${enrichResult.enriched} cacheHits=${enrichResult.cacheHits} errors=${enrichResult.errors}`
      );

      if (ENRICH_ONLY) {
        console.log('[Enrich] --enrich-only enabled; skipping load step');
        return {
          success: enrichResult.errors === 0,
          result: {
            extracted: extractedTotal,
            normalized: normalizedTotal,
            merged: mergedTotal,
            loaded: { inserted: 0, updated: 0, failed: 0 },
            stats: getMergeStats(mergeResult),
          },
          errors,
        };
      }
    }

    // Load
    if (mergedValidation.valid.length > 0) {
      const loadOptions: LoadOptions = {
        batchSize: config.batchSize,
        skipValidation: config.skipValidation,
        dryRun: config.dryRun,
      };

      console.log(`  Loading ${mergedValidation.valid.length} records...`);
      const loadResult = await loadRecords(pool, mergedValidation.valid, loadOptions);

      loadedStats.inserted = loadResult.inserted;
      loadedStats.updated = loadResult.updated;
      loadedStats.failed = loadResult.failed;

      if (loadResult.errors.length > 0) {
        errors.push(...loadResult.errors);
      }

      console.log(`  Inserted: ${loadResult.inserted}`);
      console.log(`  Updated: ${loadResult.updated}`);
      console.log(`  Failed: ${loadResult.failed}`);

      // Rebuild indexes
      if (!config.dryRun && loadResult.inserted + loadResult.updated > 0) {
        console.log('  Rebuilding indexes...');
        await rebuildIndexes(pool);
      }

      // Flush API cache
      if (!config.dryRun && (loadResult.inserted > 0 || loadResult.updated > 0)) {
        console.log('  Flushing API cache...');
        await flushCache();
      }
    }

    // Print stats
    const stats = getMergeStats(mergeResult);
    console.log('');
    console.log('='.repeat(60));
    console.log('ETL Pipeline Completed');
    console.log('='.repeat(60));
    console.log(`Sources processed: ${extractionResults.length}`);
    console.log(`Records extracted: ${extractedTotal}`);
    console.log(`Records normalized: ${normalizedTotal}`);
    console.log(`Unique BINs: ${mergedTotal}`);
    console.log(`Records loaded: ${loadedStats.inserted} inserted, ${loadedStats.updated} updated, ${loadedStats.failed} failed`);
    console.log('');

    if (stats.sourcesBreakdown) {
      console.log('Source breakdown:');
      for (const [source, count] of Object.entries(stats.sourcesBreakdown)) {
        console.log(`  ${source}: ${count}`);
      }
    }

    return {
      success: loadedStats.failed === 0,
      result: {
        extracted: extractedTotal,
        normalized: normalizedTotal,
        merged: mergedTotal,
        loaded: loadedStats,
        stats,
      },
      errors,
    };

  } finally {
    await pool.end();
  }
}

/**
 * Check licenses before ETL
 */
async function checkLicenses(
  sourcesDir: string,
  licenseDir: string
): Promise<{ valid: boolean; found: string[]; missing: string[] }> {
  const found: string[] = [];
  const missing: string[] = [];

  // Check if license directory exists
  if (!fs.existsSync(licenseDir)) {
    return { valid: false, found: [], missing: SOURCE_CONFIGS.map(s => s.name) };
  }

  // Check for each source license
  for (const source of SOURCE_CONFIGS) {
    const licenseFile = path.join(licenseDir, `${source.name}.LICENSE`);
    if (fs.existsSync(licenseFile)) {
      found.push(source.name);
    } else {
      missing.push(source.name);
    }
  }

  return {
    valid: missing.length === 0,
    found,
    missing,
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const config = DEFAULT_CONFIG;

  console.log('');
  console.log('BIN Check API - ETL Pipeline');
  console.log('');

  try {
    const result = await runETL(config);

    console.log('');
    if (result.errors.length > 0) {
      console.log('Errors encountered:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('ETL failed:', err);
    process.exit(1);
  }
}

// Export for testing
export { runETL, checkLicenses, DEFAULT_CONFIG };

// Run if called directly
if (require.main === module) {
  main();
}
