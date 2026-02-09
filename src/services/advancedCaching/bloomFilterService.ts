/**
 * Bloom Filter Service
 * Implement negative cache for non-existent BINs with O(1) lookup
 */

import { BloomFilter } from 'bloom-filters';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Bloom Filter Service - Negative cache for non-existent BINs
 */
export class BloomFilterService {
  private filter: BloomFilter;
  private capacity: number;
  private errorRate: number;
  private filterPath: string;

  constructor(capacity: number = 1000000, errorRate: number = 0.01) {
    this.capacity = capacity;
    this.errorRate = errorRate;
    this.filter = BloomFilter.create(capacity, errorRate);
    this.filterPath = path.join(process.cwd(), 'data', 'cache', 'bloom-filter.json');

    // Load existing filter if available
    this.loadFilter();
  }

  /**
   * Add BIN to bloom filter (mark as non-existent)
   */
  public add(bin: string): void {
    const normalized = this.normalizeBIN(bin);
    this.filter.add(normalized);
    logger.debug('Added BIN to bloom filter', { bin: normalized });
  }

  /**
   * Check if BIN might exist.
   *
   * This Bloom filter is used as a **negative cache**: it stores BINs known to be missing.
   * Therefore:
   * - If the filter says "has(bin)" => bin is *probably missing* (false positives possible)
   * - If the filter says "!has(bin)" => bin might exist (no false negatives for the "missing" set)
   */
  public mightExist(bin: string): boolean {
    const normalized = this.normalizeBIN(bin);
    return !this.filter.has(normalized);
  }

  /**
   * Check if BIN definitely doesn't exist (negative cache check)
   * Returns true if BIN is *probably* missing (false positives possible).
   *
   * This name matches how we use it in the cache manager: a "true" result means
   * we should skip downstream caches/DB and return not-found immediately.
   */
  public definitelyNotExist(bin: string): boolean {
    const normalized = this.normalizeBIN(bin);
    return this.filter.has(normalized);
  }

  /**
   * Add multiple BINs at once
   */
  public addBatch(bins: string[]): void {
    bins.forEach(bin => this.add(bin));
    logger.debug('Added batch to bloom filter', { count: bins.length });
  }

  /**
   * Get filter statistics
   */
  public getStatistics(): {
    capacity: number;
    errorRate: number;
    size: number;
    falsePositiveRate: number;
  } {
    return {
      capacity: this.capacity,
      errorRate: this.errorRate,
      size: this.filter.length,
      falsePositiveRate: this.filter.rate(),
    };
  }

  /**
   * Save filter to disk
   */
  public saveFilter(): void {
    try {
      const filterDir = path.dirname(this.filterPath);
      if (!fs.existsSync(filterDir)) {
        fs.mkdirSync(filterDir, { recursive: true });
      }

      const serialized = this.filter.saveAsJSON();
      fs.writeFileSync(this.filterPath, JSON.stringify(serialized), 'utf-8');
      logger.info('Bloom filter saved to disk', { path: this.filterPath });
    } catch (error) {
      logger.error('Failed to save bloom filter', { error, path: this.filterPath });
    }
  }

  /**
   * Load filter from disk
   */
  public loadFilter(): void {
    try {
      if (fs.existsSync(this.filterPath)) {
        const content = fs.readFileSync(this.filterPath, 'utf-8');
        const serialized = JSON.parse(content);
        this.filter = BloomFilter.fromJSON(serialized);
        logger.info('Bloom filter loaded from disk', {
          path: this.filterPath,
          size: this.filter.length,
        });
      } else {
        logger.debug('Bloom filter file not found, starting with empty filter', {
          path: this.filterPath,
        });
      }
    } catch (error) {
      logger.warn('Failed to load bloom filter, starting with empty filter', {
        error,
        path: this.filterPath,
      });
    }
  }

  /**
   * Clear filter
   */
  public clear(): void {
    this.filter = BloomFilter.create(this.capacity, this.errorRate);
    logger.info('Bloom filter cleared');
  }

  /**
   * Reset filter with new capacity and error rate
   */
  public reset(capacity?: number, errorRate?: number): void {
    this.capacity = capacity || this.capacity;
    this.errorRate = errorRate || this.errorRate;
    this.filter = BloomFilter.create(this.capacity, this.errorRate);
    logger.info('Bloom filter reset', {
      capacity: this.capacity,
      errorRate: this.errorRate,
    });
  }

  /**
   * Normalize BIN for storage
   */
  private normalizeBIN(bin: string): string {
    return bin.replace(/\s/g, '').replace(/-/g, '').substring(0, 8).toUpperCase();
  }
}

export const bloomFilterService = new BloomFilterService();
