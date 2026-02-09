import { GoldenSetRecord, VerifiedField, SourceAgreement } from './goldenSetTypes';
import { CardNetwork, CardType } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Source priority weights for conflict resolution
 * Higher weight = more trusted source
 */
export const SOURCE_WEIGHTS: Record<string, number> = {
  'binlist/data': 2.0,
  'venelinkochev/bin-list-data': 1.0,
  'aderyabin/bin_list': 1.0,
  'handyapi': 1.5,
  'authoritative': 3.0, // Bank websites, central bank data
  'manual': 2.5, // Manual verification by domain experts
};

/**
 * Minimum confidence threshold for cross-source verification
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Minimum source agreement rate for cross-source verification
 */
export const MIN_AGREEMENT_RATE = 0.95;

/**
 * Verification Protocol - Cross-source verification logic with source weighting
 */
export class VerificationProtocol {
  /**
   * Calculate field confidence based on source agreement and weights
   */
  public static calculateFieldConfidence(
    value: string | CardNetwork | CardType,
    sources: string[],
    allSourceValues: Array<{ source: string; value: string | CardNetwork | CardType }>
  ): number {
    if (sources.length === 0) return 0;
    if (sources.length === 1) return 0.5; // Single source = lower confidence

    // Count agreements (same value from different sources)
    const agreements = allSourceValues.filter(sv => sv.value === value);
    const agreementCount = agreements.length;
    const totalSources = allSourceValues.length;

    if (agreementCount === 0) return 0;

    // Base agreement rate
    const agreementRate = agreementCount / totalSources;

    // Weight by source quality
    let weightedConfidence = 0;
    let totalWeight = 0;

    agreements.forEach(agreement => {
      const weight = SOURCE_WEIGHTS[agreement.source] || 1.0;
      weightedConfidence += weight;
      totalWeight += weight;
    });

    // Normalize confidence
    const sourceWeightFactor = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    const confidence = agreementRate * 0.7 + sourceWeightFactor * 0.3;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Verify field across multiple sources
   */
  public static verifyField<T extends string | CardNetwork | CardType>(
    fieldName: string,
    allSourceValues: Array<{ source: string; value: T; confidence?: number }>
  ): VerifiedField<T> | null {
    if (allSourceValues.length === 0) {
      return null;
    }

    // Group by value
    const valueGroups = new Map<T, Array<{ source: string; confidence?: number }>>();
    
    allSourceValues.forEach(({ value, source, confidence }) => {
      if (!valueGroups.has(value)) {
        valueGroups.set(value, []);
      }
      valueGroups.get(value)!.push({ source, confidence });
    });

    // Find value with most agreements
    let bestValue: T | null = null;
    let bestSources: string[] = [];
    let maxAgreementCount = 0;

    valueGroups.forEach((sources, value) => {
      if (sources.length > maxAgreementCount) {
        maxAgreementCount = sources.length;
        bestValue = value;
        bestSources = sources.map(s => s.source);
      } else if (sources.length === maxAgreementCount) {
        // Tie-breaker: prefer higher weighted sources
        const currentWeight = bestSources.reduce((sum, s) => sum + (SOURCE_WEIGHTS[s] || 1.0), 0);
        const newWeight = sources.reduce((sum, s) => sum + (SOURCE_WEIGHTS[s.source] || 1.0), 0);
        
        if (newWeight > currentWeight) {
          bestValue = value;
          bestSources = sources.map(s => s.source);
        }
      }
    });

    if (!bestValue || bestSources.length === 0) {
      return null;
    }

    // Calculate confidence
    const confidence = this.calculateFieldConfidence(
      bestValue,
      bestSources,
      allSourceValues.map(sv => ({ source: sv.source, value: sv.value }))
    );

    return {
      value: bestValue,
      sources: bestSources,
      confidence,
    };
  }

  /**
   * Determine verification method based on sources and agreement
   */
  public static determineVerificationMethod(
    verifiedFields: GoldenSetRecord['verifiedFields'],
    hasAuthoritativeSource: boolean = false,
    hasManualVerification: boolean = false
  ): GoldenSetRecord['verificationMethod'] {
    if (hasAuthoritativeSource) {
      return 'authoritative';
    }

    if (hasManualVerification) {
      return 'manual';
    }

    // Check if we have cross-source verification (≥2 sources for all fields)
    const allFieldsHaveMultipleSources = Object.values(verifiedFields).every(
      field => field.sources.length >= 2
    );

    if (allFieldsHaveMultipleSources) {
      return 'cross-source';
    }

    // Default to cross-source even if not all fields have multiple sources
    return 'cross-source';
  }

  /**
   * Calculate source agreement rate for a field
   */
  public static calculateSourceAgreement(
    fieldName: keyof GoldenSetRecord['verifiedFields'],
    verifiedField: VerifiedField,
    allSourceValues: Array<{ source: string; value: any }>
  ): SourceAgreement {
    const agreements = allSourceValues.filter(sv => sv.value === verifiedField.value);
    const agreementRate = allSourceValues.length > 0 
      ? agreements.length / allSourceValues.length 
      : 0;

    const conflictingSources = allSourceValues
      .filter(sv => sv.value !== verifiedField.value)
      .map(sv => sv.source);

    return {
      field: fieldName,
      sources: verifiedField.sources,
      agreementRate,
      conflictingSources: conflictingSources.length > 0 ? conflictingSources : undefined,
    };
  }

  /**
   * Validate cross-source verification requirements
   */
  public static validateCrossSourceVerification(
    verifiedFields: GoldenSetRecord['verifiedFields']
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    Object.entries(verifiedFields).forEach(([fieldName, field]) => {
      if (field.sources.length < 2) {
        errors.push(`Cross-source verification requires ≥2 sources for field: ${fieldName}`);
      }

      if (field.confidence < MIN_CONFIDENCE_THRESHOLD) {
        warnings.push(
          `Low confidence for field ${fieldName}: ${field.confidence} (threshold: ${MIN_CONFIDENCE_THRESHOLD})`
        );
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get source weight
   */
  public static getSourceWeight(source: string): number {
    return SOURCE_WEIGHTS[source] || 1.0;
  }

  /**
   * Check if source is authoritative
   */
  public static isAuthoritativeSource(source: string): boolean {
    return source.includes('authoritative') || 
           source.includes('bank') || 
           source.includes('central-bank') ||
           SOURCE_WEIGHTS[source] >= 2.5;
  }
}
