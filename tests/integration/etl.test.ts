/**
 * ETL Integration Tests
 * End-to-end tests for ETL pipeline
 * 
 * TODO: Update tests to match new ETL API signatures
 */

import path from 'path';
import fs from 'fs';
import { extractFromJSON, extractFromCSV } from '../../scripts/etl/extract';
import { normalizeBatch } from '../../scripts/etl/normalize';
import { mergeRecords, validateMerged } from '../../scripts/etl/merge';
import { loadRecords } from '../../scripts/etl/load';
import database from '../../src/database/connection';
import { logger } from '../../src/utils/logger';

// ETL Integration Tests
describe('ETL Integration Pipeline', () => {

// Test fixtures directory
const TEST_FIXTURES_DIR = path.join(__dirname, '../fixtures/etl');
  const testSource = 'test/integration';
  const testVersion = '1.0.0-test';

    beforeAll(async () => {
    // Connect to test database
    await database.connect();
    logger.info('Connected to test database for ETL integration tests');
    
    // Ensure test countries have required data
    await database.query(`
      UPDATE countries 
      SET currency_name = COALESCE(currency_name, 'Unknown Currency'),
          currency_code = COALESCE(currency_code, 'XX')
      WHERE currency_name IS NULL OR currency_code IS NULL
    `);

    // Ensure tables exist
    try {
      await database.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

      await database.query(`
        CREATE TABLE IF NOT EXISTS bins (
          bin VARCHAR(8) PRIMARY KEY,
          bank_name VARCHAR(255) NOT NULL,
          bank_name_local VARCHAR(255),
          country_code CHAR(2) NOT NULL,
          country_name VARCHAR(100) NOT NULL,
          card_type VARCHAR(50) NOT NULL,
          card_network VARCHAR(50) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          length INTEGER,
          luhn BOOLEAN,
          scheme VARCHAR(50),
          brand VARCHAR(100),
          issuer VARCHAR(255),
          country VARCHAR(100),
          url VARCHAR(255),
          phone VARCHAR(50),
          city VARCHAR(100),
          bank_code VARCHAR(50),
          branch_code VARCHAR(50),
          program_type VARCHAR(100),
          regulatory_type VARCHAR(100),
          bin_range_start VARCHAR(8),
          bin_range_end VARCHAR(8),
          source VARCHAR(255),
          source_version VARCHAR(255),
          import_date TIMESTAMP,
          last_updated TIMESTAMP,
          raw JSONB,
          confidence_score DECIMAL(3,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await database.query(`
        ALTER TABLE bins
          ADD COLUMN IF NOT EXISTS length INTEGER,
          ADD COLUMN IF NOT EXISTS luhn BOOLEAN,
          ADD COLUMN IF NOT EXISTS scheme VARCHAR(50),
          ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
          ADD COLUMN IF NOT EXISTS issuer VARCHAR(255),
          ADD COLUMN IF NOT EXISTS country VARCHAR(100),
          ADD COLUMN IF NOT EXISTS country_code CHAR(2),
          ADD COLUMN IF NOT EXISTS country_name VARCHAR(100),
          ADD COLUMN IF NOT EXISTS url VARCHAR(255),
          ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
          ADD COLUMN IF NOT EXISTS city VARCHAR(100),
          ADD COLUMN IF NOT EXISTS bank_code VARCHAR(50),
          ADD COLUMN IF NOT EXISTS branch_code VARCHAR(50),
          ADD COLUMN IF NOT EXISTS program_type VARCHAR(100),
          ADD COLUMN IF NOT EXISTS regulatory_type VARCHAR(100),
          ADD COLUMN IF NOT EXISTS bin_range_start VARCHAR(8),
          ADD COLUMN IF NOT EXISTS bin_range_end VARCHAR(8),
          ADD COLUMN IF NOT EXISTS source VARCHAR(255),
          ADD COLUMN IF NOT EXISTS source_version VARCHAR(255),
          ADD COLUMN IF NOT EXISTS import_date TIMESTAMP,
          ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP,
          ADD COLUMN IF NOT EXISTS raw JSONB,
          ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2),
          ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
          ADD COLUMN IF NOT EXISTS bank_name_local VARCHAR(255),
          ADD COLUMN IF NOT EXISTS card_type VARCHAR(50),
          ADD COLUMN IF NOT EXISTS card_network VARCHAR(50)
      `);

      // Create countries table if not exists
      await database.query(`
        CREATE TABLE IF NOT EXISTS countries (
          country_code CHAR(2) PRIMARY KEY,
          country_name VARCHAR(100) NOT NULL,
          continent VARCHAR(50),
          currency_code CHAR(3),
          currency_name VARCHAR(50),
          iban_length INTEGER,
          bank_code_length INTEGER,
          account_number_length INTEGER,
          example_iban VARCHAR(50),
          iban_regex VARCHAR(255),
          is_sepa BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await database.query(`
        CREATE TABLE IF NOT EXISTS etl_runs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          source VARCHAR(100) NOT NULL,
          source_version VARCHAR(100),
          status VARCHAR(20) NOT NULL,
          records_processed INTEGER DEFAULT 0,
          records_inserted INTEGER DEFAULT 0,
          records_updated INTEGER DEFAULT 0,
          records_failed INTEGER DEFAULT 0,
          error_message TEXT,
          started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Seed test countries
      await database.query(`
        INSERT INTO countries (
          country_code, country_name, continent, currency_code, currency_name,
          iban_length, bank_code_length, account_number_length, example_iban,
          iban_regex, is_sepa
        )
        VALUES ('US', 'United States', 'North America', 'USD', 'US Dollar', 0, 0, 0, '', '', false)
        ON CONFLICT (country_code) DO UPDATE SET
          currency_name = EXCLUDED.currency_name,
          iban_length = EXCLUDED.iban_length,
          bank_code_length = EXCLUDED.bank_code_length,
          account_number_length = EXCLUDED.account_number_length,
          example_iban = EXCLUDED.example_iban,
          iban_regex = EXCLUDED.iban_regex
      `);

      await database.query(`
        INSERT INTO countries (
          country_code, country_name, continent, currency_code, currency_name,
          iban_length, bank_code_length, account_number_length, example_iban,
          iban_regex, is_sepa
        )
        VALUES ('CA', 'Canada', 'North America', 'CAD', 'Canadian Dollar', 0, 0, 0, '', '', false)
        ON CONFLICT (country_code) DO UPDATE SET
          currency_name = EXCLUDED.currency_name,
          iban_length = EXCLUDED.iban_length,
          bank_code_length = EXCLUDED.bank_code_length,
          account_number_length = EXCLUDED.account_number_length,
          example_iban = EXCLUDED.example_iban,
          iban_regex = EXCLUDED.iban_regex
      `);

      logger.info('Test database schema initialized');
    } catch (error) {
      logger.error('Failed to initialize test schema', { error });
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await database.query(`DELETE FROM bins WHERE source = $1`, [testSource]);
      await database.query(`DELETE FROM etl_runs WHERE source LIKE $1`, [`${testSource}%`]);
      logger.info('Test data cleaned up');
    } catch (error) {
      logger.warn('Failed to clean up test data', { error });
    }

    // Disconnect
    await database.disconnect();
    logger.info('Disconnected from test database');
  });

  describe('Extract → Normalize → Merge → Load Pipeline', () => {
    it('should extract, normalize, merge, and load BIN data end-to-end', async () => {
      // Step 1: Extract
      const sampleFilePath = path.join(TEST_FIXTURES_DIR, 'sample-feed.json');
      const extractResult = await extractFromJSON(sampleFilePath, testSource, testVersion);

      expect(extractResult.source.name).toBe(testSource);
      expect(extractResult.source.version).toBe(testVersion);
      expect(extractResult.records.length).toBe(3); // 3 BINs in sample feed
      expect(extractResult.errors.length).toBe(0);

      logger.info('Extract step completed', { recordsExtracted: extractResult.records.length });

      // Step 2: Normalize
      const normalizeResult = normalizeBatch(extractResult.records, extractResult.source.priority);
      expect(normalizeResult.records.length).toBe(3);
      expect(normalizeResult.errors.length).toBe(0);

      // Verify normalized data
      const visaRecord = normalizeResult.records.find(r => r.bin === '411111');
      expect(visaRecord).toBeDefined();
      expect(visaRecord?.scheme).toBe('visa');
      expect(visaRecord?.type).toBe('debit');
      expect(visaRecord?.issuer).toBe('Test Bank Integration');
      expect(visaRecord?.countryCode).toBe('US');

      logger.info('Normalize step completed', { recordsNormalized: normalizeResult.records.length });

      // Step 3: Merge (should handle duplicates)
      const mergeResult = mergeRecords([{
        info: extractResult.source,
        records: normalizeResult.records
      }]);
      expect(mergeResult.merged.length).toBe(3);
      expect(mergeResult.duplicates.length).toBe(0);

      logger.info('Merge step completed', {
        recordsMerged: mergeResult.merged.length,
        duplicatesRemoved: mergeResult.duplicates.length
      });

      // Step 4: Load into database
      const loadResult = await loadRecords(database.getPool(), mergeResult.merged, { dryRun: false }); // dryRun = false
      expect(loadResult.inserted).toBeGreaterThanOrEqual(0);
      expect(loadResult.errors.length).toBe(0);

      logger.info('Load step completed', {
        inserted: loadResult.inserted,
        updated: loadResult.updated
      });

      // Verify data was loaded
      const verifyResult = await database.query(
        'SELECT * FROM bins WHERE source = $1 ORDER BY bin',
        [testSource]
      );
      expect(verifyResult.rows.length).toBe(3);

      // Verify provenance fields
      const visaBin = verifyResult.rows.find((r: any) => r.bin === '411111');
      expect(visaBin).toBeDefined();
      if (visaBin) {
        expect(visaBin.source).toBe(testSource);
        expect(visaBin.source_version).toBe(testVersion);
        expect(visaBin.import_date).toBeDefined();
        expect(visaBin.raw).toBeDefined();
        const confidenceScore = Number(visaBin.confidence_score);
        expect(confidenceScore).toBeGreaterThan(0);
        expect(confidenceScore).toBeLessThanOrEqual(1);
      }

      logger.info('Verification completed', { binsFound: verifyResult.rows.length });
    });

    it('should resolve conflicts using source priority', async () => {
      const primaryPath = path.join(TEST_FIXTURES_DIR, 'priority-source-a.json');
      const secondaryPath = path.join(TEST_FIXTURES_DIR, 'priority-source-b.json');

      const primaryExtract = await extractFromJSON(primaryPath, 'binlist/data', 'v1');
      const secondaryExtract = await extractFromJSON(secondaryPath, 'aderyabin/bin_list', 'v1');

      const primaryNormalized = normalizeBatch(
        primaryExtract.records,
        primaryExtract.source.priority
      );
      const secondaryNormalized = normalizeBatch(
        secondaryExtract.records,
        secondaryExtract.source.priority
      );

      const mergeResult = mergeRecords([
        { info: primaryExtract.source, records: primaryNormalized.records },
        { info: secondaryExtract.source, records: secondaryNormalized.records },
      ]);

      expect(mergeResult.merged).toHaveLength(1);
      expect(mergeResult.merged[0].source).toBe('binlist/data');
      expect(mergeResult.merged[0].issuer).toBe('PRIORITY BANK');
    });

    it('should handle idempotent loads (re-running with same data)', async () => {
      // First load
      const sampleFilePath = path.join(TEST_FIXTURES_DIR, 'sample-feed.json');
      const extractResult = await extractFromJSON(sampleFilePath, testSource, testVersion);
      const normalizeResult = normalizeBatch(extractResult.records, extractResult.source.priority);
      const mergeResult = mergeRecords([{
        info: { name: testSource, version: testVersion, format: 'json', priority: 1 },
        records: normalizeResult.records
      }]);

      // First load
      const firstLoad = await loadRecords(database.getPool(), mergeResult.merged, { dryRun: false });
      expect(firstLoad.inserted).toBe(0); // All should be updates since we already loaded
      expect(firstLoad.updated).toBe(3); // All 3 records updated

      // Verify data is still correct after re-load
      const verifyResult = await database.query(
        'SELECT * FROM bins WHERE source = $1 ORDER BY bin',
        [testSource]
      );
      expect(verifyResult.rows.length).toBe(3);

      logger.info('Idempotent load verified', { updated: firstLoad.updated });
    });

    it('should handle invalid BIN formats gracefully', async () => {
      // Create temp file with invalid BINs
      const tempDir = path.join(TEST_FIXTURES_DIR, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, 'invalid-bins.json');
      const invalidData = {
        '12345': { scheme: 'visa' }, // Too short
        'ABCDEF': { scheme: 'mastercard' }, // Invalid chars
        '411111': { scheme: 'visa' } // Valid
      };
      fs.writeFileSync(tempFilePath, JSON.stringify(invalidData));

      // Extract should report errors for invalid BINs
      const extractResult = await extractFromJSON(tempFilePath, testSource + '-invalid', '1.0');
      expect(extractResult.errors.length).toBeGreaterThanOrEqual(2); // 2 invalid BINs
      expect(extractResult.records.length).toBe(1); // Only 1 valid

      // Cleanup
      fs.unlinkSync(tempFilePath);
      fs.rmdirSync(tempDir);

      logger.info('Invalid BIN handling verified', {
        validRecords: extractResult.records.length,
        errors: extractResult.errors.length
      });
    });

    it('should flag records with missing country codes as invalid', async () => {
      const missingCountryPath = path.join(TEST_FIXTURES_DIR, 'missing-country.csv');
      const extractResult = await extractFromCSV(
        missingCountryPath,
        testSource + '-missing-country',
        '1.0'
      );

      const normalizeResult = normalizeBatch(
        extractResult.records,
        extractResult.source.priority
      );
      const mergeResult = mergeRecords([{
        info: extractResult.source,
        records: normalizeResult.records
      }]);
      const validation = validateMerged(mergeResult.merged);

      expect(validation.invalid.length).toBe(1);
      expect(validation.valid.length).toBe(1);

      logger.info('Missing country validation verified', {
        valid: validation.valid.length,
        invalid: validation.invalid.length
      });
    });

    it('should preserve raw data from source', async () => {
      const sampleFilePath = path.join(TEST_FIXTURES_DIR, 'sample-feed.json');
      const extractResult = await extractFromJSON(sampleFilePath, testSource + '-raw', '1.0');
      const normalizeResult = normalizeBatch(extractResult.records, extractResult.source.priority);
      const mergeResult = mergeRecords([{
        info: { name: testSource, version: testVersion, format: 'json', priority: 1 },
        records: normalizeResult.records
      }]);
      const loadResult = await loadRecords(database.getPool(), mergeResult.merged, { dryRun: false });

      // Verify raw data was preserved
      const verifyResult = await database.query(
        'SELECT raw FROM bins WHERE bin = $1 LIMIT 1',
        ['411111']
      );

      expect(verifyResult.rows.length).toBe(1);
      expect(verifyResult.rows[0].raw).toBeDefined();
      expect(verifyResult.rows[0].raw._source_0).toBeDefined();
      expect(verifyResult.rows[0].raw._source_0.bank).toBeDefined();
      expect(verifyResult.rows[0].raw._source_0.bank.name).toBe('Test Bank Integration');

      logger.info('Raw data preservation verified');
    });

    it('should track ETL run ID for provenance', async () => {
      const sampleFilePath = path.join(TEST_FIXTURES_DIR, 'sample-feed.json');
      const extractResult = await extractFromJSON(sampleFilePath, testSource + '-runid', '1.0');
      const normalizeResult = normalizeBatch(extractResult.records, extractResult.source.priority);
      const mergeResult = mergeRecords([{
        info: { name: testSource + '-runid', version: '1.0', format: 'json', priority: 1 },
        records: normalizeResult.records
      }]);
      const loadResult = await loadRecords(database.getPool(), mergeResult.merged, { dryRun: false });

      // Verify ETL run ID was created and used
      expect(loadResult.etlRunId).toBeDefined();
      if (loadResult.etlRunId) {
        expect(loadResult.etlRunId.length).toBe(36); // UUID length
      }

      logger.info('ETL run ID tracking verified', { etlRunId: loadResult.etlRunId });
    });
  });

  describe('Data Quality Validation', () => {
    it('should correctly identify card networks', async () => {
      const sampleFilePath = path.join(TEST_FIXTURES_DIR, 'sample-feed.json');
      const extractResult = await extractFromJSON(sampleFilePath, testSource + '-networks', '1.0');
      const normalizeResult = normalizeBatch(extractResult.records, extractResult.source.priority);

      const visaRecord = normalizeResult.records.find(r => r.bin === '411111');
      const mcRecord = normalizeResult.records.find(r => r.bin === '542523');
      const amexRecord = normalizeResult.records.find(r => r.bin === '378282');

      expect(visaRecord?.scheme).toBe('visa');
      expect(mcRecord?.scheme).toBe('mastercard');
      expect(amexRecord?.scheme).toBe('amex');

      logger.info('Card network identification verified');
    });

    it('should correctly identify card types', async () => {
      const sampleFilePath = path.join(TEST_FIXTURES_DIR, 'sample-feed.json');
      const extractResult = await extractFromJSON(sampleFilePath, testSource + '-types', '1.0');
      const normalizeResult = normalizeBatch(extractResult.records, extractResult.source.priority);

      const debitRecord = normalizeResult.records.find(r => r.bin === '411111');
      const creditRecord = normalizeResult.records.find(r => r.bin === '542523');

      expect(debitRecord?.type).toBe('debit');
      expect(creditRecord?.type).toBe('credit');

      logger.info('Card type identification verified');
    });
  });
});
