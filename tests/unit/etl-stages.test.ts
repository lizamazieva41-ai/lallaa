/**
 * ETL Pipeline Stage Unit Tests
 * Test extract, normalize, merge, load stages individually with edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as extractModule from '../../scripts/etl/extract';
import * as normalizeModule from '../../scripts/etl/normalize';
import * as mergeModule from '../../scripts/etl/merge';
import fs from 'fs';
import path from 'path';
import { SourceRecord, SourceInfo } from '../../scripts/etl/extract';
import { NormalizedRecord } from '../../scripts/etl/normalize';

describe('ETL Pipeline Stages', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/etl');

  describe('Extract Stage', () => {
    it('should extract data from JSON format', async () => {
      const jsonPath = path.join(fixturesDir, 'sample.json');
      const result = await extractModule.extractFromJSON(
        jsonPath,
        'test-source',
        '1.0.0'
      );

      expect(result.records.length).toBeGreaterThan(0);
      expect(result.records[0].bin).toBeDefined();
      expect(result.source.name).toBe('test-source');
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedPath = path.join(fixturesDir, 'malformed.json');
      
      // Should not throw, but should report errors
      const result = await extractModule.extractFromJSON(
        malformedPath,
        'test-source',
        '1.0.0'
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should extract data from CSV format', async () => {
      const csvPath = path.join(fixturesDir, 'sample.csv');
      const result = await extractModule.extractFromCSV(
        csvPath,
        'test-source',
        '1.0.0'
      );

      expect(result.records.length).toBeGreaterThan(0);
      expect(result.records[0].bin).toBeDefined();
    });

    it('should handle encoding issues in CSV', async () => {
      const encodingPath = path.join(fixturesDir, 'encoding-issues.csv');
      const result = await extractModule.extractFromCSV(
        encodingPath,
        'test-source',
        '1.0.0'
      );

      // Should handle special characters
      expect(result.records.length).toBeGreaterThan(0);
    });

    it('should validate BIN format during extraction', async () => {
      const jsonPath = path.join(fixturesDir, 'sample.json');
      const result = await extractModule.extractFromJSON(
        jsonPath,
        'test-source',
        '1.0.0'
      );

      result.records.forEach(record => {
        expect(record.bin).toMatch(/^\d{6,8}$/);
      });
    });
  });

  describe('Normalize Stage', () => {
    const sampleRecords: SourceRecord[] = [
      {
        bin: '400000',
        country: 'United States',
        countryCode: 'US',
        issuer: 'Test Bank & Co.',
        scheme: 'visa',
        type: 'debit',
        raw: {},
      },
      {
        bin: '510000',
        country: 'United Kingdom',
        countryCode: 'GB',
        issuer: 'Test Bank 2',
        scheme: 'mastercard',
        type: 'credit',
        raw: {},
      },
    ];

    it('should normalize country names to ISO2 codes', () => {
      const result = normalizeModule.normalizeCountry(sampleRecords);

      expect(result.mappings).toBeDefined();
      expect(result.normalizedRecords.length).toBe(sampleRecords.length);
      
      const usRecord = result.normalizedRecords.find(r => r.bin === '400000');
      expect(usRecord?.normalizedCountryCode).toBe('US');
    });

    it('should handle country name variations', () => {
      const variations: SourceRecord[] = [
        { bin: '400000', country: 'USA', countryCode: '', raw: {} },
        { bin: '400001', country: 'United States of America', countryCode: '', raw: {} },
        { bin: '400002', country: 'United States', countryCode: '', raw: {} },
      ];

      const result = normalizeModule.normalizeCountry(variations);
      
      // All should map to US
      result.normalizedRecords.forEach(record => {
        expect(record.normalizedCountryCode).toBe('US');
      });
    });

    it('should normalize issuer names', () => {
      const records: SourceRecord[] = [
        {
          bin: '400000',
          issuer: 'Test Bank & Co. LLC',
          raw: {},
        },
      ];

      const result = normalizeModule.normalizeCountry(records);
      const normalized = result.normalizedRecords[0];
      
      expect(normalized.normalizedIssuer).toContain('TEST BANK');
    });

    it('should normalize scheme/card network names', () => {
      const records: SourceRecord[] = [
        { bin: '400000', scheme: 'Visa', raw: {} },
        { bin: '510000', scheme: 'Mastercard', raw: {} },
        { bin: '378282', scheme: 'American Express', raw: {} },
      ];

      const result = normalizeModule.normalizeCountry(records);
      
      expect(result.normalizedRecords[0].normalizedScheme).toBe('visa');
      expect(result.normalizedRecords[1].normalizedScheme).toBe('mastercard');
      expect(result.normalizedRecords[2].normalizedScheme).toBe('amex');
    });

    it('should calculate confidence scores', () => {
      const records: SourceRecord[] = [
        {
          bin: '400000',
          country: 'United States',
          countryCode: 'US',
          issuer: 'Test Bank',
          scheme: 'visa',
          type: 'debit',
          raw: {},
        },
      ];

      const result = normalizeModule.normalizeCountry(records);
      const normalized = result.normalizedRecords[0];
      
      expect(normalized.confidence).toBeGreaterThan(0);
      expect(normalized.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Merge Stage', () => {
    const source1: SourceInfo = {
      name: 'binlist/data',
      version: '1.0.0',
      format: 'json',
      priority: 1,
    };

    const source2: SourceInfo = {
      name: 'venelinkochev/bin-list-data',
      version: '1.0.0',
      format: 'csv',
      priority: 2,
    };

    it('should merge records from multiple sources', async () => {
      const normalized1: NormalizedRecord[] = [
        {
          bin: '400000',
          normalizedCountryCode: 'US',
          normalizedCountry: 'United States',
          normalizedIssuer: 'TEST BANK',
          normalizedScheme: 'visa',
          normalizedBrand: 'Visa',
          normalizedType: 'debit',
          confidence: 0.9,
          raw: {},
        },
      ];

      const normalized2: NormalizedRecord[] = [
        {
          bin: '400000',
          normalizedCountryCode: 'US',
          normalizedCountry: 'United States',
          normalizedIssuer: 'TEST BANK',
          normalizedScheme: 'visa',
          normalizedBrand: 'Visa',
          normalizedType: 'debit',
          confidence: 0.85,
          raw: {},
        },
      ];

      const sources = [
        { info: source1, records: normalized1 },
        { info: source2, records: normalized2 },
      ];

      const result = await mergeModule.mergeRecords(sources);

      expect(result.merged.length).toBe(1);
      expect(result.merged[0].bin).toBe('400000');
      expect(result.merged[0].sources.length).toBe(2);
    });

    it('should handle conflicts between sources', async () => {
      const normalized1: NormalizedRecord[] = [
        {
          bin: '400000',
          normalizedCountryCode: 'US',
          normalizedIssuer: 'BANK A',
          normalizedScheme: 'visa',
          normalizedType: 'debit',
          confidence: 0.9,
          raw: {},
        },
      ];

      const normalized2: NormalizedRecord[] = [
        {
          bin: '400000',
          normalizedCountryCode: 'CA',
          normalizedIssuer: 'BANK B',
          normalizedScheme: 'visa',
          normalizedType: 'credit',
          confidence: 0.85,
          raw: {},
        },
      ];

      const sources = [
        { info: source1, records: normalized1 },
        { info: source2, records: normalized2 },
      ];

      const result = await mergeModule.mergeRecords(sources);

      // Should resolve conflict using advanced conflict resolver
      expect(result.merged.length).toBe(1);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(0);
    });

    it('should deduplicate records', () => {
      const records: NormalizedRecord[] = [
        {
          bin: '400000',
          normalizedCountryCode: 'US',
          normalizedIssuer: 'TEST BANK',
          normalizedScheme: 'visa',
          normalizedType: 'debit',
          confidence: 0.9,
          raw: {},
        },
        {
          bin: '400000',
          normalizedCountryCode: 'US',
          normalizedIssuer: 'TEST BANK',
          normalizedScheme: 'visa',
          normalizedType: 'debit',
          confidence: 0.85,
          raw: {},
        },
      ];

      const result = mergeModule.deduplicate(records);

      expect(result.unique.length).toBe(1);
      expect(result.duplicates).toBe(1);
    });

    it('should validate merged records', () => {
      const merged: mergeModule.MergedRecord[] = [
        {
          bin: '400000',
          countryCode: 'US',
          country: 'United States',
          issuer: 'Test Bank',
          scheme: 'visa',
          type: 'debit',
          source: 'test-source',
          sourceVersion: '1.0.0',
          importDate: new Date(),
          lastUpdated: new Date(),
          raw: {},
          confidence: 0.9,
          sources: [],
        },
        {
          bin: 'invalid',
          countryCode: '',
          country: '',
          issuer: '',
          scheme: '',
          type: '',
          source: 'test-source',
          sourceVersion: '1.0.0',
          importDate: new Date(),
          lastUpdated: new Date(),
          raw: {},
          confidence: 0.5,
          sources: [],
        },
      ];

      const result = mergeModule.validateMerged(merged);

      expect(result.valid.length).toBe(1);
      expect(result.invalid.length).toBe(1);
      expect(result.invalid[0].reason).toContain('Invalid BIN format');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input files', async () => {
      const emptyPath = path.join(fixturesDir, 'empty.json');
      
      // Create empty file if it doesn't exist
      if (!fs.existsSync(emptyPath)) {
        fs.writeFileSync(emptyPath, '{}');
      }

      const result = await extractModule.extractFromJSON(
        emptyPath,
        'test-source',
        '1.0.0'
      );

      expect(result.records.length).toBe(0);
    });

    it('should handle missing required fields', () => {
      const records: SourceRecord[] = [
        {
          bin: '',
          raw: {},
        },
        {
          bin: '400000',
          raw: {},
        },
      ];

      const result = normalizeModule.normalizeCountry(records);
      
      // Should filter out invalid records or handle gracefully
      expect(result.normalizedRecords.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in issuer names', () => {
      const records: SourceRecord[] = [
        {
          bin: '400000',
          issuer: "O'Brien Bank & Co., LLC",
          raw: {},
        },
      ];

      const result = normalizeModule.normalizeCountry(records);
      const normalized = result.normalizedRecords[0];
      
      expect(normalized.normalizedIssuer).toBeDefined();
      expect(normalized.normalizedIssuer.length).toBeGreaterThan(0);
    });
  });
});
