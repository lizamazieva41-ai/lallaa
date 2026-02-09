#!/usr/bin/env node
/**
 * Golden Set Validation Script
 * Purpose: Validate golden set against multiple sources and calculate agreement rates
 */

import dotenv from 'dotenv';
import { goldenSetManager } from '../../src/testing/goldenSet/goldenSetManager';
import { VerificationProtocol } from '../../src/testing/goldenSet/verificationProtocol';
import { logger } from '../../src/utils/logger';
import { binModel } from '../../src/models/bin';

dotenv.config({ path: '.env' });

/**
 * Validate golden set against current database
 */
async function validateGoldenSet(): Promise<void> {
  logger.info('Starting golden set validation...');

  // Load golden set
  const args = process.argv.slice(2);
  const inputFile = args.find(a => a.startsWith('--input='))?.split('=')[1] || 'golden-set.json';
  
  await goldenSetManager.loadFromFile(inputFile);
  const records = goldenSetManager.getAllRecords();

  logger.info(`Loaded ${records.length} golden set records`);

  let validCount = 0;
  let invalidCount = 0;
  let totalAgreementRate = 0;
  const fieldAgreementRates: Record<string, number[]> = {
    country: [],
    network: [],
    issuer: [],
    type: [],
  };

  // Validate each record
  for (const record of records) {
    const validation = goldenSetManager.validateRecord(record);

    if (validation.isValid) {
      validCount++;
    } else {
      invalidCount++;
      logger.warn(`Invalid golden set record: ${record.bin}`, {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Calculate agreement rates
    validation.sourceAgreements.forEach(agreement => {
      const fieldName = agreement.field as string;
      if (fieldAgreementRates[fieldName]) {
        fieldAgreementRates[fieldName].push(agreement.agreementRate);
        totalAgreementRate += agreement.agreementRate;
      }
    });
  }

  // Calculate average agreement rates
  const avgFieldAgreementRates: Record<string, number> = {};
  Object.entries(fieldAgreementRates).forEach(([field, rates]) => {
    avgFieldAgreementRates[field] =
      rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0;
  });

  const overallAgreementRate =
    records.length > 0 ? totalAgreementRate / (records.length * 4) : 0; // 4 fields per record

  // Print validation results
  logger.info('Golden set validation completed', {
    totalRecords: records.length,
    validRecords: validCount,
    invalidRecords: invalidCount,
    overallAgreementRate: overallAgreementRate.toFixed(3),
    fieldAgreementRates: avgFieldAgreementRates,
  });

  // Check if agreement rate meets threshold
  const MIN_AGREEMENT_RATE = 0.95;
  if (overallAgreementRate < MIN_AGREEMENT_RATE) {
    logger.warn(
      `Overall agreement rate ${overallAgreementRate.toFixed(3)} is below threshold ${MIN_AGREEMENT_RATE}`
    );
  } else {
    logger.info(`Overall agreement rate meets threshold: ${overallAgreementRate.toFixed(3)}`);
  }

  // Print statistics
  const stats = goldenSetManager.getStatistics();
  logger.info('Golden set statistics', {
    byVerificationMethod: stats.byVerificationMethod,
    bySourceCount: stats.bySourceCount,
    averageConfidence: stats.averageConfidence.toFixed(3),
  });
}

/**
 * Compare golden set with current database records
 */
async function compareWithDatabase(): Promise<void> {
  logger.info('Comparing golden set with database records...');

  const records = goldenSetManager.getAllRecords();
  let matchCount = 0;
  let mismatchCount = 0;
  const mismatches: Array<{ bin: string; field: string; expected: any; actual: any }> = [];

  for (const record of records) {
    try {
      const dbRecord = await binModel.findByBIN(record.bin);

      if (!dbRecord) {
        logger.debug(`BIN ${record.bin} not found in database`);
        continue;
      }

      // Compare fields
      if (dbRecord.countryCode !== record.verifiedFields.country.value) {
        mismatches.push({
          bin: record.bin,
          field: 'country',
          expected: record.verifiedFields.country.value,
          actual: dbRecord.countryCode,
        });
        mismatchCount++;
      } else {
        matchCount++;
      }

      if (dbRecord.cardNetwork !== record.verifiedFields.network.value) {
        mismatches.push({
          bin: record.bin,
          field: 'network',
          expected: record.verifiedFields.network.value,
          actual: dbRecord.cardNetwork,
        });
        mismatchCount++;
      } else {
        matchCount++;
      }

      if (dbRecord.bankName !== record.verifiedFields.issuer.value) {
        // Use similarity check for issuer names
        const similarity = calculateSimilarity(
          dbRecord.bankName.toLowerCase(),
          record.verifiedFields.issuer.value.toLowerCase()
        );
        if (similarity < 0.8) {
          mismatches.push({
            bin: record.bin,
            field: 'issuer',
            expected: record.verifiedFields.issuer.value,
            actual: dbRecord.bankName,
          });
          mismatchCount++;
        } else {
          matchCount++;
        }
      } else {
        matchCount++;
      }

      if (dbRecord.cardType !== record.verifiedFields.type.value) {
        mismatches.push({
          bin: record.bin,
          field: 'type',
          expected: record.verifiedFields.type.value,
          actual: dbRecord.cardType,
        });
        mismatchCount++;
      } else {
        matchCount++;
      }
    } catch (error) {
      logger.error(`Error comparing BIN ${record.bin} with database`, { error });
    }
  }

  logger.info('Database comparison completed', {
    totalComparisons: records.length * 4,
    matches: matchCount,
    mismatches: mismatchCount,
    matchRate: ((matchCount / (matchCount + mismatchCount)) * 100).toFixed(2) + '%',
  });

  if (mismatches.length > 0) {
    logger.warn('Found mismatches', {
      count: mismatches.length,
      sample: mismatches.slice(0, 10),
    });
  }
}

/**
 * Calculate string similarity (simple Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    await validateGoldenSet();
    await compareWithDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Golden set validation failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in golden set validation', { error });
    process.exit(1);
  });
}

export { validateGoldenSet, compareWithDatabase };
