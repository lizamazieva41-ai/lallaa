/**
 * ETL Performance Tests
 * Test large dataset processing and measure processing time
 */

import { describe, it, expect } from '@jest/globals';
import * as extractModule from '../../scripts/etl/extract';
import * as normalizeModule from '../../scripts/etl/normalize';
import * as mergeModule from '../../scripts/etl/merge';
import fs from 'fs';
import path from 'path';

describe('ETL Performance Tests', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/etl');

  describe('Extract Performance', () => {
    it('should extract 10,000 records in < 10 seconds', async () => {
      // Create large test dataset
      const largeData: Record<string, any> = {};
      for (let i = 0; i < 10000; i++) {
        largeData[`40000${i.toString().padStart(4, '0')}`] = {
          length: 16,
          luhn: true,
          scheme: 'visa',
          type: 'debit',
          bank: { name: `Test Bank ${i}` },
          country: { alpha2: 'US', name: 'United States' },
        };
      }

      const largeJsonPath = path.join(fixturesDir, 'large-extract-test.json');
      fs.writeFileSync(largeJsonPath, JSON.stringify(largeData));

      const startTime = Date.now();
      const result = await extractModule.extractFromJSON(
        largeJsonPath,
        'test-source',
        '1.0.0'
      );
      const endTime = Date.now();

      const duration = endTime - startTime;

      expect(result.records.length).toBe(10000);
      expect(duration).toBeLessThan(10000); // < 10 seconds

      // Cleanup
      fs.unlinkSync(largeJsonPath);
    });
  });

  describe('Normalize Performance', () => {
    it('should normalize 10,000 records in < 5 seconds', () => {
      const records: extractModule.SourceRecord[] = [];
      for (let i = 0; i < 10000; i++) {
        records.push({
          bin: `40000${i.toString().padStart(4, '0')}`,
          country: 'United States',
          countryCode: 'US',
          issuer: `Test Bank ${i}`,
          scheme: 'visa',
          type: 'debit',
          raw: {},
        });
      }

      const startTime = Date.now();
      const result = normalizeModule.normalizeCountry(records);
      const endTime = Date.now();

      const duration = endTime - startTime;

      expect(result.normalizedRecords.length).toBe(10000);
      expect(duration).toBeLessThan(5000); // < 5 seconds
    });
  });

  describe('Merge Performance', () => {
    it('should merge 10,000 records from multiple sources in < 15 seconds', async () => {
      const records1: normalizeModule.NormalizedRecord[] = [];
      const records2: normalizeModule.NormalizedRecord[] = [];

      for (let i = 0; i < 10000; i++) {
        const bin = `40000${i.toString().padStart(4, '0')}`;
        records1.push({
          bin,
          normalizedCountryCode: 'US',
          normalizedCountry: 'United States',
          normalizedIssuer: `BANK A ${i}`,
          normalizedScheme: 'visa',
          normalizedBrand: 'Visa',
          normalizedType: 'debit',
          confidence: 0.9,
          raw: {},
        });

        records2.push({
          bin,
          normalizedCountryCode: 'US',
          normalizedCountry: 'United States',
          normalizedIssuer: `BANK B ${i}`,
          normalizedScheme: 'visa',
          normalizedBrand: 'Visa',
          normalizedType: 'debit',
          confidence: 0.85,
          raw: {},
        });
      }

      const startTime = Date.now();
      const result = await mergeModule.mergeRecords([
        {
          info: {
            name: 'source1',
            version: '1.0.0',
            format: 'json',
            priority: 1,
          },
          records: records1,
        },
        {
          info: {
            name: 'source2',
            version: '1.0.0',
            format: 'json',
            priority: 2,
          },
          records: records2,
        },
      ]);
      const endTime = Date.now();

      const duration = endTime - startTime;

      expect(result.merged.length).toBe(10000);
      expect(duration).toBeLessThan(15000); // < 15 seconds
    });
  });

  describe('Memory Usage', () => {
    it('should process large datasets without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process 50,000 records
      const records: extractModule.SourceRecord[] = [];
      for (let i = 0; i < 50000; i++) {
        records.push({
          bin: `40000${i.toString().padStart(5, '0')}`,
          country: 'United States',
          countryCode: 'US',
          issuer: `Test Bank ${i}`,
          scheme: 'visa',
          type: 'debit',
          raw: {},
        });
      }

      const normalizeResult = normalizeModule.normalizeCountry(records);
      const mergeResult = await mergeModule.mergeRecords([
        {
          info: {
            name: 'test-source',
            version: '1.0.0',
            format: 'json',
            priority: 1,
          },
          records: normalizeResult.normalizedRecords,
        },
      ]);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 500MB for 50k records)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
      expect(mergeResult.merged.length).toBe(50000);
    });
  });
});
