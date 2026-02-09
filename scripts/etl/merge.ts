/**
 * ETL Merge Module
 * Purpose: Merge normalized records from multiple sources with conflict resolution
 * Priority: binlist/data > venelinkochev > aderyabin > others
 */

import { NormalizedRecord } from './normalize';
import { SourceInfo } from './extract';
import { AdvancedConflictResolver, SourceData } from '../../src/services/conflictResolution/conflictResolver';
import { AuditTrail } from '../../src/services/conflictResolution/auditTrail';
import { manualReviewQueue } from '../../src/services/conflictResolution/manualReviewQueue';
import { logger } from '../../src/utils/logger';

export interface MergedRecord {
  bin: string;
  length: number | null;
  luhn: boolean | null;
  scheme: string | null;
  brand: string | null;
  type: string | null;
  issuer: string | null;
  country: string | null;
  countryCode: string | null;
  bankCode: string | null;
  branchCode: string | null;
  url: string | null;
  phone: string | null;
  city: string | null;
  programType: string | null;
  regulatoryType: string | null;
  source: string;
  sourceVersion: string;
  importDate: Date;
  lastUpdated: Date;
  raw: Record<string, unknown>;
  confidence: number;
  sources: Array<{
    source: string;
    sourceVersion: string;
    confidence: number;
    fields: Record<string, string | null>;
  }>;
}

export interface MergeResult {
  merged: MergedRecord[];
  conflicts: Array<{
    bin: string;
    field: string;
    values: Array<{ source: string; value: string | null }>;
    resolvedTo: string | null;
  }>;
  duplicates: string[];
  errors: string[];
}

// Priority order - lower number = higher priority
const SOURCE_PRIORITY: Record<string, number> = {
  'binlist/data': 1,
  'venelinkochev/bin-list-data': 2,
  'aderyabin/bin_list': 3,
  'braintree/credit-card-type': 4,
  'others': 5,
};

function getPriority(source: string): number {
  return SOURCE_PRIORITY[source] || SOURCE_PRIORITY.others;
}

/**
 * Merge multiple normalized record sets using advanced conflict resolution
 */
export async function mergeRecords(
  sources: Array<{ info: SourceInfo; records: NormalizedRecord[] }>
): Promise<MergeResult> {
  const result: MergeResult = {
    merged: [],
    conflicts: [],
    duplicates: [],
    errors: [],
  };

  // Group all records by BIN
  const binMap = new Map<string, Array<{ record: NormalizedRecord; source: SourceInfo }>>();

  for (const { info, records } of sources) {
    for (const record of records) {
      const existing = binMap.get(record.bin) || [];
      existing.push({ record, source: info });
      binMap.set(record.bin, existing);
    }
  }

  // Process each BIN
  for (const [bin, records] of binMap) {
    try {
      // Sort by priority (lower number = higher priority)
      records.sort((a, b) => {
        const priorityA = a.source.priority ?? getPriority(a.source.name);
        const priorityB = b.source.priority ?? getPriority(b.source.name);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return b.record.confidence - a.record.confidence;
      });

      if (records.length > 1) {
        result.duplicates.push(bin);
      }

      // Merge records using advanced conflict resolution
      const merged = await mergeRecordList(bin, records);
      result.merged.push(merged);
    } catch (err) {
      result.errors.push(`Error merging BIN ${bin}: ${(err as Error).message}`);
    }
  }

  return result;
}

/**
 * Merge multiple records for the same BIN using advanced conflict resolution
 */
async function mergeRecordList(
  bin: string,
  records: Array<{ record: NormalizedRecord; source: SourceInfo }>
): Promise<MergedRecord> {
  const primary = records[0]; // Highest priority
  const primaryRecord = primary.record;
  const primarySource = primary.source;
  const allSources: MergedRecord['sources'] = [];
  const conflictResolver = new AdvancedConflictResolver(new AuditTrail());

  // Collect all sources and their contributions
  for (const record of records) {
    allSources.push({
      source: record.source.name,
      sourceVersion: record.source.version,
      confidence: record.record.confidence,
      fields: {
        scheme: record.record.normalizedScheme,
        brand: record.record.normalizedBrand,
        type: record.record.normalizedType,
        issuer: record.record.normalizedIssuer,
        country: record.record.normalizedCountry,
        countryCode: record.record.normalizedCountryCode,
        bankCode: record.record.bankCode || null,
        branchCode: record.record.branchCode || null,
        url: record.record.url || null,
        phone: record.record.phone || null,
        city: record.record.city || null,
        programType: record.record.programType || null,
        regulatoryType: record.record.regulatoryType || null,
      },
    });
  }

  // Prepare source data for conflict resolution
  const prepareSourceData = (field: string): SourceData[] => {
    return records.map(r => ({
      source: r.source.name,
      value: getFieldValue(r.record, field),
      confidence: r.record.confidence,
      lastUpdated: new Date(), // In production, use actual lastUpdated from source
      recencyDays: 0, // In production, calculate from lastUpdated
    }));
  };

  // Resolve conflicts for each field using advanced conflict resolver
  const resolvedFields: Record<string, any> = {};

  const fieldsToResolve = [
    'countryCode',
    'country',
    'scheme',
    'brand',
    'type',
    'issuer',
    'bankCode',
    'branchCode',
    'url',
    'phone',
    'city',
    'programType',
    'regulatoryType',
  ];

  for (const field of fieldsToResolve) {
    const sourceData = prepareSourceData(field);
    
    // Only resolve if we have multiple sources with different values
    const uniqueValues = new Set(sourceData.map(s => s.value).filter(v => v !== null && v !== ''));
    if (uniqueValues.size > 1) {
      // Conflict detected - use advanced resolver
      try {
        const resolution = await conflictResolver.resolveConflict(bin, field, sourceData);
        resolvedFields[field] = resolution.resolution.resolvedValue;

        // Add to manual review queue if needed
        if (resolution.resolution.requiresManualReview) {
          manualReviewQueue.addToQueue(bin, field, resolution);
        }
      } catch (error) {
        logger.warn(`Conflict resolution failed for ${bin}:${field}`, { error });
        // Fallback to priority-based selection
        resolvedFields[field] = getFieldValue(primaryRecord, field);
      }
    } else {
      // No conflict - use first available value
      resolvedFields[field] = getFieldValue(primaryRecord, field);
    }
  }

  // Merge fields using resolved values
  const merged: MergedRecord = {
    bin,
    length: primaryRecord.length || null,
    luhn: primaryRecord.luhn ?? null,
    scheme: resolvedFields.scheme || null,
    brand: resolvedFields.brand || null,
    type: resolvedFields.type || null,
    issuer: resolvedFields.issuer || null,
    country: resolvedFields.country || null,
    countryCode: resolvedFields.countryCode || null,
    bankCode: resolvedFields.bankCode || null,
    branchCode: resolvedFields.branchCode || null,
    url: resolvedFields.url || null,
    phone: resolvedFields.phone || null,
    city: resolvedFields.city || null,
    programType: resolvedFields.programType || null,
    regulatoryType: resolvedFields.regulatoryType || null,
    source: primarySource.name,
    sourceVersion: primarySource.version,
    importDate: new Date(),
    lastUpdated: new Date(),
    raw: mergeRawData(records),
    confidence: Math.max(...records.map(r => r.record.confidence)),
    sources: allSources,
  };

  return merged;
}

/**
 * Get field value from normalized record
 */
function getFieldValue(record: NormalizedRecord, field: string): any {
  switch (field) {
    case 'countryCode':
      return record.normalizedCountryCode;
    case 'country':
      return record.normalizedCountry;
    case 'scheme':
      return record.normalizedScheme;
    case 'brand':
      return record.normalizedBrand;
    case 'type':
      return record.normalizedType;
    case 'issuer':
      return record.normalizedIssuer;
    case 'bankCode':
      return record.bankCode;
    case 'branchCode':
      return record.branchCode;
    case 'url':
      return record.url;
    case 'phone':
      return record.phone;
    case 'city':
      return record.city;
    case 'programType':
      return record.programType;
    case 'regulatoryType':
      return record.regulatoryType;
    default:
      return null;
  }
}

/**
 * Select best value from array using priority
 */
function selectBestValue<T>(values: (T | null)[]): T | null {
  const nonNull = values.filter((v): v is T => v !== null);
  if (nonNull.length === 0) return null;
  return nonNull[0]; // Already sorted by priority
}

/**
 * Merge raw data from multiple sources
 */
function mergeRawData(
  records: Array<{ record: NormalizedRecord; source: SourceInfo }>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    _sources: records.map(r => r.source.name),
  };

  // Keep raw data from all sources
  for (let i = 0; i < records.length; i++) {
    merged[`_source_${i}`] = records[i].record.raw;
  }

  return merged;
}

/**
 * Deduplicate records before merging
 */
export function deduplicate(
  records: NormalizedRecord[]
): { unique: NormalizedRecord[]; duplicates: number } {
  const seen = new Map<string, NormalizedRecord>();
  let duplicates = 0;

  for (const record of records) {
    const key = `${record.bin}_${record.normalizedCountryCode || 'XX'}`;

    if (seen.has(key)) {
      duplicates++;
      // Keep the one with higher confidence
      const existing = seen.get(key)!;
      if (record.confidence > existing.confidence) {
        seen.set(key, record);
      }
    } else {
      seen.set(key, record);
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicates,
  };
}

/**
 * Validate merged records
 */
export function validateMerged(records: MergedRecord[]): {
  valid: MergedRecord[];
  invalid: Array<{ record: MergedRecord; reason: string }>;
} {
  const valid: MergedRecord[] = [];
  const invalid: Array<{ record: MergedRecord; reason: string }> = [];

  for (const record of records) {
    const reasons: string[] = [];

    if (!record.bin || !/^\d{6,8}$/.test(record.bin)) {
      reasons.push('Invalid BIN format');
    }

    if (!record.countryCode) {
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

/**
 * Get statistics about the merge
 */
export function getMergeStats(result: MergeResult): {
  totalRecords: number;
  uniqueBINs: number;
  duplicatesMerged: number;
  conflictsResolved: number;
  sourcesBreakdown: Record<string, number>;
} {
  const sourcesBreakdown: Record<string, number> = {};

  for (const record of result.merged) {
    sourcesBreakdown[record.source] = (sourcesBreakdown[record.source] || 0) + 1;
  }

  return {
    totalRecords: result.merged.length + result.duplicates.length,
    uniqueBINs: result.merged.length,
    duplicatesMerged: result.duplicates.length,
    conflictsResolved: result.conflicts.length,
    sourcesBreakdown,
  };
}

export default {
  mergeRecords,
  deduplicate,
  validateMerged,
  getMergeStats,
};
