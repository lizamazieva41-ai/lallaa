import { ConflictResolution } from './conflictResolver';
import { logger } from '../../utils/logger';

/**
 * Manual review queue item
 */
export interface ManualReviewItem {
  id: string;
  bin: string;
  field: string;
  conflictResolution: ConflictResolution;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  assignedTo?: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'dismissed';
  resolvedAt?: Date;
  resolutionNotes?: string;
}

/**
 * Manual Review Queue - Queue conflicts with confidence <70% for manual review
 */
export class ManualReviewQueue {
  private queue: Map<string, ManualReviewItem> = new Map();
  private nextId: number = 1;

  /**
   * Add conflict to manual review queue
   */
  public addToQueue(
    bin: string,
    field: string,
    conflictResolution: ConflictResolution
  ): string {
    const id = `MR-${this.nextId++}-${Date.now()}`;
    const priority = this.calculatePriority(conflictResolution);

    const item: ManualReviewItem = {
      id,
      bin,
      field,
      conflictResolution,
      priority,
      createdAt: new Date(),
      status: 'pending',
    };

    this.queue.set(id, item);
    logger.info('Added to manual review queue', { id, bin, field, priority });

    return id;
  }

  /**
   * Calculate priority based on confidence and field importance
   */
  private calculatePriority(conflictResolution: ConflictResolution): ManualReviewItem['priority'] {
    const confidence = conflictResolution.resolution.confidence;
    const field = conflictResolution.field;

    // Critical fields (country, network) with low confidence = high priority
    if (['country', 'network'].includes(field) && confidence < 0.5) {
      return 'critical';
    }

    if (confidence < 0.5) {
      return 'high';
    }

    if (confidence < 0.6) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get queue item by ID
   */
  public getItem(id: string): ManualReviewItem | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all pending items
   */
  public getPendingItems(): ManualReviewItem[] {
    return Array.from(this.queue.values()).filter(item => item.status === 'pending');
  }

  /**
   * Get items by priority
   */
  public getItemsByPriority(priority: ManualReviewItem['priority']): ManualReviewItem[] {
    return Array.from(this.queue.values()).filter(item => item.priority === priority);
  }

  /**
   * Get items by status
   */
  public getItemsByStatus(status: ManualReviewItem['status']): ManualReviewItem[] {
    return Array.from(this.queue.values()).filter(item => item.status === status);
  }

  /**
   * Get items by BIN
   */
  public getItemsByBin(bin: string): ManualReviewItem[] {
    return Array.from(this.queue.values()).filter(item => item.bin === bin);
  }

  /**
   * Assign item to reviewer
   */
  public assignItem(id: string, assignedTo: string): boolean {
    const item = this.queue.get(id);
    if (!item) {
      logger.warn('Item not found in queue', { id });
      return false;
    }

    item.assignedTo = assignedTo;
    item.status = 'in-progress';
    logger.info('Item assigned', { id, assignedTo });

    return true;
  }

  /**
   * Resolve item
   */
  public resolveItem(id: string, resolutionNotes: string, resolvedValue?: any): boolean {
    const item = this.queue.get(id);
    if (!item) {
      logger.warn('Item not found in queue', { id });
      return false;
    }

    item.status = 'resolved';
    item.resolvedAt = new Date();
    item.resolutionNotes = resolutionNotes;

    // Update conflict resolution if resolved value provided
    if (resolvedValue !== undefined) {
      item.conflictResolution.resolution.resolvedValue = resolvedValue;
      item.conflictResolution.resolution.confidence = 1.0; // Manual resolution = 100% confidence
    }

    logger.info('Item resolved', { id, resolutionNotes });

    return true;
  }

  /**
   * Dismiss item (not a real conflict)
   */
  public dismissItem(id: string, reason: string): boolean {
    const item = this.queue.get(id);
    if (!item) {
      logger.warn('Item not found in queue', { id });
      return false;
    }

    item.status = 'dismissed';
    item.resolvedAt = new Date();
    item.resolutionNotes = `Dismissed: ${reason}`;

    logger.info('Item dismissed', { id, reason });

    return true;
  }

  /**
   * Get queue statistics
   */
  public getStatistics(): {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    dismissed: number;
    byPriority: Record<ManualReviewItem['priority'], number>;
    averageResolutionTime: number; // in hours
  } {
    const items = Array.from(this.queue.values());
    const byPriority: Record<ManualReviewItem['priority'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    items.forEach(item => {
      byPriority[item.priority]++;

      if (item.status === 'resolved' && item.resolvedAt && item.createdAt) {
        const resolutionTime =
          (item.resolvedAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60); // hours
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    });

    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      inProgress: items.filter(i => i.status === 'in-progress').length,
      resolved: items.filter(i => i.status === 'resolved').length,
      dismissed: items.filter(i => i.status === 'dismissed').length,
      byPriority,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    };
  }

  /**
   * Clear resolved items older than specified days
   */
  public clearOldResolvedItems(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleared = 0;
    this.queue.forEach((item, id) => {
      if (
        (item.status === 'resolved' || item.status === 'dismissed') &&
        item.resolvedAt &&
        item.resolvedAt < cutoffDate
      ) {
        this.queue.delete(id);
        cleared++;
      }
    });

    if (cleared > 0) {
      logger.info('Cleared old resolved items', { cleared, daysOld });
    }

    return cleared;
  }
}

export const manualReviewQueue = new ManualReviewQueue();
