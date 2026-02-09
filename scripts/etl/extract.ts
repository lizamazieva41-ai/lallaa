/**
 * ETL Extract Module
 * Purpose: Extract BIN data from various source formats (JSON, CSV, YAML)
 * Priority: binlist/data > venelinkochev > aderyabin > others
 */

import fs from 'fs';
import path from 'path';
import { parse as parseCSV } from 'csv-parse/sync';
import yaml from 'js-yaml';
import { extractFromHandyAPIFile } from './extract-handyapi';

export interface SourceRecord {
  bin: string;
  length?: number;
  luhn?: boolean;
  scheme?: string;
  brand?: string;
  type?: string;
  issuer?: string;
  country?: string;
  countryCode?: string;
  bankCode?: string;
  branchCode?: string;
  url?: string;
  phone?: string;
  city?: string;
  programType?: string;
  regulatoryType?: string;
  raw: Record<string, unknown>;
}

export interface SourceInfo {
  name: string;
  version: string;
  format: 'json' | 'csv' | 'yaml' | 'mixed';
  priority: number;
}

export interface ExtractionResult {
  source: SourceInfo;
  records: SourceRecord[];
  errors: string[];
}

// Priority order for sources
export const SOURCE_PRIORITY: Record<string, number> = {
  'binlist/data': 1,
  'venelinkochev/bin-list-data': 2,
  'aderyabin/bin_list': 3,
  'braintree/credit-card-type': 4,
  'handyapi/card-bin-list': 2,
  'others': 5,
};

/**
 * Extract data from HandyAPI cached JSON file.
 * If you need remote sync, do that in the ETL orchestrator and write a cache file,
 * then call this extractor.
 */
export async function extractFromHandyAPI(
  filePath: string,
  sourceName: string,
  version: string
): Promise<ExtractionResult> {
  const { records, errors } = extractFromHandyAPIFile(filePath);
  return {
    source: {
      name: sourceName,
      version,
      format: 'json',
      priority: SOURCE_PRIORITY[sourceName] || SOURCE_PRIORITY.others,
    },
    records,
    errors,
  };
}

/**
 * Extract data from JSON source (binlist format)
 */
export async function extractFromJSON(
  filePath: string,
  sourceName: string,
  version: string
): Promise<ExtractionResult> {
  const records: SourceRecord[] = [];
  const errors: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const [bin, record] of Object.entries(data)) {
      try {
        const normalizedBin = normalizeBIN(bin);
        if (!isValidBINFormat(normalizedBin)) {
          errors.push(`Invalid BIN format: ${bin}`);
          continue;
        }

        const rec = record as Record<string, unknown>;
        const country = rec.country as Record<string, unknown> | undefined;

        records.push({
          bin: normalizedBin,
          length: (rec.length as number) || detectLengthFromBin(normalizedBin),
          luhn: rec.luhn as boolean ?? true,
          scheme: rec.scheme as string,
          brand: rec.brand as string,
          type: rec.type as string,
          issuer: (rec.bank as Record<string, unknown>)?.name as string || rec.issuer as string,
          country: country?.name as string,
          countryCode: (country as Record<string, unknown>)?.alpha2 as string || rec.countryCode as string,
          bankCode: rec.bankCode as string || (rec.bank as Record<string, unknown>)?.code as string,
          branchCode: rec.branchCode as string,
          url: (rec.bank as Record<string, unknown>)?.url as string || rec.url as string,
          phone: (rec.bank as Record<string, unknown>)?.phone as string || rec.phone as string,
          city: (rec.bank as Record<string, unknown>)?.city as string || rec.city as string,
          raw: rec,
        });
      } catch (err) {
        errors.push(`Error processing BIN ${bin}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to read/parse JSON file: ${(err as Error).message}`);
  }

  return {
    source: {
      name: sourceName,
      version,
      format: 'json',
      priority: SOURCE_PRIORITY[sourceName] || SOURCE_PRIORITY.others,
    },
    records,
    errors,
  };
}

/**
 * Extract data from CSV source
 */
export async function extractFromCSV(
  filePath: string,
  sourceName: string,
  version: string,
  columnMapping: Record<string, string> = {
    bin: 'BIN',
    scheme: 'brand',
    type: 'type',
    issuer: 'issuer',
    country: 'country',
    countryCode: 'country_code',
  }
): Promise<ExtractionResult> {
  const records: SourceRecord[] = [];
  const errors: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Detect encoding and normalize
    const normalizedContent = normalizeEncoding(content);
    const recordsCSV = parseCSV(normalizedContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    for (const row of recordsCSV) {
      try {
        const rowAsAny = row as any;
        const binValue = rowAsAny[columnMapping.bin] || rowAsAny.BIN || rowAsAny.bin;
        if (!binValue) {
          continue;
        }

        const normalizedBin = normalizeBIN(binValue);
        if (!isValidBINFormat(normalizedBin)) {
          errors.push(`Invalid BIN format: ${binValue}`);
          continue;
        }

        records.push({
          bin: normalizedBin,
          length: parseInt(rowAsAny.length || rowAsAny.LENGTH || '16', 10) || detectLengthFromBin(normalizedBin),
          luhn: (rowAsAny.luhn && rowAsAny.luhn.toLowerCase() === 'true') ?? true,
          scheme: rowAsAny[columnMapping.scheme] || rowAsAny.brand || rowAsAny.BRAND || rowAsAny.scheme,
          type: rowAsAny[columnMapping.type] || rowAsAny.TYPE || rowAsAny.type,
          issuer: rowAsAny[columnMapping.issuer] || rowAsAny.issuer || rowAsAny.ISSUER || rowAsAny.Bank,
          country: rowAsAny[columnMapping.country] || rowAsAny.country || rowAsAny.COUNTRY,
          countryCode: rowAsAny[columnMapping.countryCode] || rowAsAny.countryCode || rowAsAny.COUNTRY_CODE,
          bankCode: rowAsAny.bankCode || rowAsAny.BANK_CODE || rowAsAny.BankCode,
          raw: rowAsAny,
        });
      } catch (err) {
        errors.push(`Error processing CSV row: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to read/parse CSV file: ${(err as Error).message}`);
  }

  return {
    source: {
      name: sourceName,
      version,
      format: 'csv',
      priority: SOURCE_PRIORITY[sourceName] || SOURCE_PRIORITY.others,
    },
    records,
    errors,
  };
}

/**
 * Extract data from YAML source
 */
export async function extractFromYAML(
  filePath: string,
  sourceName: string,
  version: string
): Promise<ExtractionResult> {
  const records: SourceRecord[] = [];
  const errors: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data: Record<string, unknown>;
    try {
      data = yaml.load(content) as Record<string, unknown>;
    } catch (err) {
      // Some community datasets (e.g. aderyabin/bin_list) can contain duplicate mapping keys.
      // js-yaml treats this as a hard error; recover a flat BIN map with "last key wins".
      errors.push(`YAML parse error, attempting loose recovery: ${(err as Error).message}`);
      data = parseLooseBinMapYAML(content);
    }

    // Handle different YAML structures
    let binsData: Record<string, unknown> = {};

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === 'object') {
          const itemRecord = item as Record<string, unknown>;
          if (itemRecord.bin) {
            binsData[itemRecord.bin as string] = item;
          }
        }
      }
    } else if (typeof data === 'object') {
      binsData = data as Record<string, unknown>;
    }

    for (const [bin, record] of Object.entries(binsData)) {
      try {
        const normalizedBin = normalizeBIN(bin);
        if (!isValidBINFormat(normalizedBin)) {
          errors.push(`Invalid BIN format: ${bin}`);
          continue;
        }

        const rec = record as Record<string, unknown>;

        records.push({
          bin: normalizedBin,
          length: rec.length as number || detectLengthFromBin(normalizedBin),
          luhn: rec.luhn as boolean ?? true,
          scheme: rec.scheme as string || rec.type as string,
          brand: rec.brand as string,
          type: rec.cardType as string || rec.type as string,
          issuer: (rec.issuer as Record<string, unknown>)?.name as string || rec.issuer as string,
          country: (rec.issuer as Record<string, unknown>)?.country as string || rec.country as string,
          countryCode: (rec.issuer as Record<string, unknown>)?.countryCode as string || rec.countryCode as string,
          raw: rec,
        });
      } catch (err) {
        errors.push(`Error processing YAML BIN ${bin}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to read/parse YAML file: ${(err as Error).message}`);
  }

  return {
    source: {
      name: sourceName,
      version,
      format: 'yaml',
      priority: SOURCE_PRIORITY[sourceName] || SOURCE_PRIORITY.others,
    },
    records,
    errors,
  };
}

/**
 * Recover a flat BIN->value map from a YAML-like text by extracting lines that look like:
 *   4241: "Some Issuer"
 *
 * This is intentionally conservative and does not aim to be a full YAML parser.
 * It is only used as a fallback when strict YAML parsing fails.
 */
function parseLooseBinMapYAML(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match "BIN: value"
    // Accept only 6-8 digit BIN/IIN to match the rest of the pipeline.
    const m = trimmed.match(/^(\d{6,8})\s*:\s*(.+)\s*$/);
    if (!m) continue;

    const bin = m[1];
    let value = m[2].trim();

    // Strip trailing inline comments like: value # comment
    const commentIdx = value.indexOf(' #');
    if (commentIdx !== -1) {
      value = value.slice(0, commentIdx).trim();
    }

    // Unquote simple strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Last key wins
    result[bin] = {
      issuer: value,
      // This dataset does not provide country; set to unknown so records can still flow
      // through normalization/merge and be enriched later by higher-fidelity sources.
      countryCode: 'XX',
      country: 'Unknown',
    };
  }

  return result;
}

/**
 * Extract from directory containing multiple source files
 */
export async function extractFromDirectory(
  dirPath: string,
  sourceName: string,
  version: string
): Promise<ExtractionResult> {
  const allRecords: SourceRecord[] = [];
  const allErrors: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return {
      source: { name: sourceName, version, format: 'json', priority: SOURCE_PRIORITY[sourceName] || SOURCE_PRIORITY.others },
      records: [],
      errors: [`Directory not found: ${dirPath}`],
    };
  }

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const ext = path.extname(file).toLowerCase();

    if (!fs.statSync(filePath).isFile()) continue;

    let result: ExtractionResult | null = null;

    try {
      switch (ext) {
        case '.json':
          result = await extractFromJSON(filePath, sourceName, version);
          break;
        case '.csv':
        case '.txt':
          result = await extractFromCSV(filePath, sourceName, version);
          break;
        case '.yaml':
        case '.yml':
          result = await extractFromYAML(filePath, sourceName, version);
          break;
        default:
          continue;
      }

      allRecords.push(...result.records);
      allErrors.push(...result.errors);
    } catch (err) {
      allErrors.push(`Error processing ${file}: ${(err as Error).message}`);
    }
  }

  return {
    source: { name: sourceName, version, format: 'json', priority: SOURCE_PRIORITY[sourceName] || SOURCE_PRIORITY.others },
    records: allRecords,
    errors: allErrors,
  };
}

// Helper functions

function normalizeBIN(bin: string): string {
  return bin.toString().replace(/[\s\-]/g, '').substring(0, 8).toUpperCase();
}

function isValidBINFormat(bin: string): boolean {
  return /^\d{6,8}$/.test(bin);
}

function detectLengthFromBin(bin: string): number {
  const prefix = bin.substring(0, 2);
  // Visa starts with 4 -> 13 or 16
  if (prefix === '4') return 13;
  // Mastercard 51-55 -> 16
  if (prefix >= '51' && prefix <= '55') return 16;
  // Default to 16
  return 16;
}

function normalizeEncoding(content: string): string {
  // Try to detect and fix common encoding issues
  // Replace Windows-1252 specific characters if present
  return content
    .replace(/\x92/g, "'")
    .replace(/\x93/g, '"')
    .replace(/\x94/g, '"')
    .replace(/\x96/g, '-')
    .replace(/\x97/g, '-');
}

export default {
  extractFromJSON,
  extractFromCSV,
  extractFromYAML,
  extractFromDirectory,
  SOURCE_PRIORITY,
};
