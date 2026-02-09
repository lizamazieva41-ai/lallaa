import { logger } from '../../utils/logger';

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  timestamp: Date;
  action: string;
  reason: string;
  performedBy: string | 'system';
}

/**
 * Audit Trail Management - Track all conflict resolution decisions with timestamps and reasons
 */
export class AuditTrail {
  private trails: Map<string, Map<string, AuditTrailEntry[]>> = new Map();

  /**
   * Add audit trail entry for a BIN and field
   */
  public addEntry(bin: string, field: string, entry: AuditTrailEntry): void {
    if (!this.trails.has(bin)) {
      this.trails.set(bin, new Map());
    }

    const binTrail = this.trails.get(bin)!;
    if (!binTrail.has(field)) {
      binTrail.set(field, []);
    }

    binTrail.get(field)!.push(entry);
    logger.debug('Audit trail entry added', { bin, field, action: entry.action });
  }

  /**
   * Get audit trail entries for a BIN and field
   */
  public getEntries(bin: string, field: string): AuditTrailEntry[] {
    return this.trails.get(bin)?.get(field) || [];
  }

  /**
   * Get all audit trail entries for a BIN
   */
  public getBinEntries(bin: string): Map<string, AuditTrailEntry[]> {
    return this.trails.get(bin) || new Map();
  }

  /**
   * Get all audit trails
   */
  public getAllTrails(): Map<string, Map<string, AuditTrailEntry[]>> {
    return this.trails;
  }

  /**
   * Clear audit trail for a BIN
   */
  public clearBin(bin: string): void {
    this.trails.delete(bin);
    logger.debug('Audit trail cleared for BIN', { bin });
  }

  /**
   * Clear all audit trails
   */
  public clearAll(): void {
    this.trails.clear();
    logger.info('All audit trails cleared');
  }

  /**
   * Export audit trail to JSON
   */
  public exportToJSON(): string {
    type ExportedEntry = Omit<AuditTrailEntry, 'timestamp'> & { timestamp: string };
    const exportData: Record<string, Record<string, ExportedEntry[]>> = {};

    this.trails.forEach((binTrail, bin) => {
      exportData[bin] = {};
      binTrail.forEach((entries, field) => {
        exportData[bin][field] = entries.map(entry => ({
          action: entry.action,
          reason: entry.reason,
          performedBy: entry.performedBy,
          timestamp: entry.timestamp.toISOString(), // Convert Date to string for JSON
        }));
      });
    });

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get audit trail statistics
   */
  public getStatistics(): {
    totalBins: number;
    totalFields: number;
    totalEntries: number;
    byPerformer: Record<string, number>;
  } {
    let totalFields = 0;
    let totalEntries = 0;
    const byPerformer: Record<string, number> = {};

    this.trails.forEach(binTrail => {
      binTrail.forEach(entries => {
        totalFields++;
        totalEntries += entries.length;
        entries.forEach(entry => {
          byPerformer[entry.performedBy] = (byPerformer[entry.performedBy] || 0) + 1;
        });
      });
    });

    return {
      totalBins: this.trails.size,
      totalFields,
      totalEntries,
      byPerformer,
    };
  }
}
