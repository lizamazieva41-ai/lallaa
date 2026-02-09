#!/usr/bin/env node
/**
 * Country/Bank BIN Coverage Report
 * Purpose: Build a report of countries and issuers (banks) that exist in merged BIN data.
 * Usage:
 *   npx ts-node scripts/etl/report-countries-banks.ts --output=./reports/country-bank-bin-coverage.json
 *   npx ts-node scripts/etl/report-countries-banks.ts --top-countries=50 --top-banks=50
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import {
  extractFromJSON,
  extractFromCSV,
  extractFromYAML,
  extractFromDirectory,
  ExtractionResult,
  SOURCE_PRIORITY,
  SourceInfo,
} from './extract';
import { normalizeBatch, validateNormalized, NormalizedRecord } from './normalize';
import { mergeRecords, deduplicate, validateMerged, MergedRecord } from './merge';

dotenv.config({ path: '.env' });

type SourceConfig = {
  name: string;
  path: string;
  format: 'csv' | 'yaml' | 'json' | 'directory';
};

type CountryBankCoverageReport = {
  generatedAt: string;
  totalBins: number;
  totalCountries: number;
  totalIssuers: number;
  topCountries: Array<{
    countryCode: string;
    country: string;
    bins: number;
    issuers: number;
    topIssuers: Array<{ issuer: string; bins: number }>;
  }>;
  countries: Record<
    string,
    {
      country: string;
      bins: number;
      issuers: Record<string, { bins: number }>;
    }
  >;
};

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
  const SOURCE_CONFIGS: SourceConfig[] = [
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
    if (!fs.existsSync(config.path)) continue;
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
        continue;
    }

    extractionResults.push(extracted);
  }

  const allNormalized: Array<{ info: SourceInfo; records: NormalizedRecord[] }> = [];
  for (const result of extractionResults) {
    const priority = SOURCE_PRIORITY[result.source.name] || SOURCE_PRIORITY['others'];
    const normalized = normalizeBatch(result.records, priority);
    const validation = validateNormalized(normalized.records);
    if (validation.valid.length > 0) {
      allNormalized.push({
        info: { ...result.source, priority },
        records: validation.valid,
      });
    }
  }

  const allRecords = allNormalized.flatMap(n => n.records);
  const dedupResult = deduplicate(allRecords);
  const mergeResult = mergeRecords(allNormalized.map(n => ({ info: n.info, records: n.records })));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _dedup = dedupResult; // keep for potential future debugging

  return validateMerged(mergeResult.merged).valid;
}

function toIssuerKey(issuer: string | null): string {
  const val = (issuer || '').trim();
  return val.length > 0 ? val : 'Unknown';
}

function toCountryCode(code: string | null): string {
  const val = (code || '').trim().toUpperCase();
  return val.length > 0 ? val : 'XX';
}

function toCountryName(name: string | null): string {
  const val = (name || '').trim();
  return val.length > 0 ? val : 'Unknown';
}

function buildReport(
  records: MergedRecord[],
  topCountries: number,
  topBanks: number
): CountryBankCoverageReport {
  const countries: CountryBankCoverageReport['countries'] = {};

  for (const r of records) {
    const cc = toCountryCode(r.countryCode);
    const cn = toCountryName(r.country);
    const issuer = toIssuerKey(r.issuer);

    if (!countries[cc]) {
      countries[cc] = { country: cn, bins: 0, issuers: {} };
    }
    // Prefer a non-unknown name if we encounter it later
    if (countries[cc].country === 'Unknown' && cn !== 'Unknown') {
      countries[cc].country = cn;
    }

    countries[cc].bins++;
    countries[cc].issuers[issuer] = countries[cc].issuers[issuer] || { bins: 0 };
    countries[cc].issuers[issuer].bins++;
  }

  const topCountriesArr = Object.entries(countries)
    .map(([countryCode, info]) => {
      const issuerEntries = Object.entries(info.issuers)
        .map(([issuer, v]) => ({ issuer, bins: v.bins }))
        .sort((a, b) => b.bins - a.bins)
        .slice(0, topBanks);

      return {
        countryCode,
        country: info.country,
        bins: info.bins,
        issuers: Object.keys(info.issuers).length,
        topIssuers: issuerEntries,
      };
    })
    .sort((a, b) => b.bins - a.bins)
    .slice(0, topCountries);

  const totalIssuers = new Set(
    Object.values(countries).flatMap(c => Object.keys(c.issuers))
  ).size;

  return {
    generatedAt: new Date().toISOString(),
    totalBins: records.length,
    totalCountries: Object.keys(countries).length,
    totalIssuers,
    topCountries: topCountriesArr,
    countries,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const output =
    args.find(a => a.startsWith('--output='))?.split('=')[1] ||
    './reports/country-bank-bin-coverage.json';
  const topCountries = parseInt(args.find(a => a.startsWith('--top-countries='))?.split('=')[1] || '50', 10);
  const topBanks = parseInt(args.find(a => a.startsWith('--top-banks='))?.split('=')[1] || '50', 10);

  const records = await loadMergedRecords();
  const report = buildReport(records, topCountries, topBanks);

  const outDir = path.dirname(output);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf-8');

  // Console summary (high signal)
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Total BINs: ${report.totalBins}`);
  console.log(`Countries: ${report.totalCountries}`);
  console.log(`Issuers: ${report.totalIssuers}`);
  console.log(`Report: ${output}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', (err as Error).message);
    process.exit(1);
  });
}

