/**
 * Unit Tests for ETL Extract Module
 * Tests extraction logic for JSON, CSV, YAML, and directory sources
 */

import fs from 'fs';
import path from 'path';
import {
  extractFromJSON,
  extractFromCSV,
  extractFromYAML,
  extractFromDirectory,
  SOURCE_PRIORITY,
} from '../../scripts/etl/extract';

// Test fixtures directory
const TEST_FIXTURES_DIR = path.join(__dirname, '../fixtures/etl/temp');

// Helper to create temporary test files
function createTempFile(relativePath: string, content: string): string {
  const fullPath = path.join(TEST_FIXTURES_DIR, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

// Helper to clean up temporary test files
function cleanupTempFile(relativePath: string): void {
  const fullPath = path.join(TEST_FIXTURES_DIR, relativePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

describe('ETL Extract Module', () => {
  beforeAll(() => {
    // Create test fixtures directory
    if (!fs.existsSync(TEST_FIXTURES_DIR)) {
      fs.mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test fixtures
    if (fs.existsSync(TEST_FIXTURES_DIR)) {
      fs.rmSync(TEST_FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe('extractFromJSON', () => {
    it('should extract valid BIN records from JSON file', async () => {
      const testData = {
        '411111': {
          scheme: 'visa',
          type: 'debit',
          brand: 'Visa Classic',
          bank: {
            name: 'Test Bank',
            city: 'New York',
          },
          country: {
            name: 'United States',
            alpha2: 'US',
          },
          length: 16,
          luhn: true,
        },
        '542523': {
          scheme: 'mastercard',
          type: 'credit',
          bank: { name: 'Another Bank' },
          country: { name: 'Canada', alpha2: 'CA' },
        },
      };

      const filePath = createTempFile('test-json.json', JSON.stringify(testData));
      const result = await extractFromJSON(filePath, 'binlist/data', '1.0');

      expect(result.source.name).toBe('binlist/data');
      expect(result.source.version).toBe('1.0');
      expect(result.source.format).toBe('json');
      expect(result.source.priority).toBe(SOURCE_PRIORITY['binlist/data']);
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Verify first record
      expect(result.records[0].bin).toBe('411111');
      expect(result.records[0].scheme).toBe('visa');
      expect(result.records[0].type).toBe('debit');
      expect(result.records[0].issuer).toBe('Test Bank');
      expect(result.records[0].country).toBe('United States');
      expect(result.records[0].countryCode).toBe('US');
      expect(result.records[0].city).toBe('New York');

      // Verify second record
      expect(result.records[1].bin).toBe('542523');
      expect(result.records[1].scheme).toBe('mastercard');

      cleanupTempFile('test-json.json');
    });

    it('should handle invalid BIN formats gracefully', async () => {
      const testData = {
        '12345': { scheme: 'visa' }, // Too short (5 digits)
        '123456789': { scheme: 'mastercard' }, // Too long (9 digits)
        'ABCDEF': { scheme: 'visa' }, // Invalid characters
      };

      const filePath = createTempFile('test-invalid-bins.json', JSON.stringify(testData));
      const result = await extractFromJSON(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(1);
      expect(result.records[0].bin).toBe('12345678');
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('Invalid BIN format: 12345'),
        expect.stringContaining('Invalid BIN format: ABCDEF'),
      ]));

      cleanupTempFile('test-invalid-bins.json');
    });

    it('should handle missing file gracefully', async () => {
      const result = await extractFromJSON('/nonexistent/path/file.json', 'binlist/data', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to read/parse JSON file');
    });

    it('should handle invalid JSON content', async () => {
      const filePath = createTempFile('test-invalid-json.json', '{ invalid json }');
      const result = await extractFromJSON(filePath, 'binlist/data', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to read/parse JSON file');

      cleanupTempFile('test-invalid-json.json');
    });

    it('should normalize BIN with spaces and hyphens', async () => {
      const testData = {
        '4111 11-11': { scheme: 'visa' },
        '55 44-33 22': { scheme: 'mastercard' },
      };

      const filePath = createTempFile('test-normalize.json', JSON.stringify(testData));
      const result = await extractFromJSON(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(2);
      expect(result.records[0].bin).toBe('41111111');
      expect(result.records[1].bin).toBe('55443322');

      cleanupTempFile('test-normalize.json');
    });

    it('should truncate BINs longer than 8 digits', async () => {
      const testData = {
        '4111111111111111': { scheme: 'visa' }, // Full card number
      };

      const filePath = createTempFile('test-truncate.json', JSON.stringify(testData));
      const result = await extractFromJSON(filePath, 'others', '1.0');

      expect(result.records[0].bin).toBe('41111111');
      expect(result.records[0].bin.length).toBe(8);

      cleanupTempFile('test-truncate.json');
    });
  });

  describe('extractFromCSV', () => {
    it('should extract valid BIN records from CSV file', async () => {
      const csvContent = `BIN,brand,type,issuer,country,country_code,length,luhn
411111,Visa,debit,Test Bank,United States,US,16,true
542523,Mastercard,credit,Another Bank,Canada,CA,16,true`;

      const filePath = createTempFile('test-csv.csv', csvContent);
      const result = await extractFromCSV(filePath, 'aderyabin/bin_list', '1.0');

      expect(result.source.name).toBe('aderyabin/bin_list');
      expect(result.source.format).toBe('csv');
      expect(result.source.priority).toBe(SOURCE_PRIORITY['aderyabin/bin_list']);
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.records[0].bin).toBe('411111');
      expect(result.records[0].scheme).toBe('Visa');
      expect(result.records[0].type).toBe('debit');
      expect(result.records[0].issuer).toBe('Test Bank');

      cleanupTempFile('test-csv.csv');
    });

    it('should use custom column mapping when provided', async () => {
      const csvContent = `bin_number,card_brand,card_type,bank_name,nation,iso_code
555555,Visa Platinum,credit,My Bank,France,FR`;

      const filePath = createTempFile('test-custom-mapping.csv', csvContent);
      const result = await extractFromCSV(
        filePath,
        'others',
        '1.0',
        {
          bin: 'bin_number',
          scheme: 'card_brand',
          type: 'card_type',
          issuer: 'bank_name',
          country: 'nation',
          countryCode: 'iso_code',
        }
      );

      expect(result.records).toHaveLength(1);
      expect(result.records[0].bin).toBe('555555');
      expect(result.records[0].scheme).toBe('Visa Platinum');
      expect(result.records[0].issuer).toBe('My Bank');
      expect(result.records[0].country).toBe('France');

      cleanupTempFile('test-custom-mapping.csv');
    });

    it('should skip rows with missing BIN values', async () => {
      const csvContent = `BIN,brand,type
,visa,debit
123456,mastercard,credit
,amex,debit`;

      const filePath = createTempFile('test-missing-bin.csv', csvContent);
      const result = await extractFromCSV(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(1);
      expect(result.errors).toHaveLength(0); // Should silently skip rows with missing BIN

      cleanupTempFile('test-missing-bin.csv');
    });

    it('should handle invalid BIN formats in CSV', async () => {
      const csvContent = `BIN,brand
12345,visa
ABCDEF,visa
123456789,visa`;

      const filePath = createTempFile('test-invalid-csv.csv', csvContent);
      const result = await extractFromCSV(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(1);
      expect(result.records[0].bin).toBe('12345678');
      expect(result.errors).toHaveLength(2);

      cleanupTempFile('test-invalid-csv.csv');
    });

    it('should handle missing CSV file gracefully', async () => {
      const result = await extractFromCSV('/nonexistent/path/file.csv', 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to read/parse CSV file');
    });

    it('should normalize Windows-1252 encoding', async () => {
      const csvContent = `BIN,brand
411111,Visa Classic
542523,Mastercard\r? Gold`; // Contains smart quote character

      const filePath = createTempFile('test-encoding.csv', csvContent);
      const result = await extractFromCSV(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(2);
      expect(result.records[1].scheme).toBeDefined();

      cleanupTempFile('test-encoding.csv');
    });

    it('should parse luhn column correctly', async () => {
      const csvContent = `BIN,luhn
411111,true
542523,false
555555,TRUE
666666,FALSE`;

      const filePath = createTempFile('test-luhn.csv', csvContent);
      const result = await extractFromCSV(filePath, 'others', '1.0');

      expect(result.records[0].luhn).toBe(true);
      expect(result.records[1].luhn).toBe(false);
      expect(result.records[2].luhn).toBe(true);
      expect(result.records[3].luhn).toBe(false);

      cleanupTempFile('test-luhn.csv');
    });
  });

  describe('extractFromYAML', () => {
    it('should extract valid BIN records from YAML file (object format)', async () => {
      const yamlContent = `
411111:
  scheme: visa
  type: debit
  brand: Visa Classic
  issuer:
    name: Test Bank
    city: New York
    country: United States
    countryCode: US
  length: 16
  luhn: true

542523:
  scheme: mastercard
  type: credit
  issuer:
    name: Another Bank
    country: Canada
    countryCode: CA
`;

      const filePath = createTempFile('test-yaml.yaml', yamlContent);
      const result = await extractFromYAML(filePath, 'venelinkochev/bin-list-data', '1.0');

      expect(result.source.name).toBe('venelinkochev/bin-list-data');
      expect(result.source.format).toBe('yaml');
      expect(result.source.priority).toBe(SOURCE_PRIORITY['venelinkochev/bin-list-data']);
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.records[0].bin).toBe('411111');
      expect(result.records[0].scheme).toBe('visa');
      expect(result.records[0].issuer).toBe('Test Bank');

      cleanupTempFile('test-yaml.yaml');
    });

    it('should extract valid BIN records from YAML file (array format)', async () => {
      const yamlContent = `
- bin: 411111
  scheme: visa
  type: debit
  issuer: Test Bank
  country: United States
  countryCode: US

- bin: 542523
  scheme: mastercard
  type: credit
  issuer: Another Bank
  country: Canada
  countryCode: CA
`;

      const filePath = createTempFile('test-yaml-array.yaml', yamlContent);
      const result = await extractFromYAML(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(2);
      expect(result.records[0].bin).toBe('411111');
      expect(result.records[1].bin).toBe('542523');

      cleanupTempFile('test-yaml-array.yaml');
    });

    it('should handle invalid BIN formats in YAML', async () => {
      const yamlContent = `
12345:
  scheme: visa
ABCDEF:
  scheme: mastercard
`;

      const filePath = createTempFile('test-invalid-yaml.yaml', yamlContent);
      const result = await extractFromYAML(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(2);

      cleanupTempFile('test-invalid-yaml.yaml');
    });

    it('should handle missing YAML file gracefully', async () => {
      const result = await extractFromYAML('/nonexistent/path/file.yaml', 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to read/parse YAML file');
    });

    it('should handle nested issuer data correctly', async () => {
      const yamlContent = `
411111:
  scheme: visa
  issuer:
    name: Nested Bank
    city: Chicago
    state: IL
    url: https://example.com
    phone: +1-555-1234
`;

      const filePath = createTempFile('test-nested.yaml', yamlContent);
      const result = await extractFromYAML(filePath, 'others', '1.0');

      expect(result.records[0].issuer).toBe('Nested Bank');
      expect(result.records[0].url).toBeUndefined();
      expect(result.records[0].phone).toBeUndefined();

      cleanupTempFile('test-nested.yaml');
    });
  });

  describe('extractFromDirectory', () => {
    it('should extract from directory containing multiple JSON files', async () => {
      const testDir = path.join(TEST_FIXTURES_DIR, 'multi-json');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'file1.json'), JSON.stringify({ '411111': { scheme: 'visa' } }));
      fs.writeFileSync(path.join(testDir, 'file2.json'), JSON.stringify({ '542523': { scheme: 'mastercard' } }));

      const result = await extractFromDirectory(testDir, 'binlist/data', '1.0');

      expect(result.source.format).toBe('json');
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Cleanup
      fs.unlinkSync(path.join(testDir, 'file1.json'));
      fs.unlinkSync(path.join(testDir, 'file2.json'));
      fs.rmdirSync(testDir);
    });

    it('should extract from directory containing mixed format files', async () => {
      const testDir = path.join(TEST_FIXTURES_DIR, 'mixed-formats');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'data.json'), JSON.stringify({ '411111': { scheme: 'visa' } }));
      fs.writeFileSync(path.join(testDir, 'data.csv'), 'BIN,brand\n542523,mastercard');
      fs.writeFileSync(path.join(testDir, 'data.yaml'), '411111:\n  scheme: visa');
      fs.writeFileSync(path.join(testDir, 'readme.txt'), 'This is a readme file'); // Should be skipped

      const result = await extractFromDirectory(testDir, 'binlist/data', '1.0');

      expect(result.records).toHaveLength(3); // JSON, CSV, YAML
      expect(result.source.format).toBe('json');

      // Cleanup
      fs.unlinkSync(path.join(testDir, 'data.json'));
      fs.unlinkSync(path.join(testDir, 'data.csv'));
      fs.unlinkSync(path.join(testDir, 'data.yaml'));
      fs.unlinkSync(path.join(testDir, 'readme.txt'));
      fs.rmdirSync(testDir);
    });

    it('should return empty result for non-existent directory', async () => {
      const result = await extractFromDirectory('/nonexistent/directory', 'binlist/data', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Directory not found');
    });

    it('should skip subdirectories', async () => {
      const testDir = path.join(TEST_FIXTURES_DIR, 'with-subdir');
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'data.json'), JSON.stringify({ '411111': { scheme: 'visa' } }));
      fs.writeFileSync(path.join(subDir, 'nested.json'), JSON.stringify({ '542523': { scheme: 'mastercard' } }));

      const result = await extractFromDirectory(testDir, 'others', '1.0');

      expect(result.records).toHaveLength(1); // Only top-level file

      // Cleanup
      fs.unlinkSync(path.join(testDir, 'data.json'));
      fs.unlinkSync(path.join(subDir, 'nested.json'));
      fs.rmdirSync(subDir);
      fs.rmdirSync(testDir);
    });

    it('should handle errors from individual files gracefully', async () => {
      const testDir = path.join(TEST_FIXTURES_DIR, 'with-errors');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'valid.json'), JSON.stringify({ '411111': { scheme: 'visa' } }));
      fs.writeFileSync(path.join(testDir, 'invalid.json'), '{ invalid json }');

      const result = await extractFromDirectory(testDir, 'others', '1.0');

      expect(result.records).toHaveLength(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to read/parse JSON file');

      // Cleanup
      fs.unlinkSync(path.join(testDir, 'valid.json'));
      fs.unlinkSync(path.join(testDir, 'invalid.json'));
      fs.rmdirSync(testDir);
    });

    it('should recognize file extensions case-insensitively', async () => {
      const testDir = path.join(TEST_FIXTURES_DIR, 'case-extensions');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'data.JSON'), JSON.stringify({ '411111': { scheme: 'visa' } }));
      fs.writeFileSync(path.join(testDir, 'data.CSV'), 'BIN,brand\n542523,mastercard');
      fs.writeFileSync(path.join(testDir, 'data.YML'), '411111:\n  scheme: visa');

      const result = await extractFromDirectory(testDir, 'others', '1.0');

      expect(result.records).toHaveLength(3);

      // Cleanup
      fs.unlinkSync(path.join(testDir, 'data.JSON'));
      fs.unlinkSync(path.join(testDir, 'data.CSV'));
      fs.unlinkSync(path.join(testDir, 'data.YML'));
      fs.rmdirSync(testDir);
    });
  });

  describe('SOURCE_PRIORITY', () => {
    it('should have correct priority values for known sources', () => {
      expect(SOURCE_PRIORITY['binlist/data']).toBe(1);
      expect(SOURCE_PRIORITY['venelinkochev/bin-list-data']).toBe(2);
      expect(SOURCE_PRIORITY['aderyabin/bin_list']).toBe(3);
      expect(SOURCE_PRIORITY['braintree/credit-card-type']).toBe(4);
      expect(SOURCE_PRIORITY['others']).toBe(5);
    });

    it('should use "others" priority for unknown sources', async () => {
      const result = await extractFromJSON(
        createTempFile('test-unknown.json', JSON.stringify({ '411111': { scheme: 'visa' } })),
        'unknown/source',
        '1.0'
      );

      expect(result.source.priority).toBe(SOURCE_PRIORITY['others']);

      cleanupTempFile('test-unknown.json');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty JSON object', async () => {
      const filePath = createTempFile('test-empty.json', '{}');
      const result = await extractFromJSON(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      cleanupTempFile('test-empty.json');
    });

    it('should handle empty CSV content', async () => {
      const filePath = createTempFile('test-empty.csv', '');
      const result = await extractFromCSV(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      cleanupTempFile('test-empty.csv');
    });

    it('should handle CSV with only headers', async () => {
      const csvContent = `BIN,brand,type`;
      const filePath = createTempFile('test-headers.csv', csvContent);
      const result = await extractFromCSV(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      cleanupTempFile('test-headers.csv');
    });

    it('should handle empty YAML document', async () => {
      const filePath = createTempFile('test-empty.yaml', '');
      const result = await extractFromYAML(filePath, 'others', '1.0');

      expect(result.records).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      cleanupTempFile('test-empty.yaml');
    });
  });
});
