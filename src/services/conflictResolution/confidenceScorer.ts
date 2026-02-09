import { logger } from '../../utils/logger';

/**
 * Source quality weights for confidence scoring
 * Higher weight = more trusted source
 */
export const SOURCE_QUALITY_WEIGHTS: Record<string, number> = {
  'binlist/data': 2.0,
  'venelinkochev/bin-list-data': 1.0,
  'aderyabin/bin_list': 1.0,
  'handyapi': 1.5,
  'authoritative': 3.0, // Bank websites, central bank data
  'manual': 2.5, // Manual verification by domain experts
};

/**
 * Field-specific source reliability
 */
export const FIELD_SOURCE_RELIABILITY: Record<string, Record<string, number>> = {
  country: {
    'binlist/data': 0.98,
    'venelinkochev/bin-list-data': 0.95,
    'aderyabin/bin_list': 0.92,
    'handyapi': 0.94,
  },
  network: {
    'binlist/data': 0.99,
    'venelinkochev/bin-list-data': 0.97,
    'aderyabin/bin_list': 0.95,
    'handyapi': 0.96,
  },
  issuer: {
    'binlist/data': 0.90,
    'venelinkochev/bin-list-data': 0.85,
    'aderyabin/bin_list': 0.80,
    'handyapi': 0.88,
  },
  type: {
    'binlist/data': 0.95,
    'venelinkochev/bin-list-data': 0.90,
    'aderyabin/bin_list': 0.88,
    'handyapi': 0.92,
  },
};

/**
 * Confidence Scorer - Calculate field-specific confidence scores based on source quality and recency
 */
export class ConfidenceScorer {
  /**
   * Calculate confidence score for a field value from a source
   */
  public static calculateFieldConfidence(
    field: string,
    source: string,
    recencyDays: number = 0,
    sourceCount: number = 1
  ): number {
    // Base reliability from field-source mapping
    const fieldReliability = FIELD_SOURCE_RELIABILITY[field]?.[source] || 0.8;
    const sourceWeight = SOURCE_QUALITY_WEIGHTS[source] || 1.0;

    // Recency factor (data freshness)
    // More recent = higher confidence
    const recencyFactor = this.calculateRecencyFactor(recencyDays);

    // Source count factor (more sources agreeing = higher confidence)
    const sourceCountFactor = this.calculateSourceCountFactor(sourceCount);

    // Calculate weighted confidence
    const baseConfidence = fieldReliability * 0.6 + (sourceWeight / 3.0) * 0.2;
    const adjustedConfidence = baseConfidence * recencyFactor * sourceCountFactor;

    return Math.min(1.0, Math.max(0.0, adjustedConfidence));
  }

  /**
   * Calculate recency factor based on days since last update
   */
  private static calculateRecencyFactor(recencyDays: number): number {
    if (recencyDays < 0) recencyDays = 0;

    // Exponential decay: 1.0 for 0 days, ~0.9 for 30 days, ~0.7 for 90 days
    if (recencyDays === 0) return 1.0;
    if (recencyDays <= 7) return 0.98;
    if (recencyDays <= 30) return 0.95;
    if (recencyDays <= 90) return 0.85;
    if (recencyDays <= 180) return 0.75;
    return 0.65; // > 180 days
  }

  /**
   * Calculate source count factor
   */
  private static calculateSourceCountFactor(sourceCount: number): number {
    if (sourceCount <= 0) return 0.5;
    if (sourceCount === 1) return 0.7;
    if (sourceCount === 2) return 0.9;
    if (sourceCount >= 3) return 1.0;
    return 0.8;
  }

  /**
   * Calculate aggregate confidence from multiple sources
   */
  public static calculateAggregateConfidence(
    field: string,
    sources: Array<{
      source: string;
      value: any;
      recencyDays?: number;
    }>
  ): {
    confidence: number;
    resolvedValue: any;
    sourceAgreement: number;
  } {
    if (sources.length === 0) {
      return { confidence: 0, resolvedValue: null, sourceAgreement: 0 };
    }

    // Group by value
    const valueGroups = new Map<
      any,
      Array<{ source: string; recencyDays: number; confidence: number }>
    >();

    sources.forEach(({ source, value, recencyDays = 0 }) => {
      const confidence = this.calculateFieldConfidence(field, source, recencyDays, sources.length);
      if (!valueGroups.has(value)) {
        valueGroups.set(value, []);
      }
      valueGroups.get(value)!.push({ source, recencyDays, confidence });
    });

    // Find value with highest aggregate confidence
    let bestValue: any = null;
    let bestConfidence = 0;
    let bestSourceAgreement = 0;

    valueGroups.forEach((sourceData, value) => {
      const totalConfidence = sourceData.reduce((sum, s) => sum + s.confidence, 0);
      const avgConfidence = totalConfidence / sourceData.length;
      const sourceAgreement = sourceData.length / sources.length;

      // Weighted score: confidence * agreement
      const weightedScore = avgConfidence * 0.7 + sourceAgreement * 0.3;

      if (weightedScore > bestConfidence) {
        bestConfidence = weightedScore;
        bestValue = value;
        bestSourceAgreement = sourceAgreement;
      }
    });

    return {
      confidence: Math.min(1.0, bestConfidence),
      resolvedValue: bestValue,
      sourceAgreement: bestSourceAgreement,
    };
  }

  /**
   * Determine if confidence is sufficient for auto-resolution
   */
  public static isConfidenceSufficient(confidence: number, threshold: number = 0.7): boolean {
    return confidence >= threshold;
  }

  /**
   * Get source weight
   */
  public static getSourceWeight(source: string): number {
    return SOURCE_QUALITY_WEIGHTS[source] || 1.0;
  }

  /**
   * Get field reliability for source
   */
  public static getFieldReliability(field: string, source: string): number {
    return FIELD_SOURCE_RELIABILITY[field]?.[source] || 0.8;
  }
}
