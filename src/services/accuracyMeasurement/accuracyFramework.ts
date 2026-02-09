import { GoldenSetRecord } from '../../testing/goldenSet/goldenSetTypes';
import { BINLookupResult, CardNetwork, CardType } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Accuracy measurement result for a single field
 */
export interface FieldAccuracyResult {
  total: number;
  correct: number;
  accuracy: number;
  mismatches: Array<{
    expected: string | CardNetwork | CardType;
    actual: string | CardNetwork | CardType;
    frequency: number;
    bins?: string[];
  }>;
}

/**
 * Field-specific accuracy metrics
 */
export interface FieldAccuracyMetrics {
  country: FieldAccuracyResult;
  network: FieldAccuracyResult;
  issuer: FieldAccuracyResult & {
    normalizedSimilarity: number; // Average similarity for mismatches
  };
  type: FieldAccuracyResult;
}

/**
 * Overall accuracy metrics
 */
export interface AccuracyMetrics {
  fields: FieldAccuracyMetrics;
  overall: {
    totalComparisons: number;
    correctComparisons: number;
    accuracy: number;
  };
  timestamp: Date;
}

/**
 * Accuracy Framework - Core framework for field-specific accuracy calculation
 */
export class AccuracyFramework {
  // Overloads so TypeScript knows issuer always includes normalizedSimilarity.
  public static calculateFieldAccuracy(
    fieldName: 'issuer',
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics['issuer'];
  public static calculateFieldAccuracy(
    fieldName: Exclude<keyof FieldAccuracyMetrics, 'issuer'>,
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyResult;
  /**
   * Calculate accuracy for a single field
   */
  public static calculateFieldAccuracy(
    fieldName: keyof FieldAccuracyMetrics,
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics[keyof FieldAccuracyMetrics] {
    const mismatches = new Map<string, { expected: any; actual: any; bins: string[] }>();
    let total = 0;
    let correct = 0;
    let totalSimilarity = 0;
    let similarityCount = 0;

    goldenSetRecords.forEach(record => {
      const lookupResult = lookupResults.get(record.bin) || null;

      // We always count this record towards total comparisons for the field
      // (unless the golden set itself is missing an expected value for that field).
      total++;

      let expected: any;
      let actual: any;
      let isMatch = false;

      switch (fieldName) {
        case 'country':
          expected = record.verifiedFields.country.value;
          if (!lookupResult) {
            actual = 'LOOKUP_FAILED';
            isMatch = false;
          } else {
            actual = lookupResult.country.code;
            isMatch = expected === actual;
          }
          break;

        case 'network':
          expected = record.verifiedFields.network.value;
          if (!lookupResult) {
            actual = 'LOOKUP_FAILED';
            isMatch = false;
          } else {
            actual = lookupResult.card.network;
            isMatch = expected === actual;
          }
          break;

        case 'issuer':
          // Golden set may not include issuer for all records.
          if (!record.verifiedFields.issuer) {
            total--;
            return;
          }
          expected = record.verifiedFields.issuer.value;
          if (!lookupResult) {
            actual = 'LOOKUP_FAILED';
            isMatch = false;
          } else {
            actual = lookupResult.bank.name;
            isMatch = expected === actual;
          }

          // Calculate similarity for issuer (even if not exact match)
          if (!isMatch && expected && actual && actual !== 'LOOKUP_FAILED') {
            const similarity = this.calculateStringSimilarity(
              expected.toLowerCase(),
              actual.toLowerCase()
            );
            totalSimilarity += similarity;
            similarityCount++;
          }
          break;

        case 'type':
          // Golden set may not include type for all records.
          if (!record.verifiedFields.type) {
            total--;
            return;
          }
          expected = record.verifiedFields.type.value;
          if (!lookupResult) {
            actual = 'LOOKUP_FAILED';
            isMatch = false;
          } else {
            actual = lookupResult.card.type;
            isMatch = expected === actual;
          }
          break;
      }

      if (isMatch) {
        correct++;
      } else {
        // Track mismatch
        const mismatchKey = `${expected}|${actual}`;
        if (!mismatches.has(mismatchKey)) {
          mismatches.set(mismatchKey, {
            expected,
            actual,
            bins: [],
          });
        }
        mismatches.get(mismatchKey)!.bins.push(record.bin);
      }
    });

    // Convert mismatches to array
    const mismatchArray = Array.from(mismatches.values()).map(m => ({
      expected: m.expected,
      actual: m.actual,
      frequency: m.bins.length,
      bins: m.bins.length <= 10 ? m.bins : m.bins.slice(0, 10), // Limit bin list
    }));

    const baseResult: FieldAccuracyResult = {
      total,
      correct,
      accuracy: total > 0 ? (correct / total) * 100 : 0,
      mismatches: mismatchArray,
    };

    // Add normalized similarity for issuer field
    if (fieldName === 'issuer') {
      return {
        ...baseResult,
        normalizedSimilarity: similarityCount > 0 ? totalSimilarity / similarityCount : 0,
      } as FieldAccuracyMetrics['issuer'];
    }

    return baseResult;
  }

  /**
   * Calculate overall accuracy metrics
   */
  public static calculateAccuracyMetrics(
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): AccuracyMetrics {
    logger.info('Calculating accuracy metrics...', { recordCount: goldenSetRecords.length });

    const country = this.calculateFieldAccuracy('country', goldenSetRecords, lookupResults);
    const network = this.calculateFieldAccuracy('network', goldenSetRecords, lookupResults);
    const issuer = this.calculateFieldAccuracy('issuer', goldenSetRecords, lookupResults);
    const type = this.calculateFieldAccuracy('type', goldenSetRecords, lookupResults);

    // Calculate overall accuracy
    const totalComparisons = country.total + network.total + issuer.total + type.total;
    const correctComparisons = country.correct + network.correct + issuer.correct + type.correct;
    const overallAccuracy = totalComparisons > 0 ? (correctComparisons / totalComparisons) * 100 : 0;

    return {
      fields: {
        country,
        network,
        issuer,
        type,
      },
      overall: {
        totalComparisons,
        correctComparisons,
        accuracy: overallAccuracy,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
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
   * Identify accuracy gaps by field type
   */
  public static identifyAccuracyGaps(metrics: AccuracyMetrics): Array<{
    field: keyof FieldAccuracyMetrics;
    currentAccuracy: number;
    targetAccuracy: number;
    gap: number;
    recommendation: string;
  }> {
    const targets: Record<keyof FieldAccuracyMetrics, number> = {
      country: 99,
      network: 99,
      issuer: 95,
      type: 95,
    };

    const gaps: Array<{
      field: keyof FieldAccuracyMetrics;
      currentAccuracy: number;
      targetAccuracy: number;
      gap: number;
      recommendation: string;
    }> = [];

    Object.entries(metrics.fields).forEach(([fieldName, fieldMetrics]) => {
      const field = fieldName as keyof FieldAccuracyMetrics;
      const currentAccuracy = fieldMetrics.accuracy;
      const targetAccuracy = targets[field];
      const gap = targetAccuracy - currentAccuracy;

      if (gap > 0) {
        let recommendation = '';
        if (field === 'issuer' && 'normalizedSimilarity' in fieldMetrics) {
          recommendation = `Improve issuer name normalization (current similarity: ${(fieldMetrics.normalizedSimilarity * 100).toFixed(2)}%)`;
        } else if (fieldMetrics.mismatches.length > 0) {
          recommendation = `Review and fix ${fieldMetrics.mismatches.length} mismatch patterns`;
        } else {
          recommendation = `Investigate data quality issues for ${field} field`;
        }

        gaps.push({
          field,
          currentAccuracy,
          targetAccuracy,
          gap,
          recommendation,
        });
      }
    });

    return gaps;
  }
}
