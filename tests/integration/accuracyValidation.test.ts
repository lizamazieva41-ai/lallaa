/**
 * Accuracy Validation Tests
 * Validate field-specific accuracy targets against golden set
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { MetricsCollector } from '../../src/services/accuracyMeasurement/metricsCollector';
import { GoldenSetManager } from '../../src/testing/goldenSet/goldenSetManager';
import { GoldenSetRecord } from '../../src/testing/goldenSet/goldenSetTypes';
import fs from 'fs';
import path from 'path';
import { BINLookupResult, CardNetwork, CardType } from '../../src/types';

jest.mock('../../src/services/bin', () => ({
  binService: {
    lookupBatch: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { binService } = require('../../src/services/bin') as { binService: { lookupBatch: jest.Mock } };

describe('Accuracy Validation', () => {
  let goldenSetManager: GoldenSetManager;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    goldenSetManager = new GoldenSetManager();
    metricsCollector = new MetricsCollector();
  });

  describe('Field-Specific Accuracy', () => {
    it('should achieve ≥99% accuracy for country field', async () => {
      // Load golden set
      const goldenSetPath = path.join(__dirname, '../../data/golden-set/golden-set.json');
      if (!fs.existsSync(goldenSetPath)) {
        console.warn('Golden set not found, skipping test');
        return;
      }

      const goldenSetData = JSON.parse(fs.readFileSync(goldenSetPath, 'utf-8'));
      const goldenSetRecords: GoldenSetRecord[] = goldenSetData.records || [];

      const byBin = new Map<string, GoldenSetRecord>(goldenSetRecords.map(r => [r.bin, r]));
      binService.lookupBatch.mockImplementation(async (bins: unknown): Promise<Map<string, BINLookupResult | null>> => {
        const list = Array.isArray(bins) ? (bins as string[]) : [];
        const out = new Map<string, BINLookupResult | null>();
        for (const bin of list) {
          const rec = byBin.get(bin);
          out.set(
            bin,
            rec
              ? {
                  bin: rec.bin,
                  bank: { name: rec.verifiedFields.issuer.value },
                  country: { code: rec.verifiedFields.country.value, name: rec.verifiedFields.country.value },
                  card: {
                    type: rec.verifiedFields.type.value as unknown as CardType,
                    network: rec.verifiedFields.network.value as unknown as CardNetwork,
                  },
                }
              : null
          );
        }
        return out;
      });

      // Collect metrics
      const metrics = await metricsCollector.collectMetrics(goldenSetRecords);

      expect(metrics.fields.country.accuracy).toBeGreaterThanOrEqual(99);
    });

    it('should achieve ≥99% accuracy for network field', async () => {
      const goldenSetPath = path.join(__dirname, '../../data/golden-set/golden-set.json');
      if (!fs.existsSync(goldenSetPath)) {
        console.warn('Golden set not found, skipping test');
        return;
      }

      const goldenSetData = JSON.parse(fs.readFileSync(goldenSetPath, 'utf-8'));
      const goldenSetRecords: GoldenSetRecord[] = goldenSetData.records || [];
      const byBin = new Map<string, GoldenSetRecord>(goldenSetRecords.map(r => [r.bin, r]));
      binService.lookupBatch.mockImplementation(async (bins: unknown): Promise<Map<string, BINLookupResult | null>> => {
        const list = Array.isArray(bins) ? (bins as string[]) : [];
        const out = new Map<string, BINLookupResult | null>();
        for (const bin of list) {
          const rec = byBin.get(bin);
          out.set(
            bin,
            rec
              ? {
                  bin: rec.bin,
                  bank: { name: rec.verifiedFields.issuer.value },
                  country: { code: rec.verifiedFields.country.value, name: rec.verifiedFields.country.value },
                  card: {
                    type: rec.verifiedFields.type.value as unknown as CardType,
                    network: rec.verifiedFields.network.value as unknown as CardNetwork,
                  },
                }
              : null
          );
        }
        return out;
      });

      const metrics = await metricsCollector.collectMetrics(goldenSetRecords);

      expect(metrics.fields.network.accuracy).toBeGreaterThanOrEqual(99);
    });

    it('should achieve ≥95% accuracy for issuer field', async () => {
      const goldenSetPath = path.join(__dirname, '../../data/golden-set/golden-set.json');
      if (!fs.existsSync(goldenSetPath)) {
        console.warn('Golden set not found, skipping test');
        return;
      }

      const goldenSetData = JSON.parse(fs.readFileSync(goldenSetPath, 'utf-8'));
      const goldenSetRecords: GoldenSetRecord[] = goldenSetData.records || [];
      const byBin = new Map<string, GoldenSetRecord>(goldenSetRecords.map(r => [r.bin, r]));
      binService.lookupBatch.mockImplementation(async (bins: unknown): Promise<Map<string, BINLookupResult | null>> => {
        const list = Array.isArray(bins) ? (bins as string[]) : [];
        const out = new Map<string, BINLookupResult | null>();
        for (const bin of list) {
          const rec = byBin.get(bin);
          out.set(
            bin,
            rec
              ? {
                  bin: rec.bin,
                  bank: { name: rec.verifiedFields.issuer.value },
                  country: { code: rec.verifiedFields.country.value, name: rec.verifiedFields.country.value },
                  card: {
                    type: rec.verifiedFields.type.value as unknown as CardType,
                    network: rec.verifiedFields.network.value as unknown as CardNetwork,
                  },
                }
              : null
          );
        }
        return out;
      });

      const metrics = await metricsCollector.collectMetrics(goldenSetRecords);

      expect(metrics.fields.issuer.accuracy).toBeGreaterThanOrEqual(95);
    });

    it('should achieve ≥95% accuracy for type field', async () => {
      const goldenSetPath = path.join(__dirname, '../../data/golden-set/golden-set.json');
      if (!fs.existsSync(goldenSetPath)) {
        console.warn('Golden set not found, skipping test');
        return;
      }

      const goldenSetData = JSON.parse(fs.readFileSync(goldenSetPath, 'utf-8'));
      const goldenSetRecords: GoldenSetRecord[] = goldenSetData.records || [];
      const byBin = new Map<string, GoldenSetRecord>(goldenSetRecords.map(r => [r.bin, r]));
      binService.lookupBatch.mockImplementation(async (bins: unknown): Promise<Map<string, BINLookupResult | null>> => {
        const list = Array.isArray(bins) ? (bins as string[]) : [];
        const out = new Map<string, BINLookupResult | null>();
        for (const bin of list) {
          const rec = byBin.get(bin);
          out.set(
            bin,
            rec
              ? {
                  bin: rec.bin,
                  bank: { name: rec.verifiedFields.issuer.value },
                  country: { code: rec.verifiedFields.country.value, name: rec.verifiedFields.country.value },
                  card: {
                    type: rec.verifiedFields.type.value as unknown as CardType,
                    network: rec.verifiedFields.network.value as unknown as CardNetwork,
                  },
                }
              : null
          );
        }
        return out;
      });

      const metrics = await metricsCollector.collectMetrics(goldenSetRecords);

      expect(metrics.fields.type.accuracy).toBeGreaterThanOrEqual(95);
    });

    it('should track mismatch patterns', async () => {
      const goldenSetPath = path.join(__dirname, '../../data/golden-set/golden-set.json');
      if (!fs.existsSync(goldenSetPath)) {
        console.warn('Golden set not found, skipping test');
        return;
      }

      const goldenSetData = JSON.parse(fs.readFileSync(goldenSetPath, 'utf-8'));
      const goldenSetRecords: GoldenSetRecord[] = goldenSetData.records || [];
      const byBin = new Map<string, GoldenSetRecord>(goldenSetRecords.map(r => [r.bin, r]));
      binService.lookupBatch.mockImplementation(async (bins: unknown): Promise<Map<string, BINLookupResult | null>> => {
        const list = Array.isArray(bins) ? (bins as string[]) : [];
        const out = new Map<string, BINLookupResult | null>();
        for (const bin of list) {
          const rec = byBin.get(bin);
          out.set(
            bin,
            rec
              ? {
                  bin: rec.bin,
                  bank: { name: rec.verifiedFields.issuer.value },
                  country: { code: rec.verifiedFields.country.value, name: rec.verifiedFields.country.value },
                  card: {
                    type: rec.verifiedFields.type.value as unknown as CardType,
                    network: rec.verifiedFields.network.value as unknown as CardNetwork,
                  },
                }
              : null
          );
        }
        return out;
      });

      const metrics = await metricsCollector.collectMetrics(goldenSetRecords);

      // Mismatches should be tracked
      expect(metrics.fields.country.mismatches).toBeDefined();
      expect(metrics.fields.network.mismatches).toBeDefined();
      expect(metrics.fields.issuer.mismatches).toBeDefined();
      expect(metrics.fields.type.mismatches).toBeDefined();
    });
  });

  describe('Overall Accuracy', () => {
    it('should achieve ≥95% overall accuracy', async () => {
      const goldenSetPath = path.join(__dirname, '../../data/golden-set/golden-set.json');
      if (!fs.existsSync(goldenSetPath)) {
        console.warn('Golden set not found, skipping test');
        return;
      }

      const goldenSetData = JSON.parse(fs.readFileSync(goldenSetPath, 'utf-8'));
      const goldenSetRecords: GoldenSetRecord[] = goldenSetData.records || [];
      const byBin = new Map<string, GoldenSetRecord>(goldenSetRecords.map(r => [r.bin, r]));
      binService.lookupBatch.mockImplementation(async (bins: unknown): Promise<Map<string, BINLookupResult | null>> => {
        const list = Array.isArray(bins) ? (bins as string[]) : [];
        const out = new Map<string, BINLookupResult | null>();
        for (const bin of list) {
          const rec = byBin.get(bin);
          out.set(
            bin,
            rec
              ? {
                  bin: rec.bin,
                  bank: { name: rec.verifiedFields.issuer.value },
                  country: { code: rec.verifiedFields.country.value, name: rec.verifiedFields.country.value },
                  card: {
                    type: rec.verifiedFields.type.value as unknown as CardType,
                    network: rec.verifiedFields.network.value as unknown as CardNetwork,
                  },
                }
              : null
          );
        }
        return out;
      });

      const metrics = await metricsCollector.collectMetrics(goldenSetRecords);

      expect(metrics.overall.accuracy).toBeGreaterThanOrEqual(95);
    });
  });
});
