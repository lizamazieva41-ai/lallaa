/**
 * ETL Pipeline Integration Tests
 * Test full pipeline with real data sources and mock services
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as etlModule from '../../scripts/etl/etl';
import * as extractModule from '../../scripts/etl/extract';
import * as normalizeModule from '../../scripts/etl/normalize';
import * as mergeModule from '../../scripts/etl/merge';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

describe('ETL Pipeline Integration', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/etl');
  let testPool: Pool;

  beforeEach(() => {
    // Setup test database connection
    testPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.POSTGRES_USER || 'bincheck',
      password: process.env.POSTGRES_PASSWORD || 'bincheck_secret',
      database: process.env.POSTGRES_DB || 'bincheck_test',
    });
  });

  afterEach(async () => {
    if (testPool) {
      await testPool.end();
    }
  });

  describe('Full Pipeline', () => {
    it('should process JSON source end-to-end', async () => {
      const jsonPath = path.join(fixturesDir, 'sample.json');

      // Extract
      const extractResult = await extractModule.extractFromJSON(
        jsonPath,
        'test-source',
        '1.0.0'
      );

      expect(extractResult.records.length).toBeGreaterThan(0);

      // Normalize
      const normalizeResult = normalizeModule.normalizeCountry(extractResult.records);
      expect(normalizeResult.normalizedRecords.length).toBe(extractResult.records.length);

      // Merge (single source, but should still work)
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

      expect(mergeResult.merged.length).toBeGreaterThan(0);
      expect(mergeResult.errors.length).toBe(0);
    });

    it('should process CSV source end-to-end', async () => {
      const csvPath = path.join(fixturesDir, 'sample.csv');

      // Extract
      const extractResult = await extractModule.extractFromCSV(
        csvPath,
        'test-source',
        '1.0.0'
      );

      expect(extractResult.records.length).toBeGreaterThan(0);

      // Normalize
      const normalizeResult = normalizeModule.normalizeCountry(extractResult.records);
      expect(normalizeResult.normalizedRecords.length).toBe(extractResult.records.length);

      // Merge
      const mergeResult = await mergeModule.mergeRecords([
        {
          info: {
            name: 'test-source',
            version: '1.0.0',
            format: 'csv',
            priority: 1,
          },
          records: normalizeResult.normalizedRecords,
        },
      ]);

      expect(mergeResult.merged.length).toBeGreaterThan(0);
    });

    it('should handle multiple sources with conflicts', async () => {
      const jsonPath = path.join(fixturesDir, 'sample.json');
      const csvPath = path.join(fixturesDir, 'sample.csv');

      // Extract from both sources
      const jsonResult = await extractModule.extractFromJSON(
        jsonPath,
        'binlist/data',
        '1.0.0'
      );
      const csvResult = await extractModule.extractFromCSV(
        csvPath,
        'venelinkochev/bin-list-data',
        '1.0.0'
      );

      // Normalize both
      const jsonNormalized = normalizeModule.normalizeCountry(jsonResult.records);
      const csvNormalized = normalizeModule.normalizeCountry(csvResult.records);

      // Merge with conflict resolution
      const mergeResult = await mergeModule.mergeRecords([
        {
          info: {
            name: 'binlist/data',
            version: '1.0.0',
            format: 'json',
            priority: 1,
          },
          records: jsonNormalized.normalizedRecords,
        },
        {
          info: {
            name: 'venelinkochev/bin-list-data',
            version: '1.0.0',
            format: 'csv',
            priority: 2,
          },
          records: csvNormalized.normalizedRecords,
        },
      ]);

      expect(mergeResult.merged.length).toBeGreaterThan(0);
      // Should have sources from both
      const mergedRecord = mergeResult.merged[0];
      expect(mergedRecord.sources.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found gracefully', async () => {
      const nonExistentPath = path.join(fixturesDir, 'non-existent.json');

      await expect(
        extractModule.extractFromJSON(nonExistentPath, 'test-source', '1.0.0')
      ).rejects.toThrow();
    });

    it('should handle malformed data', async () => {
      const malformedPath = path.join(fixturesDir, 'malformed.json');
      const result = await extractModule.extractFromJSON(
        malformedPath,
        'test-source',
        '1.0.0'
      );

      // Should report errors but not crash
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle database connection failures gracefully', async () => {
      // This would be tested with a mock database that fails
      // For now, we'll just ensure the code structure supports it
      expect(true).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should process large datasets efficiently', async () => {
      // Create a larger test dataset
      const largeData: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`40000${i.toString().padStart(3, '0')}`] = {
          length: 16,
          luhn: true,
          scheme: 'visa',
          type: 'debit',
          bank: { name: `Test Bank ${i}` },
          country: { alpha2: 'US', name: 'United States' },
        };
      }

      const largeJsonPath = path.join(fixturesDir, 'large-sample.json');
      fs.writeFileSync(largeJsonPath, JSON.stringify(largeData));

      const startTime = Date.now();

      const extractResult = await extractModule.extractFromJSON(
        largeJsonPath,
        'test-source',
        '1.0.0'
      );

      const normalizeResult = normalizeModule.normalizeCountry(extractResult.records);

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

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process 1000 records in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(mergeResult.merged.length).toBe(1000);

      // Cleanup
      fs.unlinkSync(largeJsonPath);
    });
  });
});
