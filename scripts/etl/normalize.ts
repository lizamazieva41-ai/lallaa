/**
 * ETL Normalize Module
 * Purpose: Normalize extracted data - trim strings, standardize country codes, normalize issuer names
 */

import { SourceRecord } from './extract';

// Import enhanced country mapping
import {
  normalizeCountryToISO2,
  getCountryByISO2,
  validateGeographicConsistency,
  isValidBINPrefixForCountry,
  isValidCardNetworkForCountry,
  initializeCountryMappings,
} from '../../src/data/countryMapping';
import { ISO3166Country } from '../countries/import-iso3166';
import fs from 'fs';
import path from 'path';

// Initialize country mappings on module load
let countryMappingsInitialized = false;

function ensureCountryMappingsInitialized(): void {
  if (countryMappingsInitialized) return;

  try {
    // Try to load ISO 3166-1 data
    const iso3166Path = path.join(__dirname, '../../data/countries/iso3166-1.json');
    if (fs.existsSync(iso3166Path)) {
      const iso3166Data = JSON.parse(fs.readFileSync(iso3166Path, 'utf-8'));
      initializeCountryMappings(iso3166Data as ISO3166Country[]);
      countryMappingsInitialized = true;
    } else {
      // Fallback to basic mapping if file doesn't exist yet
      console.warn('ISO 3166-1 data not found, using basic country mapping');
      countryMappingsInitialized = true; // Prevent repeated warnings
    }
  } catch (error) {
    console.warn('Failed to initialize country mappings:', error);
    countryMappingsInitialized = true; // Prevent repeated errors
  }
}

// Initialize on module load
ensureCountryMappingsInitialized();

export interface NormalizedRecord extends SourceRecord {
  normalizedCountryCode: string;
  normalizedCountry: string;
  normalizedIssuer: string;
  normalizedScheme: string;
  normalizedBrand: string;
  normalizedType: string;
  confidence: number;
}

export interface NormalizationResult {
  records: NormalizedRecord[];
  countryMappings: Record<string, string>;
  issuerMappings: Record<string, string>;
  errors: string[];
}

/**
 * Normalize a single record
 */
function normalizeRecord(record: SourceRecord, priority: number): NormalizedRecord {
  const normalized: NormalizedRecord = {
    ...record,
    normalizedCountryCode: '',
    normalizedCountry: '',
    normalizedIssuer: '',
    normalizedScheme: '',
    normalizedBrand: '',
    normalizedType: '',
    confidence: 0,
  };

  // Normalize country code
  if (record.countryCode) {
    const code = record.countryCode.toUpperCase().trim();
    if (/^[A-Z]{2}$/.test(code)) {
      normalized.normalizedCountryCode = code;
    }
  }

  // Normalize country name to code using enhanced country mapping
  if (!normalized.normalizedCountryCode && record.country) {
    ensureCountryMappingsInitialized();
    const iso2 = normalizeCountryToISO2(record.country);
    normalized.normalizedCountryCode = iso2 || '';
    normalized.normalizedCountry = record.country;
    
    // Validate geographic consistency if we have region/subregion info
    if (iso2) {
      const country = getCountryByISO2(iso2);
      if (country) {
        // Additional validation can be added here
        // For now, we just ensure the country code is valid
      }
    }
  }

  // Normalize country name if we have code but no name
  if (record.country && !normalized.normalizedCountry) {
    normalized.normalizedCountry = record.country;
  }

  // Normalize issuer name
  if (record.issuer) {
    normalized.normalizedIssuer = normalizeIssuer(record.issuer);
  }

  // Normalize scheme (card network)
  normalized.normalizedScheme = normalizeScheme(record.scheme);

  // Normalize brand
  normalized.normalizedBrand = normalizeBrand(record.brand, normalized.normalizedScheme);

  // Normalize type
  normalized.normalizedType = normalizeType(record.type);

  // Calculate confidence based on data completeness and priority
  normalized.confidence = calculateConfidence(record, normalized, priority);

  return normalized;
}

/**
 * Normalize country names using lookup table
 */
export function normalizeCountry(
  records: SourceRecord[]
): { mappings: Record<string, string>; normalizedRecords: NormalizedRecord[] } {
  const mappings: Record<string, string> = {};
  const normalizedRecords: NormalizedRecord[] = [];

  for (const record of records) {
    const normalized = normalizeRecord(record, 1);

    // Track mappings
    if (record.country && normalized.normalizedCountryCode) {
      mappings[record.country.toLowerCase().trim()] = normalized.normalizedCountryCode;
    }

    normalizedRecords.push(normalized);
  }

  return { mappings, normalizedRecords };
}

/**
 * Normalize issuer names - remove punctuation, standardize
 */
function normalizeIssuer(issuer: string): string {
  if (!issuer) return '';

  return issuer
    .trim()
    .toUpperCase()
    .replace(/[‐‑–—]/g, '-') // Normalize dashes
    .replace(/[''""]/g, "'") // Normalize quotes
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/[.,;:#*@!$%^&(){}[\]|\\<>~`]/g, '') // Remove special chars
    .replace(/\s+(LLC|INC|LTD|CORP|PLC|S?A?G)$/i, ' $1') // Clean company suffixes
    .trim();
}

/**
 * Normalize scheme/card network names
 */
function normalizeScheme(scheme: string | undefined): string {
  if (!scheme) return '';

  const normalized = scheme.toLowerCase().trim();

  const schemeMappings: Record<string, string> = {
    'visa': 'visa',
    'visa electron': 'visa',
    'visa-dankort': 'visa',
    'mastercard': 'mastercard',
    'master': 'mastercard',
    'mc': 'mastercard',
    'amex': 'amex',
    'american express': 'amex',
    'americanexpress': 'amex',
    'jcb': 'jcb',
    'unionpay': 'unionpay',
    'up': 'unionpay',
    'discover': 'discover',
    'diners': 'diners',
    'diners club': 'diners',
    'interac': 'interac',
    'elo': 'elo',
    'hipercard': 'hipercard',
    'carte bleue': 'carte-bleue',
  };

  return schemeMappings[normalized] || normalized;
}

/**
 * Normalize brand names
 */
function normalizeBrand(brand: string | undefined, scheme: string): string {
  if (!brand) return '';

  let normalized = brand
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Remove duplicate scheme name from brand
  if (scheme && normalized.toLowerCase().includes(scheme.toLowerCase())) {
    normalized = normalized.replace(new RegExp(`${scheme}`, 'gi'), '').trim();
  }

  // Clean up
  normalized = normalized
    .replace(/\s+/g, ' ')
    .replace(/^[-–—]\s*/, '')
    .replace(/\s*[-–—]$/, '')
    .trim();

  return normalized || scheme;
}

/**
 * Normalize card types
 */
function normalizeType(type: string | undefined): string {
  if (!type) return '';

  const normalized = type.toLowerCase().trim();

  const typeMappings: Record<string, string> = {
    'debit': 'debit',
    'credit': 'credit',
    'prepaid': 'prepaid',
    'pre-paid': 'prepaid',
    'corporate': 'corporate',
    'business': 'corporate',
    'commercial': 'corporate',
    'consumer': 'consumer',
    'non-reloadable': 'prepaid',
    'reloadable': 'prepaid',
  };

  return typeMappings[normalized] || normalized;
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(
  record: SourceRecord,
  normalized: NormalizedRecord,
  priority: number
): number {
  let score = 0;
  let maxScore = 0;

  // Base score from priority (higher priority = higher base score)
  maxScore += 30;
  if (priority === 1) score += 30; // binlist/data
  else if (priority === 2) score += 25;
  else if (priority === 3) score += 20;
  else score += 10;

  // Completeness
  maxScore += 50;

  if (normalized.bin) score += 5;
  if (normalized.scheme) score += 10;
  if (normalized.brand) score += 5;
  if (normalized.type) score += 5;
  if (normalized.normalizedCountryCode) score += 10;
  if (normalized.normalizedCountry) score += 5;
  if (normalized.normalizedIssuer) score += 10;

  return Math.round((score / maxScore) * 100);
}

/**
 * Process a batch of records
 */
export function normalizeBatch(
  records: SourceRecord[],
  defaultPriority: number = 5
): NormalizationResult {
  const result: NormalizationResult = {
    records: [],
    countryMappings: {},
    issuerMappings: {},
    errors: [],
  };

  for (const record of records) {
    try {
      const normalized = normalizeRecord(record, defaultPriority);
      result.records.push(normalized);

      // Track mappings
      if (record.country) {
        const key = record.country.toLowerCase().trim();
        if (!result.countryMappings[key]) {
          result.countryMappings[key] = normalized.normalizedCountryCode;
        }
      }

      if (record.issuer) {
        const key = record.issuer.toLowerCase().trim();
        if (!result.issuerMappings[key]) {
          result.issuerMappings[key] = normalized.normalizedIssuer;
        }
      }
    } catch (err) {
      result.errors.push(`Error normalizing record: ${(err as Error).message}`);
    }
  }

  return result;
}

/**
 * Validate normalized records
 */
export function validateNormalized(records: NormalizedRecord[]): {
  valid: NormalizedRecord[];
  invalid: { record: NormalizedRecord; reason: string }[];
} {
  const valid: NormalizedRecord[] = [];
  const invalid: { record: NormalizedRecord; reason: string }[] = [];

  for (const record of records) {
    const reasons: string[] = [];

    if (!record.bin || !/^\d{6,8}$/.test(record.bin)) {
      reasons.push('Invalid BIN format');
    }

    if (!record.normalizedCountryCode) {
      reasons.push('Missing country code');
    }

    if (reasons.length > 0) {
      invalid.push({ record, reason: reasons.join('; ') });
    } else {
      valid.push(record);
    }
  }

  return { valid, invalid };
}

export default {
  normalizeBatch,
  validateNormalized,
  normalizeCountry,
};
