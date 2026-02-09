import { ConfidenceScorer } from './confidenceScorer';
import { AuditTrail } from './auditTrail';
import { logger } from '../../utils/logger';

/**
 * Source data for conflict resolution
 */
export interface SourceData {
  source: string;
  value: any;
  confidence: number;
  lastUpdated: Date;
  recencyDays?: number;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  field: string;
  sources: SourceData[];
  resolution: {
    strategy: 'highest-confidence' | 'most-recent' | 'merge-available' | 'manual-review';
    resolvedValue: any;
    confidence: number;
    requiresManualReview: boolean;
  };
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    reason: string;
    performedBy: string | 'system';
  }>;
}

/**
 * Conflict Resolution Strategy
 */
export type ResolutionStrategy =
  | 'highest-confidence'
  | 'most-recent'
  | 'merge-available'
  | 'manual-review';

/**
 * Advanced Conflict Resolver - Field-level conflict resolution with confidence-based strategies
 */
export class AdvancedConflictResolver {
  private auditTrail: AuditTrail;
  private autoResolutionThreshold: number = 0.7;

  constructor(auditTrail?: AuditTrail) {
    this.auditTrail = auditTrail || new AuditTrail();
  }

  /**
   * Resolve conflict for a specific field
   */
  public async resolveConflict(
    bin: string,
    field: string,
    sources: SourceData[]
  ): Promise<ConflictResolution> {
    logger.debug('Resolving conflict', { bin, field, sourceCount: sources.length });

    // Calculate field-specific confidence scores
    const sourceConfidences = sources.map(source => ({
      ...source,
      confidence: ConfidenceScorer.calculateFieldConfidence(
        field,
        source.source,
        source.recencyDays || this.calculateRecencyDays(source.lastUpdated),
        sources.length
      ),
    }));

    // Calculate aggregate confidence
    const aggregate = ConfidenceScorer.calculateAggregateConfidence(field, sourceConfidences);

    // Determine resolution strategy
    const strategy = this.determineStrategy(aggregate.confidence, sources);

    // Resolve value based on strategy
    const resolvedValue = this.resolveValue(strategy, aggregate, sourceConfidences);

    // Check if manual review is required
    const requiresManualReview =
      !ConfidenceScorer.isConfidenceSufficient(aggregate.confidence, this.autoResolutionThreshold);

    // Create audit trail entry
    const auditEntry = {
      timestamp: new Date(),
      action: `Resolved conflict for field ${field}`,
      reason: `Strategy: ${strategy}, Confidence: ${aggregate.confidence.toFixed(3)}`,
      performedBy: requiresManualReview ? 'pending-manual-review' : 'system',
    };

    this.auditTrail.addEntry(bin, field, auditEntry);

    return {
      field,
      sources: sourceConfidences,
      resolution: {
        strategy,
        resolvedValue,
        confidence: aggregate.confidence,
        requiresManualReview,
      },
      auditTrail: this.auditTrail.getEntries(bin, field),
    };
  }

  /**
   * Determine resolution strategy based on confidence and sources
   */
  private determineStrategy(
    confidence: number,
    sources: SourceData[]
  ): ResolutionStrategy {
    if (confidence < this.autoResolutionThreshold) {
      return 'manual-review';
    }

    // If high confidence and multiple sources agree, use highest confidence
    if (confidence >= 0.9 && sources.length >= 2) {
      return 'highest-confidence';
    }

    // If sources have very recent updates, prefer most recent
    const hasRecentUpdates = sources.some(
      s => (s.recencyDays || 0) <= 7
    );
    if (hasRecentUpdates && confidence >= 0.8) {
      return 'most-recent';
    }

    // Default to highest confidence
    return 'highest-confidence';
  }

  /**
   * Resolve value based on strategy
   */
  private resolveValue(
    strategy: ResolutionStrategy,
    aggregate: { confidence: number; resolvedValue: any; sourceAgreement: number },
    sources: SourceData[]
  ): any {
    switch (strategy) {
      case 'highest-confidence':
        // Use value with highest aggregate confidence
        return aggregate.resolvedValue;

      case 'most-recent':
        // Use value from most recent source
        const mostRecent = sources.reduce((latest, current) => {
          const currentDays = current.recencyDays || 999;
          const latestDays = latest.recencyDays || 999;
          return currentDays < latestDays ? current : latest;
        });
        return mostRecent.value;

      case 'merge-available':
        // Merge complementary data from multiple sources
        return this.mergeValues(sources);

      case 'manual-review':
        // Return null or most likely value, flag for review
        return aggregate.resolvedValue || sources[0]?.value || null;

      default:
        return aggregate.resolvedValue;
    }
  }

  /**
   * Merge values from multiple sources (for fields that can be merged)
   */
  private mergeValues(sources: SourceData[]): any {
    // For most fields, we can't really "merge" - just use best value
    // This is more useful for fields like "issuer" where we might combine names
    const bestSource = sources.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
    return bestSource.value;
  }

  /**
   * Calculate recency in days
   */
  private calculateRecencyDays(lastUpdated: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - lastUpdated.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Set auto-resolution threshold
   */
  public setAutoResolutionThreshold(threshold: number): void {
    this.autoResolutionThreshold = Math.max(0, Math.min(1, threshold));
    logger.info('Auto-resolution threshold updated', { threshold: this.autoResolutionThreshold });
  }

  /**
   * Get auto-resolution threshold
   */
  public getAutoResolutionThreshold(): number {
    return this.autoResolutionThreshold;
  }
}
