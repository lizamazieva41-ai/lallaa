#!/usr/bin/env node
/**
 * Report Filter Options
 * Purpose: Generate report of unique countries and banks/issuers available for filtering
 * Usage: npx ts-node scripts/etl/report-filter-options.ts [--output report.json]
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
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

interface FilterOptionsReport {
  generatedAt: string;
  summary: {
    totalBins: number;
    uniqueCountries: number;
    uniqueBanks: number;
    countriesWithBins: number;
    banksWithBins: number;
  };
  countries: Array<{
    countryCode: string;
    countryName: string | null;
    binCount: number;
    bankCount: number;
  }>;
  banks: Array<{
    issuer: string;
    countryCode: string | null;
    binCount: number;
  }>;
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
  console.log('[Filter Options] Loading merged records from ETL sources...\n');

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
      console.warn(`[Filter Options] Warning: Source file not found: ${config.path}`);
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
      console.log(`[Filter Options] Extracted ${extracted.records.length} records from ${config.name}`);
    } catch (error) {
      console.error(`[Filter Options] Failed to extract from ${config.name}:`, (error as Error).message);
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

  console.log(`[Filter Options] Loaded ${validated.valid.length} merged BIN records\n`);
  return validated.valid;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputFile = args.find(a => a.startsWith('--output'))?.split('=')[1] || './reports/filter-options.json';

  console.log('='.repeat(60));
  console.log('Filter Options Report');
  console.log('='.repeat(60));
  console.log(`Output: ${outputFile}\n`);

  // Load merged records
  const allRecords = await loadMergedRecords();

  // Aggregate by country
  const countryMap = new Map<string, { countryName: string | null; bins: Set<string>; banks: Set<string> }>();
  const bankMap = new Map<string, { countryCode: string | null; bins: Set<string> }>();

  for (const record of allRecords) {
    const countryCode = record.countryCode || 'XX';
    const countryName = record.country || null;
    const issuer = record.issuer || 'Unknown';

    // Country aggregation
    if (!countryMap.has(countryCode)) {
      countryMap.set(countryCode, { countryName, bins: new Set(), banks: new Set() });
    }
    const countryData = countryMap.get(countryCode)!;
    countryData.bins.add(record.bin);
    if (issuer !== 'Unknown' && issuer) {
      countryData.banks.add(issuer);
    }

    // Bank aggregation
    if (issuer !== 'Unknown' && issuer) {
      const bankKey = `${issuer}|${countryCode}`;
      if (!bankMap.has(bankKey)) {
        bankMap.set(bankKey, { countryCode: countryCode !== 'XX' ? countryCode : null, bins: new Set() });
      }
      bankMap.get(bankKey)!.bins.add(record.bin);
    }
  }

  // Build report
  const countries = Array.from(countryMap.entries())
    .map(([code, data]) => ({
      countryCode: code,
      countryName: data.countryName,
      binCount: data.bins.size,
      bankCount: data.banks.size,
    }))
    .sort((a, b) => b.binCount - a.binCount);

  const banks = Array.from(bankMap.entries())
    .map(([key, data]) => {
      const [issuer] = key.split('|');
      return {
        issuer,
        countryCode: data.countryCode,
        binCount: data.bins.size,
      };
    })
    .sort((a, b) => b.binCount - a.binCount);

  const report: FilterOptionsReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalBins: allRecords.length,
      uniqueCountries: countryMap.size,
      uniqueBanks: bankMap.size,
      countriesWithBins: countries.filter(c => c.binCount > 0).length,
      banksWithBins: banks.filter(b => b.binCount > 0).length,
    },
    countries,
    banks,
  };

  // Save report
  const reportDir = path.dirname(outputFile);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf-8');

  // Print summary
  console.log('='.repeat(60));
  console.log('Filter Options Report Completed');
  console.log('='.repeat(60));
  console.log(`Total BINs: ${report.summary.totalBins.toLocaleString()}`);
  console.log(`Unique Countries: ${report.summary.uniqueCountries}`);
  console.log(`Unique Banks/Issuers: ${report.summary.uniqueBanks.toLocaleString()}`);
  console.log(`Countries with BINs: ${report.summary.countriesWithBins}`);
  console.log(`Banks with BINs: ${report.summary.banksWithBins.toLocaleString()}\n`);

  console.log('Top 10 Countries by BIN count:');
  countries.slice(0, 10).forEach((c, idx) => {
    console.log(`  ${idx + 1}. ${c.countryCode} (${c.countryName || 'N/A'}): ${c.binCount.toLocaleString()} BINs, ${c.bankCount} banks`);
  });

  console.log('\nTop 10 Banks by BIN count:');
  banks.slice(0, 10).forEach((b, idx) => {
    console.log(`  ${idx + 1}. ${b.issuer} (${b.countryCode || 'N/A'}): ${b.binCount.toLocaleString()} BINs`);
  });

  console.log(`\nReport saved to: ${outputFile}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as generateFilterOptionsReport };
