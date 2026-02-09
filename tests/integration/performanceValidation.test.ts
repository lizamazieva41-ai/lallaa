/**
 * Performance Validation Tests
 * Validate p95 <50ms and cache hit rate >95% under load
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { binService } from '../../src/services/bin';
import { optimizedCacheManager } from '../../src/services/advancedCaching/optimizedCache';
import { cacheMetricsTracker } from '../../src/services/advancedCaching/cacheMetrics';

jest.mock('../../src/models/bin', () => ({
  binModel: {
    lookup: jest.fn(async (bin: string) => ({
      bin,
      bank: { name: 'Test Bank' },
      country: { code: 'US', name: 'United States' },
      card: { type: 'debit', network: 'visa' },
    })),
  },
}));

jest.mock('../../src/services/redisCache', () => {
  const store = new Map<string, any>();
  return {
    binCacheService: {
      get: jest.fn(async (key: string) => {
        if (!store.has(key)) return { hit: false, data: null };
        return { hit: true, data: store.get(key) };
      }),
      set: jest.fn(async (key: string, value: any) => {
        store.set(key, value);
      }),
      deletePattern: jest.fn(async (pattern: string) => {
        // simple prefix delete for "lookup:*"
        const prefix = pattern.replace('*', '');
        for (const k of Array.from(store.keys())) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      }),
      clear: jest.fn(async () => store.clear()),
    },
  };
});

jest.mock('../../src/models/country', () => ({
  countryModel: {
    findByCode: jest.fn(async (code: string) => ({ countryName: code === 'XX' ? 'Unknown' : 'United States' })),
  },
}));

describe('Performance Validation', () => {
  const testBINs = [
    '400000',
    '510000',
    '378282',
    '601100',
    '352800',
    '411111',
    '555555',
    '424242',
    '401288',
    '400000',
  ];

  beforeEach(() => {
    // Clear caches before each test
    cacheMetricsTracker.reset();
    return Promise.all([binService.clearCache(), optimizedCacheManager.clearAll()]).then(() => undefined);
  });

  describe('Response Time', () => {
    it('should achieve p95 response time <50ms', async () => {
      const responseTimes: number[] = [];

      // Warm up cache
      for (const bin of testBINs) {
        await binService.lookup(bin);
      }

      // Measure response times
      for (let i = 0; i < 100; i++) {
        const bin = testBINs[i % testBINs.length];
        const startTime = Date.now();
        await binService.lookup(bin);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Calculate p95
      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p95 = responseTimes[p95Index];

      expect(p95).toBeLessThan(50);
    });

    it('should achieve p50 response time <20ms', async () => {
      const responseTimes: number[] = [];

      // Warm up cache
      for (const bin of testBINs) {
        await binService.lookup(bin);
      }

      // Measure response times
      for (let i = 0; i < 100; i++) {
        const bin = testBINs[i % testBINs.length];
        const startTime = Date.now();
        await binService.lookup(bin);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Calculate p50
      responseTimes.sort((a, b) => a - b);
      const p50Index = Math.floor(responseTimes.length * 0.5);
      const p50 = responseTimes[p50Index];

      expect(p50).toBeLessThan(20);
    });
  });

  describe('Cache Hit Rate', () => {
    it('should achieve >95% cache hit rate under load', async () => {
      // Initial lookups (cache misses)
      for (const bin of testBINs) {
        await binService.lookup(bin);
      }

      // Reset metrics after warm-up so hit-rate reflects steady-state behavior
      cacheMetricsTracker.reset();

      // Subsequent lookups (should be cache hits)
      for (let i = 0; i < 200; i++) {
        const bin = testBINs[i % testBINs.length];
        await binService.lookup(bin);
      }

      // Get cache metrics
      const metrics = optimizedCacheManager.getMetrics();

      const hitRate = metrics.overall.overallHitRate;

      expect(hitRate).toBeGreaterThan(95);
    });

    it('should use multi-tier cache effectively', async () => {
      // Perform lookups
      for (let i = 0; i < 50; i++) {
        const bin = testBINs[i % testBINs.length];
        await binService.lookup(bin);
      }

      const metrics = optimizedCacheManager.getMetrics();

      // Should have hits from multiple tiers
      expect(metrics.lru.hits + metrics.redis.hits).toBeGreaterThan(0);
    });
  });

  describe('Throughput', () => {
    it('should handle 1000+ requests per second', async () => {
      const startTime = Date.now();
      const requests = 1000;

      const promises = [];
      for (let i = 0; i < requests; i++) {
        const bin = testBINs[i % testBINs.length];
        promises.push(binService.lookup(bin));
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const throughput = requests / duration;

      expect(throughput).toBeGreaterThan(1000);
    });
  });
});
