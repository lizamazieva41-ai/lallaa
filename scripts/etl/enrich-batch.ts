#!/usr/bin/env node
/**
 * Batch Enrichment Script
 * Purpose: Run enrichment on BINs missing fields, prioritized by completeness score
 * Usage: npx ts-node scripts/etl/enrich-batch.ts [--limit 50] [--delay-ms 1500] [--output report.json]
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { enrichWithBinlist, EnrichBinlistOptions } from './enrich-binlist';
import { MergedRecord } from './merge';
import {
  extractFromJSON,
  extractFromCSV,
  extractFromYAML,
  extractFromDirectory,
  ExtractionResult,
  SOURCE_PRIORITY,
  SourceInfo,
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
} from './merge';

dotenv.config({ path: '.env' });

interface BatchEnrichmentReport {
  timestamp: string;
  totalBins: number;
  binsNeedingEnrichment: number;
  binsEnriched: number;
  binsAttempted: number;
  cacheHits: number;
  errors: number;
  completenessBefore: {
    issuer: number;
    url: number;
    phone: number;
    city: number;
    country: number;
    scheme: number;
    brand: number;
  };
  completenessAfter: {
    issuer: number;
    url: number;
    phone: number;
    city: number;
    country: number;
    scheme: number;
    brand: number;
  };
  topEnriched: Array<{
    bin: string;
    fieldsAdded: string[];
  }>;
}

function calculateMissingFieldsScore(record: MergedRecord): number {
  let score = 0;
  if (!record.issuer) score += 3; // High priority
  if (!record.url) score += 2;
  if (!record.phone) score += 2;
  if (!record.city) score += 1;
  if (!record.country) score += 2;
  if (!record.scheme) score += 2;
  if (!record.brand) score += 2;
  if (!record.countryCode) score += 1;
  return score;
}

function shouldEnrich(record: MergedRecord): boolean {
  return (
    !record.issuer ||
    !record.url ||
    !record.phone ||
    !record.city ||
    !record.country ||
    !record.scheme ||
    !record.brand
  );
}

function calculateCompleteness(records: MergedRecord[]): BatchEnrichmentReport['completenessBefore'] {
  const total = records.length;
  if (total === 0) {
    return {
      issuer: 0,
      url: 0,
      phone: 0,
      city: 0,
      country: 0,
      scheme: 0,
      brand: 0,
    };
  }

  return {
    issuer: Math.round((records.filter(r => r.issuer).length / total) * 100),
    url: Math.round((records.filter(r => r.url).length / total) * 100),
    phone: Math.round((records.filter(r => r.phone).length / total) * 100),
    city: Math.round((records.filter(r => r.city).length / total) * 100),
    country: Math.round((records.filter(r => r.country).length / total) * 100),
    scheme: Math.round((records.filter(r => r.scheme).length / total) * 100),
    brand: Math.round((records.filter(r => r.brand).length / total) * 100),
  };
}

function getFieldsBefore(record: MergedRecord): Set<string> {
  const fields = new Set<string>();
  if (record.issuer) fields.add('issuer');
  if (record.url) fields.add('url');
  if (record.phone) fields.add('phone');
  if (record.city) fields.add('city');
  if (record.country) fields.add('country');
  if (record.scheme) fields.add('scheme');
  if (record.brand) fields.add('brand');
  return fields;
}

async function getSourceVersion(sourcePath: string): Promise<string> {
  const gitPath = path.join(sourcePath, '..', '.git');
  if (fs.existsSync(gitPath)) {
    try {
      const { execSync } = await import('child_process');
      return execSync('git rev-parse HEAD', { cwd: path.dirname(sourcePath), encoding: 'utf-8' }).trim();
    } catch {
      return 'latest';
    }
  }
  return 'latest';
}

async function loadMergedRecords(): Promise<MergedRecord[]> {
  console.log('[Batch] Loading merged records from ETL sources...\n');

  // Use the same source configs as main ETL
  const SOURCE_CONFIGS: Array<{
    name: string;
    path: string;
    format: 'csv' | 'yaml' | 'json' | 'directory';
  }> = [
    {
      name: 'binlist/data',
      path: './data/sources/binlist-data/ranges.csv',
      format: 'csv',
    },
    {
      name: 'venelinkochev/bin-list-data',
      path: './data/sources/bin-list-data/bin-list-data.csv',
      format: 'csv',
    },
    {
      name: 'aderyabin/bin_list',
      path: './data/sources/bin_list/bin_list.yml',
      format: 'yaml',
    },
  ];

  const extractionResults: ExtractionResult[] = [];

  for (const config of SOURCE_CONFIGS) {
    if (!fs.existsSync(config.path)) {
      console.warn(`[Batch] Warning: Source file not found: ${config.path}`);
      continue;
    }

    try {
      const version = await getSourceVersion(config.path);
      let extracted: ExtractionResult;

      switch (config.format) {
        case 'csv':
          if (config.name === 'binlist/data') {
            extracted = await extractFromCSV(config.path, config.name, version, {
              bin: 'iin_start',
              scheme: 'scheme',
              type: 'type',
              issuer: 'bank_name',
              country: 'country',
              countryCode: 'country',
            });
          } else if (config.name === 'venelinkochev/bin-list-data') {
            extracted = await extractFromCSV(config.path, config.name, version, {
              bin: 'BIN',
              scheme: 'Brand',
              type: 'Type',
              issuer: 'Issuer',
              country: 'CountryName',
              countryCode: 'isoCode2',
            });
          } else {
            extracted = await extractFromCSV(config.path, config.name, version);
          }
          break;
        case 'yaml':
          extracted = await extractFromYAML(config.path, config.name, version);
          break;
        case 'json':
          extracted = await extractFromJSON(config.path, config.name, version);
          break;
        case 'directory':
          extracted = await extractFromDirectory(config.path, config.name, version);
          break;
        default:
          throw new Error(`Unsupported format: ${(config as { format: string }).format}`);
      }

      extractionResults.push(extracted);
      console.log(`[Batch] Extracted ${extracted.records.length} records from ${config.name}`);
    } catch (error) {
      console.error(`[Batch] Failed to extract from ${config.name}:`, (error as Error).message);
    }
  }

  // Normalize
  const allNormalized: Array<{ info: SourceInfo; records: NormalizedRecord[] }> = [];

  for (const result of extractionResults) {
    const priority = SOURCE_PRIORITY[result.source.name] || SOURCE_PRIORITY['others'];
    const normalized = normalizeBatch(result.records, priority);
    const validation = validateNormalized(normalized.records);

    if (validation.valid.length > 0) {
      allNormalized.push({
        info: {
          ...result.source,
          priority,
        },
        records: validation.valid,
      });
    }
  }

  // Merge
  const allRecords = allNormalized.flatMap(n => n.records);
  const dedupResult = deduplicate(allRecords);
  const mergeResult = mergeRecords(
    allNormalized.map(n => ({
      info: n.info,
      records: n.records,
    }))
  );
  const validated = validateMerged(mergeResult.merged);

  console.log(`[Batch] Loaded ${validated.valid.length} merged BIN records\n`);
  return validated.valid;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit'))?.split('=')[1] || '50', 10);
  const delayMs = parseInt(args.find(a => a.startsWith('--delay-ms'))?.split('=')[1] || '1500', 10);
  const outputFile = args.find(a => a.startsWith('--output'))?.split('=')[1] || './reports/enrichment-batch.json';

  console.log('='.repeat(60));
  console.log('Batch Enrichment Script');
  console.log('='.repeat(60));
  console.log(`Limit: ${limit} BINs`);
  console.log(`Delay: ${delayMs}ms between requests`);
  console.log(`Output: ${outputFile}\n`);

  // Load merged records
  const allRecords = await loadMergedRecords();

  // Filter and prioritize
  const needingEnrichment = allRecords.filter(shouldEnrich);
  const prioritized = [...needingEnrichment].sort((a, b) => {
    return calculateMissingFieldsScore(b) - calculateMissingFieldsScore(a);
  });

  console.log(`[Batch] Found ${needingEnrichment.length} BINs needing enrichment`);
  console.log(`[Batch] Processing top ${Math.min(limit, prioritized.length)} by priority\n`);

  // Calculate completeness before
  const completenessBefore = calculateCompleteness(allRecords);

  // Track fields before enrichment
  const fieldsBeforeMap = new Map<string, Set<string>>();
  prioritized.slice(0, limit).forEach(record => {
    fieldsBeforeMap.set(record.bin, getFieldsBefore(record));
  });

  // Run enrichment
  const enrichOpts: EnrichBinlistOptions = {
    enrichLimit: limit,
    delayMs,
    cacheFilePath: './data/cache/binlist.net.json',
    onlyIfMissing: true,
    timeoutMs: 5000,
  };

  const enrichResult = await enrichWithBinlist(prioritized.slice(0, limit), enrichOpts);

  // Calculate completeness after
  const completenessAfter = calculateCompleteness(allRecords);

  // Find top enriched (fields added)
  const topEnriched: BatchEnrichmentReport['topEnriched'] = [];
  prioritized.slice(0, limit).forEach(record => {
    const before = fieldsBeforeMap.get(record.bin);
    const after = getFieldsBefore(record);
    if (before) {
      const added = Array.from(after).filter(f => !before.has(f));
      if (added.length > 0) {
        topEnriched.push({ bin: record.bin, fieldsAdded: added });
      }
    }
  });
  topEnriched.sort((a, b) => b.fieldsAdded.length - a.fieldsAdded.length);

  // Generate report
  const report: BatchEnrichmentReport = {
    timestamp: new Date().toISOString(),
    totalBins: allRecords.length,
    binsNeedingEnrichment: needingEnrichment.length,
    binsEnriched: enrichResult.enriched,
    binsAttempted: enrichResult.attempted,
    cacheHits: enrichResult.cacheHits,
    errors: enrichResult.errors,
    completenessBefore,
    completenessAfter,
    topEnriched: topEnriched.slice(0, 10),
  };

  // Save report
  const reportDir = path.dirname(outputFile);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf-8');

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Batch Enrichment Completed');
  console.log('='.repeat(60));
  console.log(`Total BINs: ${report.totalBins}`);
  console.log(`BINs needing enrichment: ${report.binsNeedingEnrichment}`);
  console.log(`Attempted: ${report.binsAttempted}`);
  console.log(`Enriched: ${report.binsEnriched}`);
  console.log(`Cache hits: ${report.cacheHits}`);
  console.log(`Errors: ${report.errors}\n`);

  console.log('Completeness:');
  console.log(`  Issuer:   ${report.completenessBefore.issuer}% → ${report.completenessAfter.issuer}%`);
  console.log(`  URL:      ${report.completenessBefore.url}% → ${report.completenessAfter.url}%`);
  console.log(`  Phone:    ${report.completenessBefore.phone}% → ${report.completenessAfter.phone}%`);
  console.log(`  City:     ${report.completenessBefore.city}% → ${report.completenessAfter.city}%`);
  console.log(`  Country:  ${report.completenessBefore.country}% → ${report.completenessAfter.country}%`);
  console.log(`  Scheme:   ${report.completenessBefore.scheme}% → ${report.completenessAfter.scheme}%`);
  console.log(`  Brand:    ${report.completenessBefore.brand}% → ${report.completenessAfter.brand}%\n`);

  if (report.topEnriched.length > 0) {
    console.log('Top enriched BINs:');
    report.topEnriched.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.bin}: +${item.fieldsAdded.length} fields (${item.fieldsAdded.join(', ')})`);
    });
  }

  console.log(`\nReport saved to: ${outputFile}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runBatchEnrichment };
