import { binModel } from '../models/bin';
import { countryModel } from '../models/country';
import { BINLookupResult, CardType, CardNetwork, BIN } from '../types';
import { logger } from '../utils/logger';
import { binCacheService } from './redisCache';
import { braintreeValidator } from './enhancedValidation/braintreeValidator';
import { optimizedCacheManager } from './advancedCaching/optimizedCache';

// Card network patterns (expanded with Braintree and additional networks)
const CARD_NETWORK_PATTERNS: Array<{
  network: CardNetwork;
  patterns: RegExp[];
}> = [
  {
    network: CardNetwork.VISA,
    patterns: [/^4/],
  },
  {
    network: CardNetwork.MASTERCARD,
    patterns: [/^5[1-5]/, /^2[2-7]/],
  },
  {
    network: CardNetwork.AMEX,
    patterns: [/^3[47]/],
  },
  {
    network: CardNetwork.DISCOVER,
    patterns: [/^6(?:011|5)/, /^64[4-9]/, /^65/],
  },
  {
    network: CardNetwork.JCB,
    patterns: [/^35(?:2[8-9]|[3-8])/],
  },
  {
    network: CardNetwork.UNIONPAY,
    patterns: [/^62/],
  },
  {
    network: CardNetwork.DINERS,
    patterns: [/^3(?:0[0-5]|[68])/],
  },
  // Additional networks supported by Braintree/credit-card-type
  // Maestro, MIR, ELO, Hiper, Hipercard patterns can be added here
];

// Card type patterns based on first digits
const CARD_TYPE_PATTERNS: Record<string, CardType> = {
  '400000': CardType.DEBIT,
  '417500': CardType.DEBIT,
  '450000': CardType.DEBIT,
  '484411': CardType.DEBIT,
  '402340': CardType.DEBIT,
  '405000': CardType.DEBIT,
  '420000': CardType.DEBIT,
};

/**
 * LRU Cache Implementation with TTL
 * Simple in-memory cache for BIN lookups with 24-hour TTL
 */
class LRUCache<T> {
  private cache: Map<string, { value: T; expiry: number }>;
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 10000, ttlMs: number = 24 * 60 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T): void {
    // Evict oldest item if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs,
    });
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }

  stats(): { size: number; maxSize: number; ttlHours: number } {
    return {
      size: this.size(),
      maxSize: this.maxSize,
      ttlHours: this.ttlMs / (60 * 60 * 1000),
    };
  }
}

// Cache instance for BIN lookups (24h TTL, max 10000 entries)
const lookupCache = new LRUCache<BINLookupResult>(10000, 24 * 60 * 60 * 1000);

export interface BINSearchParams {
  countryCode?: string;
  cardType?: CardType;
  cardNetwork?: CardNetwork;
  bankName?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface BINSearchResult {
  bins: BINLookupResult[];
  total: number;
  page: number;
  limit: number;
}

export class BINService {
  private normalizeBIN(bin: string): string {
    return bin.replace(/\s/g, '').replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  public validateBINFormat(bin: string): boolean {
    const normalized = this.normalizeBIN(bin);
    return /^\d{6,8}$/.test(normalized);
  }

  public detectCardNetwork(bin: string): CardNetwork {
    const normalized = this.normalizeBIN(bin);

    // First, try Braintree validator for enhanced detection
    try {
      const braintreeNetwork = braintreeValidator.getCardNetwork(normalized);
      if (braintreeNetwork) {
        // Map Braintree network names to our CardNetwork enum
        const networkMap: Record<string, CardNetwork> = {
          'visa': CardNetwork.VISA,
          'mastercard': CardNetwork.MASTERCARD,
          'american-express': CardNetwork.AMEX,
          'amex': CardNetwork.AMEX,
          'discover': CardNetwork.DISCOVER,
          'jcb': CardNetwork.JCB,
          'unionpay': CardNetwork.UNIONPAY,
          'diners-club': CardNetwork.DINERS,
          'diners': CardNetwork.DINERS,
        };

        const mappedNetwork = networkMap[braintreeNetwork.toLowerCase()];
        if (mappedNetwork) {
          return mappedNetwork;
        }
      }
    } catch (error) {
      logger.debug('Braintree validator failed, falling back to pattern matching', { error });
    }

    // Fallback to pattern matching
    for (const { network, patterns } of CARD_NETWORK_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          return network;
        }
      }
    }

    return CardNetwork.OTHER;
  }

  public detectCardType(bin: string, length?: number): CardType {
    const normalized = this.normalizeBIN(bin);

    for (const [prefix, type] of Object.entries(CARD_TYPE_PATTERNS)) {
      if (normalized.startsWith(prefix)) {
        return type;
      }
    }

    const network = this.detectCardNetwork(bin);
    const cardLength = length || this.detectCardLength(bin);

    if (network === CardNetwork.AMEX) {
      return CardType.CREDIT;
    }

    if (network === CardNetwork.VISA || network === CardNetwork.MASTERCARD) {
      if (cardLength === 13) {
        return CardType.DEBIT;
      }
      return CardType.CREDIT;
    }

    return CardType.DEBIT;
  }

  public detectCardLength(bin: string): number {
    const normalized = this.normalizeBIN(bin);
    const prefix2 = normalized.substring(0, 2);
    const prefix4 = normalized.substring(0, 4);

    if (prefix2 === '40' || prefix2 === '41' || prefix2 === '42' || prefix2 === '43' || prefix2 === '44') {
      return 13;
    }

    if (prefix2 === '44' || prefix2 === '45' || prefix2 === '48') {
      return 16;
    }

    if (prefix2 >= '51' && prefix2 <= '55') {
      return 16;
    }

    if (prefix4 >= '2221' && prefix4 <= '2720') {
      return 16;
    }

    if (prefix2 === '34' || prefix2 === '37') {
      return 15;
    }

    if (prefix2 === '60' || prefix2 === '64' || prefix2 === '65') {
      return 16;
    }

    if (prefix2 === '35') {
      return 16;
    }

    return 16;
  }

  public validateLuhn(bin: string): boolean {
    const normalized = this.normalizeBIN(bin);
    if (!/^\d+$/.test(normalized)) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = normalized.length - 1; i >= 0; i--) {
      let digit = parseInt(normalized[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  public async lookup(bin: string): Promise<BINLookupResult | null> {
    const normalizedBin = this.normalizeBIN(bin);

    if (!this.validateBINFormat(normalizedBin)) {
      throw new Error('Invalid BIN format. BIN must be 6-8 digits.');
    }

    // Use optimized multi-tier cache (Bloom → LRU → Redis → DB)
    try {
      const cacheResult = await optimizedCacheManager.lookup(normalizedBin);
      
      if (cacheResult.data) {
        // Enhance with country emoji if available
        const country = await countryModel.findByCode(cacheResult.data.country.code);
        if (country && cacheResult.data.country) {
          cacheResult.data.country = {
            ...cacheResult.data.country,
            emoji: this.getCountryEmoji(cacheResult.data.country.code),
          };
        }
        return cacheResult.data;
      }
      
      // If not found, create fallback result
      if (cacheResult.source === 'not-found') {
        const network = this.detectCardNetwork(normalizedBin);
        const type = this.detectCardType(normalizedBin);
        const length = this.detectCardLength(normalizedBin);
        const country = await countryModel.findByCode('XX');

        return {
          bin: normalizedBin,
          bank: {
            name: 'Unknown Bank',
            nameLocal: undefined,
          },
          country: {
            code: 'XX',
            name: country?.countryName || 'Unknown',
          },
          card: {
            type,
            network,
          },
          metadata: {
            binRange: normalizedBin,
            expectedLength: length,
          },
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Optimized cache lookup failed, falling back to direct lookup', {
        bin: normalizedBin,
        error,
      });

      // Fallback to direct database lookup (no optimized cache)
      logger.debug('BIN lookup cache miss, querying database', { bin: normalizedBin });

      try {
        let result = await binModel.lookup(normalizedBin);

        if (!result) {
          const network = this.detectCardNetwork(normalizedBin);
          const type = this.detectCardType(normalizedBin);
          const length = this.detectCardLength(normalizedBin);
          const country = await countryModel.findByCode('XX');

          result = {
            bin: normalizedBin,
            bank: {
              name: 'Unknown Bank',
              nameLocal: undefined,
            },
            country: {
              code: 'XX',
              name: country?.countryName || 'Unknown',
            },
            card: {
              type,
              network,
            },
            metadata: {
              binRange: normalizedBin,
              expectedLength: length,
            },
          };
        } else {
          const country = await countryModel.findByCode(result.country.code);
          if (country) {
            result.country = {
              ...result.country,
              emoji: this.getCountryEmoji(result.country.code),
            };
          }
        }

        // Store in both caches for future lookups
        if (result) {
          lookupCache.set(normalizedBin, result);
          const redisCacheKey = `lookup:${normalizedBin}`;
          try {
            await binCacheService.set(redisCacheKey, result, 86400);
          } catch (cacheError) {
            logger.warn('Failed to write Redis cache during fallback lookup', {
              bin: normalizedBin,
              error: cacheError,
            });
          }
        }

        return result;
      } catch (fallbackError) {
        logger.error('BIN lookup failed', { bin: normalizedBin, error: fallbackError });
        throw fallbackError;
      }
    }
  }

  public async lookupBatch(bins: string[]): Promise<Map<string, BINLookupResult | null>> {
    const results = new Map<string, BINLookupResult | null>();
    const uncachedBins: string[] = [];

    // Check cache for each BIN
    for (const bin of bins) {
      const normalizedBin = this.normalizeBIN(bin);
      const cached = lookupCache.get(normalizedBin);
      if (cached) {
        results.set(bin, cached);
      } else {
        uncachedBins.push(bin);
      }
    }

    // Fetch uncached BINs from database
    if (uncachedBins.length > 0) {
      const promises = uncachedBins.map(async (bin) => {
        try {
          const result = await this.lookup(bin);
          results.set(bin, result);
        } catch {
          results.set(bin, null);
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  public async search(params: BINSearchParams): Promise<BINSearchResult> {
    const limit = Math.min(params.limit || 50, 100);
    const offset = params.offset || 0;

    try {
      const result = await binModel.search({
        ...params,
        limit,
        offset,
      });

      return {
        bins: result.bins.map((bin) => this.mapBINToLookupResult(bin)),
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        limit,
      };
    } catch (error) {
      logger.error('BIN search failed', { params, error });
      throw error;
    }
  }

  public async getByCountry(countryCode: string): Promise<BINLookupResult[]> {
    try {
      const bins = await binModel.getByCountry(countryCode);
      return bins.map((bin) => this.mapBINToLookupResult(bin));
    } catch (error) {
      logger.error('Get BINs by country failed', { countryCode, error });
      throw error;
    }
  }

  public async getStatistics(): Promise<{
    totalBINs: number;
    activeBINs: number;
    byCountry: Record<string, number>;
    byCardType: Record<string, number>;
    byNetwork: Record<string, number>;
  }> {
    try {
      const stats = await binModel.getStatistics();
      const byNetwork: Record<string, number> = {};
      const byCardType: Record<string, number> = {};

      return {
        totalBINs: stats.totalBINs,
        activeBINs: stats.activeBINs,
        byCountry: stats.byCountry,
        byCardType,
        byNetwork,
      };
    } catch (error) {
      logger.error('Get BIN statistics failed', { error });
      throw error;
    }
  }

  public getSupportedNetworks(): Array<{ network: CardNetwork; patterns: string[] }> {
    return CARD_NETWORK_PATTERNS.map(({ network, patterns }) => ({
      network,
      patterns: patterns.map((p) => p.source),
    }));
  }

  public getSupportedTypes(): CardType[] {
    return [CardType.DEBIT, CardType.CREDIT, CardType.PREPAID, CardType.CORPORATE];
  }

  /**
   * Clear the lookup cache
   * Useful for admin operations or when data is updated
   */
  public async clearCache(): Promise<void> {
    // Clear in-memory cache
    lookupCache.clear();
    // Clear Redis cache
    await binCacheService.deletePattern('lookup:*');
    logger.info('BIN lookup cache cleared (in-memory and Redis)');
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): ReturnType<typeof lookupCache.stats> {
    return lookupCache.stats();
  }

  private getCountryEmoji(countryCode: string): string | undefined {
    if (countryCode.length !== 2) return undefined;
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  private mapBINToLookupResult(bin: BIN): BINLookupResult {
    return {
      bin: bin.bin,
      bank: {
        name: bin.bankName,
        nameLocal: bin.bankNameLocal,
        code: bin.bankCode,
      },
      country: {
        code: bin.countryCode,
        name: bin.countryName,
      },
      card: {
        type: bin.cardType,
        network: bin.cardNetwork,
      },
      metadata: {
        binRange: bin.binRangeStart ? `${bin.binRangeStart}-${bin.binRangeEnd}` : undefined,
      },
    };
  }

  public analyzeBIN(bin: string): {
    normalized: string;
    isValid: boolean;
    network: CardNetwork;
    type: CardType;
    length: number;
    luhnValid: boolean | null;
  } {
    const normalized = this.normalizeBIN(bin);
    const isValid = this.validateBINFormat(normalized);
    const network = this.detectCardNetwork(normalized);
    const type = this.detectCardType(normalized);
    const length = this.detectCardLength(normalized);
    const luhnValid = isValid ? this.validateLuhn(normalized) : null;

    return {
      normalized,
      isValid,
      network,
      type,
      length,
      luhnValid,
    };
  }

  public parseCardNetwork(bin: string): CardNetwork {
    return this.detectCardNetwork(bin);
  }

  public parseCardType(bin: string): CardType {
    return this.detectCardType(bin);
  }

  /**
   * Get full BIN record with provenance data (admin only)
   * Returns complete BIN information including source, source_version, import_date
   */
  public async getBINWithProvenance(bin: string): Promise<BIN | null> {
    try {
      const normalizedBin = this.normalizeBIN(bin);
      return await binModel.findByBIN(normalizedBin);
    } catch (error) {
      logger.error('Failed to get BIN with provenance', { bin, error });
      throw error;
    }
  }

  /**
   * Get all BINs from a specific data source (admin only)
   */
  public async getBINsBySource(source: string): Promise<BIN[]> {
    try {
      return await binModel.getBySource(source);
    } catch (error) {
      logger.error('Failed to get BINs by source', { source, error });
      throw error;
    }
  }

  /**
   * Get data quality report by source (admin only)
   */
  public async getSourceQualityReport(): Promise<Record<string, {
    totalBINs: number;
    activeBINs: number;
    lastImport: Date | null;
    completeness: number;
  }>> {
    try {
      return await binModel.getSourceQualityReport();
    } catch (error) {
      logger.error('Failed to get source quality report', { error });
      throw error;
    }
  }

  /**
   * Get ETL run history (admin only)
   */
  public async getETLRunHistory(limit: number): Promise<Array<{
    id: string;
    source: string;
    version: string;
    recordCount: number;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
  }>> {
    try {
      return await binModel.getETLRunHistory(limit);
    } catch (error) {
      logger.error('Failed to get ETL run history', { error });
      throw error;
    }
  }
}

export const binService = new BINService();
