import fs from 'fs';
import path from 'path';
import { GoldenSetRecord, GoldenSetStatistics, GoldenSetValidationResult, SourceAgreement } from './goldenSetTypes';
import { logger } from '../../utils/logger';

/**
 * Golden Set Manager - Core management functions for golden set records
 */
export class GoldenSetManager {
  private goldenSetPath: string;
  private records: Map<string, GoldenSetRecord>;

  constructor(goldenSetPath: string = './data/golden-set') {
    this.goldenSetPath = goldenSetPath;
    this.records = new Map();
    this.ensureDirectoryExists();
  }

  /**
   * Ensure the golden set directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.goldenSetPath)) {
      fs.mkdirSync(this.goldenSetPath, { recursive: true });
      logger.info('Created golden set directory', { path: this.goldenSetPath });
    }
  }

  /**
   * Add or update a golden set record
   */
  public addRecord(record: GoldenSetRecord): void {
    this.records.set(record.bin, record);
    logger.debug('Added golden set record', { bin: record.bin });
  }

  /**
   * Get a golden set record by BIN
   */
  public getRecord(bin: string): GoldenSetRecord | undefined {
    return this.records.get(bin);
  }

  /**
   * Check if a BIN exists in golden set
   */
  public hasRecord(bin: string): boolean {
    return this.records.has(bin);
  }

  /**
   * Get all golden set records
   */
  public getAllRecords(): GoldenSetRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Get records by verification method
   */
  public getRecordsByMethod(method: GoldenSetRecord['verificationMethod']): GoldenSetRecord[] {
    return this.getAllRecords().filter(record => record.verificationMethod === method);
  }

  /**
   * Get records with minimum source count
   */
  public getRecordsWithMinSources(minSources: number): GoldenSetRecord[] {
    return this.getAllRecords().filter(record => {
      const allSources = new Set<string>();
      Object.values(record.verifiedFields).forEach(field => {
        if (!field) return;
        field.sources.forEach((source: string) => allSources.add(source));
      });
      return allSources.size >= minSources;
    });
  }

  /**
   * Calculate golden set statistics
   */
  public getStatistics(): GoldenSetStatistics {
    const records = this.getAllRecords();
    const byMethod: Record<GoldenSetRecord['verificationMethod'], number> = {
      'cross-source': 0,
      'manual': 0,
      'authoritative': 0,
    };

    const bySourceCount: Record<number, number> = {};
    let totalConfidence = 0;
    const sourceAgreementRates: Record<keyof GoldenSetRecord['verifiedFields'], number[]> = {
      country: [],
      network: [],
      issuer: [],
      type: [],
    };

    records.forEach(record => {
      // Count by verification method
      byMethod[record.verificationMethod]++;

      // Count by source count
      const allSources = new Set<string>();
      Object.entries(record.verifiedFields).forEach(([fieldName, field]) => {
        if (!field) return;
        const key = fieldName as keyof GoldenSetRecord['verifiedFields'];
        field.sources.forEach((source: string) => allSources.add(source));
        totalConfidence += field.confidence;
        sourceAgreementRates[key].push(field.confidence);
      });

      const sourceCount = allSources.size;
      bySourceCount[sourceCount] = (bySourceCount[sourceCount] || 0) + 1;
    });

    // Calculate average agreement rates per field
    const avgAgreementRates: Record<keyof GoldenSetRecord['verifiedFields'], number> = {
      country: this.calculateAverage(sourceAgreementRates.country),
      network: this.calculateAverage(sourceAgreementRates.network),
      issuer: this.calculateAverage(sourceAgreementRates.issuer),
      type: this.calculateAverage(sourceAgreementRates.type),
    };

    return {
      totalRecords: records.length,
      byVerificationMethod: byMethod,
      bySourceCount,
      // average confidence over present fields (country+network always present; issuer/type may be absent)
      averageConfidence:
        records.length > 0
          ? totalConfidence /
            Math.max(
              1,
              records.reduce((sum, r) => sum + Object.values(r.verifiedFields).filter(Boolean).length, 0)
            )
          : 0,
      sourceAgreementRates: avgAgreementRates,
    };
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Save golden set to file
   */
  public async saveToFile(filename: string = 'golden-set.json'): Promise<void> {
    const filePath = path.join(this.goldenSetPath, filename);
    const data = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      records: this.getAllRecords(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('Saved golden set to file', { filePath, recordCount: this.records.size });
  }

  /**
   * Load golden set from file
   */
  public async loadFromFile(filename: string = 'golden-set.json'): Promise<void> {
    const filePath = path.join(this.goldenSetPath, filename);
    
    if (!fs.existsSync(filePath)) {
      logger.warn('Golden set file not found', { filePath });
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.records && Array.isArray(data.records)) {
        this.records.clear();
        data.records.forEach((record: GoldenSetRecord) => {
          // Convert date strings back to Date objects
          record.lastVerified = new Date(record.lastVerified);
          this.records.set(record.bin, record);
        });
        logger.info('Loaded golden set from file', { filePath, recordCount: this.records.size });
      }
    } catch (error) {
      logger.error('Failed to load golden set from file', { filePath, error });
      throw error;
    }
  }

  /**
   * Validate a golden set record
   */
  public validateRecord(record: GoldenSetRecord): GoldenSetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sourceAgreements: SourceAgreement[] = [];

    // Validate BIN format
    if (!/^\d{6,8}$/.test(record.bin)) {
      errors.push(`Invalid BIN format: ${record.bin}`);
    }

    // Validate verified fields
    Object.entries(record.verifiedFields).forEach(([fieldName, field]) => {
      const fieldKey = fieldName as keyof typeof record.verifiedFields;
      if (!field) {
        warnings.push(`Missing optional field: ${fieldKey}`);
        return;
      }
      
      // Check if value exists
      if (!field.value) {
        errors.push(`Missing value for field: ${fieldKey}`);
      }

      // Check if sources exist
      if (!field.sources || field.sources.length === 0) {
        errors.push(`No sources for field: ${fieldKey}`);
      } else if (field.sources.length < 2 && record.verificationMethod === 'cross-source') {
        warnings.push(`Cross-source verification requires ≥2 sources for field: ${fieldKey}`);
      }

      // Check confidence score
      if (field.confidence < 0 || field.confidence > 1) {
        errors.push(`Invalid confidence score for field: ${fieldKey}: ${field.confidence}`);
      }

      // Calculate source agreement
      if (field.sources.length >= 2) {
        const agreementRate = field.confidence;
        sourceAgreements.push({
          field: fieldKey,
          sources: field.sources,
          agreementRate,
        });
      }
    });

    // Validate verification method
    if (!['cross-source', 'manual', 'authoritative'].includes(record.verificationMethod)) {
      errors.push(`Invalid verification method: ${record.verificationMethod}`);
    }

    // Validate dates
    if (!(record.lastVerified instanceof Date) || isNaN(record.lastVerified.getTime())) {
      errors.push('Invalid lastVerified date');
    }

    return {
      record,
      isValid: errors.length === 0,
      errors,
      warnings,
      sourceAgreements,
    };
  }

  /**
   * Get count of records
   */
  public getRecordCount(): number {
    return this.records.size;
  }

  /**
   * Clear all records
   */
  public clear(): void {
    this.records.clear();
    logger.info('Cleared all golden set records');
  }
}

export const goldenSetManager = new GoldenSetManager();
