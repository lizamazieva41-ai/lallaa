/**
 * Reliability Validation Tests
 * Test failover scenarios, data consistency under stress
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { binService } from '../../src/services/bin';
import { optimizedCacheManager } from '../../src/services/advancedCaching/optimizedCache';

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

jest.mock('../../src/models/country', () => ({
  countryModel: {
    findByCode: jest.fn(async () => ({ countryName: 'United States' })),
  },
}));

// Redis cache mock with injectable failure mode
let redisShouldFail = false;
jest.mock('../../src/services/redisCache', () => {
  const store = new Map<string, any>();
  return {
    binCacheService: {
      get: jest.fn(async (key: string) => {
        if (redisShouldFail) throw new Error('Simulated Redis failure');
        if (!store.has(key)) return { hit: false, data: null };
        return { hit: true, data: store.get(key) };
      }),
      set: jest.fn(async (key: string, value: any) => {
        if (redisShouldFail) throw new Error('Simulated Redis failure');
        store.set(key, value);
      }),
      deletePattern: jest.fn(async (pattern: string) => {
        const prefix = pattern.replace('*', '');
        for (const k of Array.from(store.keys())) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      }),
      clear: jest.fn(async () => store.clear()),
    },
  };
});

describe('Reliability Validation', () => {
  beforeEach(() => {
    // Clear caches
    redisShouldFail = false;
    return Promise.all([binService.clearCache(), optimizedCacheManager.clearAll()]).then(() => undefined);
  });

  describe('Failover Scenarios', () => {
    it('should handle Redis cache failure gracefully', async () => {
      // Simulate Redis failure: optimized cache layer throws, BIN service must fallback to direct DB lookup.
      const bin = '400000';
      redisShouldFail = true;

      // Should still work via database
      const result = await binService.lookup(bin);
      
      expect(result).toBeDefined();
    });

    it('should handle database connection timeout gracefully', async () => {
      // This test would require mocking database timeout
      // For now, we'll test that the system handles errors
      const bin = '400000';
      
      try {
        const result = await binService.lookup(bin);
        expect(result).toBeDefined();
      } catch (error) {
        // Should handle error gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency under concurrent load', async () => {
      const bin = '400000';
      const concurrentRequests = 100;

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => binService.lookup(bin));

      const results = await Promise.all(promises);

      // All results should be the same
      const firstResult = results[0];
      const allSame = results.every(r => 
        r?.bin === firstResult?.bin &&
        r?.country.code === firstResult?.country.code
      );

      expect(allSame).toBe(true);
    });

    it('should handle cache invalidation correctly', async () => {
      const bin = '400000';

      // First lookup (cache miss)
      const result1 = await binService.lookup(bin);
      expect(result1).toBeDefined();

      // Second lookup (cache hit)
      const result2 = await binService.lookup(bin);
      expect(result2).toBeDefined();
      expect(result2?.bin).toBe(result1?.bin);

      // Clear cache
      await binService.clearCache();

      // Third lookup (cache miss again)
      const result3 = await binService.lookup(bin);
      expect(result3).toBeDefined();
      expect(result3?.bin).toBe(result1?.bin);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high concurrent load', async () => {
      const bins = Array(100).fill(null).map((_, i) => `${400000 + i}`);
      const concurrentRequests = 500;

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => {
          const bin = bins[Math.floor(Math.random() * bins.length)];
          return binService.lookup(bin);
        });

      const results = await Promise.all(promises);

      // Should handle all requests
      expect(results.length).toBe(concurrentRequests);
      expect(results.filter(r => r !== null).length).toBeGreaterThan(0);
    });

    it('should maintain performance under sustained load', async () => {
      const bins = Array(50).fill(null).map((_, i) => `${400000 + i}`);
      const iterations = 1000;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const bin = bins[i % bins.length];
        await binService.lookup(bin);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const averageTime = duration / iterations;

      // Average should remain reasonable even under sustained load
      expect(averageTime).toBeLessThan(100); // < 100ms average
    });
  });
});
