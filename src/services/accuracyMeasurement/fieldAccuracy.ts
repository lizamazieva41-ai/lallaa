import { AccuracyFramework, FieldAccuracyMetrics, AccuracyMetrics } from './accuracyFramework';
import { GoldenSetRecord } from '../../testing/goldenSet/goldenSetTypes';
import { BINLookupResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Field Accuracy Calculator - Field-specific accuracy calculation with mismatch tracking
 */
export class FieldAccuracyCalculator {
  /**
   * Calculate accuracy for country field
   */
  public static calculateCountryAccuracy(
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics['country'] {
    return AccuracyFramework.calculateFieldAccuracy('country', goldenSetRecords, lookupResults);
  }

  /**
   * Calculate accuracy for network field
   */
  public static calculateNetworkAccuracy(
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics['network'] {
    return AccuracyFramework.calculateFieldAccuracy('network', goldenSetRecords, lookupResults);
  }

  /**
   * Calculate accuracy for issuer field with normalized similarity
   */
  public static calculateIssuerAccuracy(
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics['issuer'] {
    return AccuracyFramework.calculateFieldAccuracy('issuer', goldenSetRecords, lookupResults);
  }

  /**
   * Calculate accuracy for type field
   */
  public static calculateTypeAccuracy(
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics['type'] {
    return AccuracyFramework.calculateFieldAccuracy('type', goldenSetRecords, lookupResults);
  }

  /**
   * Calculate all field accuracies
   */
  public static calculateAllFieldAccuracies(
    goldenSetRecords: GoldenSetRecord[],
    lookupResults: Map<string, BINLookupResult | null>
  ): FieldAccuracyMetrics {
    logger.info('Calculating all field accuracies...');

    return {
      country: this.calculateCountryAccuracy(goldenSetRecords, lookupResults),
      network: this.calculateNetworkAccuracy(goldenSetRecords, lookupResults),
      issuer: this.calculateIssuerAccuracy(goldenSetRecords, lookupResults),
      type: this.calculateTypeAccuracy(goldenSetRecords, lookupResults),
    };
  }

  /**
   * Analyze mismatch patterns
   */
  public static analyzeMismatchPatterns(metrics: AccuracyMetrics): {
    patterns: Array<{
      field: keyof FieldAccuracyMetrics;
      pattern: string;
      frequency: number;
      examples: string[];
    }>;
    recommendations: string[];
  } {
    const patterns: Array<{
      field: keyof FieldAccuracyMetrics;
      pattern: string;
      frequency: number;
      examples: string[];
    }> = [];

    const recommendations: string[] = [];

    Object.entries(metrics.fields).forEach(([fieldName, fieldMetrics]) => {
      const field = fieldName as keyof FieldAccuracyMetrics;

      // Group mismatches by pattern
      const patternMap = new Map<string, { frequency: number; examples: string[] }>();

      fieldMetrics.mismatches.forEach((mismatch: (typeof fieldMetrics.mismatches)[number]) => {
        const pattern = `${mismatch.expected} → ${mismatch.actual}`;
        if (!patternMap.has(pattern)) {
          patternMap.set(pattern, { frequency: 0, examples: [] });
        }
        const patternData = patternMap.get(pattern)!;
        patternData.frequency += mismatch.frequency;
        if (patternData.examples.length < 5 && mismatch.bins) {
          patternData.examples.push(...mismatch.bins.slice(0, 5 - patternData.examples.length));
        }
      });

      // Convert to array and sort by frequency
      Array.from(patternMap.entries())
        .sort((a, b) => b[1].frequency - a[1].frequency)
        .slice(0, 10) // Top 10 patterns
        .forEach(([pattern, data]) => {
          patterns.push({
            field,
            pattern,
            frequency: data.frequency,
            examples: data.examples,
          });
        });

      // Generate recommendations
      if (fieldMetrics.accuracy < 95) {
        if (field === 'issuer' && 'normalizedSimilarity' in fieldMetrics) {
          recommendations.push(
            `Improve issuer name normalization (similarity: ${(fieldMetrics.normalizedSimilarity * 100).toFixed(2)}%)`
          );
        } else {
          recommendations.push(
            `Review ${fieldMetrics.mismatches.length} mismatch patterns for ${field} field`
          );
        }
      }
    });

    return { patterns, recommendations };
  }
}
