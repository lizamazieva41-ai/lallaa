/**
 * ETL Load Module
 * Purpose: Load merged records into database with upsert logic
 * + Data versioning: compute a content hash per ETL run and stamp it into bins.source_version
 *   so we can rollback a specific run by version.
 */

import { Pool, QueryResult } from 'pg';
import crypto from 'crypto';
import { MergedRecord } from './merge';
import fs from 'fs';
import path from 'path';

export interface LoadResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
  etlRunId?: string;
}

export interface LoadOptions {
  batchSize?: number;
  skipValidation?: boolean;
  dryRun?: boolean;
}

/**
 * Compute a deterministic hash for this ETL run based on merged records.
 * This serves as our data version identifier.
 */
function computeVersionHash(records: MergedRecord[]): string {
  const hash = crypto.createHash('sha256');
  const sorted = [...records].sort((a, b) => a.bin.localeCompare(b.bin));

  for (const r of sorted) {
    hash.update(r.bin);
    hash.update('|');
    hash.update(r.source);
    hash.update('|');
    hash.update(r.sourceVersion);
    hash.update('|');
    hash.update(String(r.confidence));
  }

  return hash.digest('hex');
}

/**
 * Load merged records into the database
 */
export async function loadRecords(
  pool: Pool,
  records: MergedRecord[],
  options: LoadOptions = {}
): Promise<LoadResult> {
  const result: LoadResult = {
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  const batchSize = options.batchSize || 100;
  const dryRun = options.dryRun || false;

  if (records.length === 0) {
    return result;
  }

  // Compute version hash for this ETL run (data version identifier)
  const versionHash = computeVersionHash(records);

  // Create ETL run record
  let etlRunId: string | null = null;
  if (!dryRun) {
    // We treat this as a composite/multi-source ETL run; versionHash identifies the data snapshot.
    etlRunId = await createETLRun(pool, 'multi-source-etl', versionHash, 'running');
  }

  try {
    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          if (options.skipValidation || validateRecord(record)) {
            if (dryRun) {
              // Just validate in dry run mode
              result.inserted++;
            } else {
              const status = await upsertRecord(pool, record, versionHash);
              if (status === 'inserted') result.inserted++;
              else result.updated++;
            }
          } else {
            result.failed++;
            result.errors.push(`Invalid record: ${record.bin}`);
          }
        } catch (err) {
          result.failed++;
          result.errors.push(`Failed to load ${record.bin}: ${(err as Error).message}`);
        }
      }

      // Log progress
      console.log(`Processed ${Math.min(i + batchSize, records.length)}/${records.length} records`);
    }

    // Update ETL run status
    if (!dryRun && etlRunId) {
      await updateETLRun(pool, etlRunId, 'completed', result);
      result.etlRunId = etlRunId;
    }
  } catch (err) {
    if (!dryRun && etlRunId) {
      await updateETLRun(pool, etlRunId, 'failed', result, (err as Error).message);
    }
    result.errors.push(`Batch error: ${(err as Error).message}`);
  }

  return result;
}

/**
 * Upsert a single record using INSERT ON CONFLICT
 */
async function upsertRecord(
  pool: Pool,
  record: MergedRecord,
  versionHash: string
): Promise<'inserted' | 'updated'> {
  const confidenceScore = normalizeConfidenceScore(record.confidence);
  const query = `
    INSERT INTO bins (
      bin, length, luhn, scheme, brand, issuer,
      country, country_code, bank_name, bank_code, branch_code,
      url, phone, city, program_type, regulatory_type,
      source, source_version, import_date, last_updated, raw, is_active,
      bank_name_local, card_type, card_network, country_name,
      bin_range_start, bin_range_end, confidence_score
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $19, TRUE, $20, $21, $22, $23, $24, $25, $26
    )
    ON CONFLICT (bin) DO UPDATE SET
      length = COALESCE(EXCLUDED.length, bins.length),
      luhn = COALESCE(EXCLUDED.luhn, bins.luhn),
      scheme = COALESCE(EXCLUDED.scheme, bins.scheme),
      brand = COALESCE(EXCLUDED.brand, bins.brand),
      issuer = COALESCE(EXCLUDED.issuer, bins.issuer),
      country = COALESCE(EXCLUDED.country, bins.country),
      country_code = COALESCE(EXCLUDED.country_code, bins.country_code),
      bank_name = COALESCE(EXCLUDED.bank_name, bins.bank_name),
      bank_name_local = COALESCE(EXCLUDED.bank_name_local, bins.bank_name_local),
      bank_code = COALESCE(EXCLUDED.bank_code, bins.bank_code),
      branch_code = COALESCE(EXCLUDED.branch_code, bins.branch_code),
      url = COALESCE(EXCLUDED.url, bins.url),
      phone = COALESCE(EXCLUDED.phone, bins.phone),
      city = COALESCE(EXCLUDED.city, bins.city),
      program_type = COALESCE(EXCLUDED.program_type, bins.program_type),
      regulatory_type = COALESCE(EXCLUDED.regulatory_type, bins.regulatory_type),
      card_type = COALESCE(EXCLUDED.card_type, bins.card_type),
      card_network = COALESCE(EXCLUDED.card_network, bins.card_network),
      country_name = COALESCE(EXCLUDED.country_name, bins.country_name),
      bin_range_start = COALESCE(EXCLUDED.bin_range_start, bins.bin_range_start),
      bin_range_end = COALESCE(EXCLUDED.bin_range_end, bins.bin_range_end),
      confidence_score = COALESCE(EXCLUDED.confidence_score, bins.confidence_score),
      source = EXCLUDED.source,
      source_version = EXCLUDED.source_version,
      last_updated = CURRENT_TIMESTAMP,
      raw = EXCLUDED.raw,
      updated_at = CURRENT_TIMESTAMP,
      is_active = TRUE
    RETURNING (xmax = 0) AS inserted;
  `;

  const values = [
    record.bin,
    record.length,
    record.luhn,
    record.scheme,
    record.brand,
    record.issuer,
    record.country,
    record.countryCode,
    record.issuer, // Use issuer as bank_name for ETL records
    record.bankCode,
    record.branchCode,
    record.url,
    record.phone,
    record.city,
    record.programType,
    record.regulatoryType,
    record.source,
    // Stamp ETL version hash into source_version so we can rollback by version.
    versionHash,
    JSON.stringify(record.raw),
    null, // bank_name_local
    record.type, // Use type as card_type
    record.scheme, // Use scheme as card_network
    record.country,
    null, // bin_range_start
    null, // bin_range_end
    confidenceScore,
  ];

  const result: QueryResult<{ inserted: boolean }> = await pool.query(query, values);

  return result.rows[0]?.inserted ? 'inserted' : 'updated';
}

function normalizeConfidenceScore(confidence: number): number {
  const bounded = Math.max(0, Math.min(confidence, 100));
  return Number((bounded / 100).toFixed(2));
}

/**
 * Validate a record before loading
 */
function validateRecord(record: MergedRecord): boolean {
  // Required fields
  if (!record.bin || !/^\d{6,8}$/.test(record.bin)) {
    return false;
  }

  if (!record.countryCode || !/^[A-Z]{2}$/.test(record.countryCode)) {
    return false;
  }

  // Optional but validated fields
  if (record.length !== null && (record.length < 13 || record.length > 19)) {
    return false;
  }

  return true;
}

/**
 * Create ETL run record
 */
async function createETLRun(
  pool: Pool,
  source: string,
  version: string,
  status: string
): Promise<string> {
  const query = `
    INSERT INTO etl_runs (source, source_version, status, started_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    RETURNING id
  `;

  const result = await pool.query(query, [source, version, status]);
  return result.rows[0].id;
}

/**
 * Update ETL run record
 */
async function updateETLRun(
  pool: Pool,
  runId: string,
  status: string,
  result: LoadResult,
  errorMessage?: string
): Promise<void> {
  const query = `
    UPDATE etl_runs SET
      status = $1,
      records_processed = $2,
      records_inserted = $3,
      records_updated = $4,
      records_failed = $5,
      error_message = $6,
      completed_at = CURRENT_TIMESTAMP
    WHERE id = $7
  `;

  await pool.query(query, [
    status,
    result.inserted + result.updated + result.failed,
    result.inserted,
    result.updated,
    result.failed,
    errorMessage || null,
    runId,
  ]);
}

/**
 * Rebuild indexes after load
 */
export async function rebuildIndexes(pool: Pool): Promise<void> {
  const indexes = [
    'idx_bins_country',
    'idx_bins_type',
    'idx_bins_scheme',
    'idx_bins_brand',
    'idx_bins_source',
    'idx_bins_import_date',
    'idx_bins_active',
  ];

  for (const index of indexes) {
    try {
      await pool.query(`REINDEX INDEX ${index}`);
      console.log(`Reindexed: ${index}`);
    } catch (err) {
      console.warn(`Failed to reindex ${index}: ${(err as Error).message}`);
    }
  }
}

/**
 * Get last ETL run info
 */
export async function getLastETLRun(pool: Pool): Promise<{
  id: string;
  source: string;
  status: string;
  recordsProcessed: number;
  completedAt: Date | null;
} | null> {
  const query = `
    SELECT id, source, status, records_processed, completed_at
    FROM etl_runs
    ORDER BY started_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    recordsProcessed: row.records_processed,
    completedAt: row.completed_at,
  };
}

/**
 * Export data to JSON file for backup
 */
export async function exportToJSON(
  pool: Pool,
  outputPath: string,
  options: { activeOnly?: boolean; source?: string } = {}
): Promise<number> {
  let query = 'SELECT * FROM bins';
  const conditions: string[] = [];

  if (options.activeOnly) {
    conditions.push('is_active = TRUE');
  }

  if (options.source) {
    conditions.push(`source = '${options.source.replace(/'/g, "''")}'`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  const result = await pool.query(query);
  const records = result.rows;

  // Format for export
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalRecords: records.length,
    source: options.source || 'all',
    records: records.map(r => ({
      ...r,
      raw: r.raw ? JSON.parse(r.raw) : null,
    })),
  };

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  return records.length;
}

export default {
  loadRecords,
  rebuildIndexes,
  getLastETLRun,
  exportToJSON,
};
