/**
 * IBAN Service Unit Tests
 */

jest.mock('../../src/models/country', () => ({
  countryModel: {
    findByCode: jest.fn(),
  },
}));

import { IBANService } from '../../src/services/iban';
import { countryModel } from '../../src/models/country';

const ibanService = new IBANService();
const mockCountryModel = countryModel as unknown as {
  findByCode: jest.Mock;
};

describe('IBAN Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountryModel.findByCode.mockImplementation((code: string) => {
      const normalized = code.toUpperCase();
      const data: Record<string, any> = {
        DE: {
          countryCode: 'DE',
          ibanLength: 22,
          bankCodeLength: 8,
          accountNumberLength: 10,
          ibanRegex: 'DE\\d{20}',
        },
        FR: {
          countryCode: 'FR',
          ibanLength: 27,
          bankCodeLength: 5,
          accountNumberLength: 11,
          ibanRegex: 'FR\\d{25}',
        },
        GB: {
          countryCode: 'GB',
          ibanLength: 22,
          bankCodeLength: 4,
          accountNumberLength: 14,
          ibanRegex: 'GB\\d{20}',
        },
      };
      return Promise.resolve(data[normalized] || null);
    });
  });

  describe('validate', () => {
    it('should validate a correct German IBAN', async () => {
      const result = await ibanService.validate('DE89370400440532013000');

      expect(result.isValid).toBe(true);
      expect(result.countryCode).toBe('DE');
      expect(result.bankCode).toBe('37040044');
      expect(result.accountNumber).toBe('0532013000');
    });

    it('should validate a correct French IBAN', async () => {
      const result = await ibanService.validate('FR7630006000011234567890189');

      expect(result.isValid).toBe(true);
      expect(result.countryCode).toBe('FR');
      expect(result.bankCode).toBe('30006');
      expect(result.accountNumber).toBe('000011234567890189');
    });

    it('should validate a correct UK IBAN', async () => {
      const result = await ibanService.validate('GB82WEST12345698765432');

      expect(result.isValid).toBe(true);
      expect(result.countryCode).toBe('GB');
      expect(result.bankCode).toBe('WEST');
      expect(result.accountNumber).toBe('12345698765432');
    });

    it('should reject invalid check digits', async () => {
      const result = await ibanService.validate('DE89370400440532013001');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid check digits');
    });

    it('should reject IBAN with invalid country code', async () => {
      const result = await ibanService.validate('XX89370400440532013000');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown country code');
    });

    it('should reject IBAN with invalid length', async () => {
      const result = await ibanService.validate('DE8937040044053201');

      expect(result.isValid).toBe(false);
      expect(result.errors?.some((e: string) => e.includes('length'))).toBe(true);
    });

    it('should normalize IBAN by removing spaces', async () => {
      const result = await ibanService.validate('DE89 3704 0044 0532 0130 00');

      expect(result.isValid).toBe(true);
      expect(result.iban).toBe('DE89370400440532013000');
    });

    it('should convert IBAN to uppercase', async () => {
      const result = await ibanService.validate('de89370400440532013000');

      expect(result.isValid).toBe(true);
      expect(result.iban).toBe('DE89370400440532013000');
    });
  });

  describe('toMachineReadable', () => {
    it('should remove spaces from IBAN', async () => {
      const machineReadable = await ibanService.toMachineReadable('DE89 3704 0044 0532 0130 00');
      expect(machineReadable).toBe('DE89370400440532013000');
    });
  });

  describe('toHumanReadable', () => {
    it('should format IBAN for human reading', async () => {
      const humanReadable = await ibanService.toHumanReadable('DE89370400440532013000');
      expect(humanReadable).toBe('DE89 3704 0044 0532 0130 00');
    });
  });

  describe('generate', () => {
    it('should generate a valid German IBAN', async () => {
      const iban = await ibanService.generate({
        countryCode: 'DE',
        bankCode: '37040044',
        accountNumber: '0532013000',
        format: false,
      });

      expect(iban.length).toBe(22);
      expect(iban.startsWith('DE')).toBe(true);

      // Verify generated IBAN is valid
      const result = await ibanService.validate(iban);
      expect(result.isValid).toBe(true);
    });

    it('should generate a valid French IBAN', async () => {
      const iban = await ibanService.generate({
        countryCode: 'FR',
        bankCode: '30006',
        accountNumber: '00011234567890189',
        format: false,
      });

      expect(iban.length).toBe(27);
      expect(iban.startsWith('FR')).toBe(true);

      // Verify generated IBAN is valid
      const result = await ibanService.validate(iban);
      expect(result.isValid).toBe(true);
    });

    it('should generate random BBAN when not provided', async () => {
      const iban1 = await ibanService.generate({
        countryCode: 'DE',
        format: false,
      });
      const iban2 = await ibanService.generate({
        countryCode: 'DE',
        format: false,
      });

      expect(iban1).not.toBe(iban2);
      expect(iban1.length).toBe(22);
      expect(iban2.length).toBe(22);
    });

    it('should throw error for unknown country', async () => {
      await expect(ibanService.generate({ countryCode: 'ZZ' } as any))
        .rejects
        .toThrow('Unknown country code: ZZ');
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple IBANs', async () => {
      const ibans = [
        'DE89370400440532013000',
        'INVALID_IBAN',
        'GB82WEST12345698765432',
      ];

      const results = await ibanService.validateBatch(ibans);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse and validate IBAN components', async () => {
      const result = await ibanService.parse('DE89370400440532013000');

      expect(result.isValid).toBe(true);
      expect(result.bankCode).toBe('37040044');
      expect(result.accountNumber).toBe('0532013000');
    });
  });

  describe('generateTestIBAN', () => {
    it('should generate a test IBAN for a country', async () => {
      const iban = await ibanService.generateTestIBAN('DE');
      expect(iban.startsWith('DE')).toBe(true);
      expect(iban.length).toBe(22);
    });

    it('should throw for unknown country', async () => {
      await expect(ibanService.generateTestIBAN('ZZ'))
        .rejects
        .toThrow('Unknown country code: ZZ');
    });
  });
});
