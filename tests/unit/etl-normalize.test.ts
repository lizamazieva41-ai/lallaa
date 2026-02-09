import { normalizeBatch, validateNormalized } from '../../scripts/etl/normalize';
import { SourceRecord } from '../../scripts/etl/extract';
import { CardNetwork, CardType } from '../../src/types';

describe('ETL Normalize Module', () => {
  describe('normalizeBatch', () => {
    it('should normalize a single record', () => {
      const records: SourceRecord[] = [
        {
          bin: '453201',
          scheme: 'visa',
          type: 'debit',
          brand: 'Visa Classic',
          issuer: 'Jyske Bank',
          country: 'Denmark',
          countryCode: 'DK',
          raw: {},
        },
      ];

      const result = normalizeBatch(records);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].normalizedCountryCode).toBe('DK');
      expect(result.records[0].normalizedScheme).toBe('visa');
      expect(result.records[0].normalizedIssuer).toBe('JYSKE BANK');
      expect(result.records[0].normalizedBrand).toBe('Classic');
    });

    it('should normalize country names to ISO2 codes', () => {
      const records: SourceRecord[] = [
        {
          bin: '457173',
          country: 'Germany',
          raw: {},
        },
        {
          bin: '512345',
          country: 'UNITED STATES',
          raw: {},
        },
        {
          bin: '678901',
          country: 'united kingdom',
          raw: {},
        },
      ];

      const result = normalizeBatch(records);

      expect(result.records[0].normalizedCountryCode).toBe('DE');
      expect(result.records[1].normalizedCountryCode).toBe('US');
      expect(result.records[2].normalizedCountryCode).toBe('GB');
    });

    it('should handle missing country info', () => {
      const records: SourceRecord[] = [
        {
          bin: '123456',
          raw: {},
        },
      ];

      const result = normalizeBatch(records);

      expect(result.records[0].normalizedCountryCode).toBe('');
      expect(result.records[0].normalizedCountry).toBe('');
    });

    it('should normalize scheme names', () => {
      const records: SourceRecord[] = [
        { bin: '400000', scheme: 'VISA', raw: {} },
        { bin: '510000', scheme: 'MasterCard', raw: {} },
        { bin: '370000', scheme: 'american express', raw: {} },
        { bin: '620000', scheme: 'UNIONPAY', raw: {} },
      ];

      const result = normalizeBatch(records);

      expect(result.records[0].normalizedScheme).toBe('visa');
      expect(result.records[1].normalizedScheme).toBe('mastercard');
      expect(result.records[2].normalizedScheme).toBe('amex');
      expect(result.records[3].normalizedScheme).toBe('unionpay');
    });

    it('should normalize type values', () => {
      const records: SourceRecord[] = [
        { bin: '400000', type: 'DEBIT', raw: {} },
        { bin: '510000', type: 'credit', raw: {} },
        { bin: '670000', type: 'pre-paid', raw: {} },
      ];

      const result = normalizeBatch(records);

      expect(result.records[0].normalizedType).toBe('debit');
      expect(result.records[1].normalizedType).toBe('credit');
      expect(result.records[2].normalizedType).toBe('prepaid');
    });

    it('should calculate confidence score', () => {
      const completeRecord: SourceRecord = {
        bin: '453201',
        scheme: 'visa',
        type: 'debit',
        brand: 'Visa',
        issuer: 'Bank',
        country: 'Denmark',
        countryCode: 'DK',
        raw: {},
      };

      const incompleteRecord: SourceRecord = {
        bin: '123456',
        raw: {},
      };

      const result = normalizeBatch([completeRecord, incompleteRecord]);

      expect(result.records[0].confidence).toBeGreaterThan(result.records[1].confidence);
      expect(result.records[0].confidence).toBeLessThanOrEqual(100);
    });

    it('should track country mappings', () => {
      const records: SourceRecord[] = [
        { bin: '457173', country: 'Germany', raw: {} },
        { bin: '457174', country: 'GERMANY', raw: {} },
      ];

      const result = normalizeBatch(records);

      expect(result.countryMappings['germany']).toBe('DE');
    });

    it('should normalize issuer names', () => {
      const records: SourceRecord[] = [
        { bin: '453201', issuer: 'Jyske Bank A/S', raw: {} },
        { bin: '453202', issuer: 'SANTANDER CONSUMER BANK AG', raw: {} },
      ];

      const result = normalizeBatch(records);

      expect(result.records[0].normalizedIssuer).toBe('JYSKE BANK A/S');
      expect(result.records[1].normalizedIssuer).toBe('SANTANDER CONSUMER BANK AG');
    });

    it('should handle edge cases', () => {
      const records: SourceRecord[] = [
        {
          bin: '453201',
          scheme: '  VISA  ',
          type: '  DEBIT  ',
          issuer: undefined,
          country: '',
          raw: {},
        },
      ];

      const result = normalizeBatch(records);

      expect(result.records[0].normalizedScheme).toBe('visa');
      expect(result.records[0].normalizedType).toBe('debit');
      expect(result.records[0].normalizedIssuer).toBe('');
    });
  });

  describe('validateNormalized', () => {
    it('should validate correct records', () => {
      const records = [
        {
          bin: '453201',
          normalizedCountryCode: 'US',
          normalizedScheme: 'visa',
          normalizedIssuer: 'BANK',
          normalizedCountry: 'United States',
          raw: {},
        } as any,
      ];

      const result = validateNormalized(records);

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(0);
    });

    it('should reject invalid BIN format', () => {
      const records = [
        {
          bin: '12345',
          normalizedCountryCode: 'US',
          raw: {},
        } as any,
      ];

      const result = validateNormalized(records);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toContain('Invalid BIN format');
    });

    it('should reject missing country code', () => {
      const records = [
        {
          bin: '453201',
          normalizedCountryCode: '',
          raw: {},
        } as any,
      ];

      const result = validateNormalized(records);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toContain('Missing country code');
    });

    it('should handle mixed valid and invalid', () => {
      const records = [
        { bin: '453201', normalizedCountryCode: 'US', raw: {} } as any,
        { bin: '12345', normalizedCountryCode: 'US', raw: {} } as any,
        { bin: '567890', normalizedCountryCode: '', raw: {} } as any,
      ];

      const result = validateNormalized(records);

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(2);
    });
  });
});
