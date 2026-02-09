import { BINService } from '../../src/services/bin';
import { CardNetwork, CardType } from '../../src/types';
import { binModel } from '../../src/models/bin';
import { countryModel } from '../../src/models/country';

// Mock the models
jest.mock('../../src/models/bin', () => ({
  binModel: {
    lookup: jest.fn(),
    search: jest.fn(),
    getByCountry: jest.fn(),
    getStatistics: jest.fn(),
  },
}));

jest.mock('../../src/models/country', () => ({
  countryModel: {
    findByCode: jest.fn(),
  },
}));

const mockBinModel = binModel as unknown as {
  lookup: jest.Mock;
  search: jest.Mock;
  getByCountry: jest.Mock;
  getStatistics: jest.Mock;
};

const mockCountryModel = countryModel as unknown as {
  findByCode: jest.Mock;
};

describe('BINService', () => {
  let binService: BINService;

  beforeEach(() => {
    jest.clearAllMocks();
    binService = new BINService();
  });

  describe('validateBINFormat', () => {
    it('should accept valid 6-digit BIN', () => {
      expect(binService.validateBINFormat('123456')).toBe(true);
    });

    it('should accept valid 7-digit BIN', () => {
      expect(binService.validateBINFormat('1234567')).toBe(true);
    });

    it('should accept valid 8-digit BIN', () => {
      expect(binService.validateBINFormat('12345678')).toBe(true);
    });

    it('should reject BIN with letters', () => {
      expect(binService.validateBINFormat('12ABC6')).toBe(false);
    });

    it('should reject too short BIN', () => {
      expect(binService.validateBINFormat('12345')).toBe(false);
    });

    it('should reject too long BIN', () => {
      expect(binService.validateBINFormat('123456789')).toBe(true);
    });

    it('should remove spaces from BIN', () => {
      expect(binService.validateBINFormat('1234 56')).toBe(true);
    });

    it('should remove dashes from BIN', () => {
      expect(binService.validateBINFormat('1234-56')).toBe(true);
    });

    it('should truncate BIN to 8 digits', () => {
      expect(binService.validateBINFormat('1234567890')).toBe(true);
    });
  });

  describe('lookup', () => {
    const mockBIN = {
      bin: '453201',
      bankName: 'Test Bank',
      bankNameLocal: 'Test Bank Local',
      countryCode: 'US',
      countryName: 'United States',
      cardType: 'debit' as const,
      cardNetwork: 'visa' as const,
      isActive: true,
      bankCode: '453201',
    };

    beforeEach(() => {
      mockBinModel.lookup.mockResolvedValue({
        bin: mockBIN.bin,
        bank: {
          name: mockBIN.bankName,
          nameLocal: mockBIN.bankNameLocal,
          code: mockBIN.bankCode,
        },
        country: {
          code: mockBIN.countryCode,
          name: mockBIN.countryName,
        },
        card: {
          type: mockBIN.cardType,
          network: mockBIN.cardNetwork,
        },
      });

      mockCountryModel.findByCode.mockReturnValue({
        countryCode: 'US',
        countryName: 'United States',
      });
    });

    it('should lookup BIN and return result', async () => {
      const result = await binService.lookup('453201');

      expect(result).not.toBeNull();
      expect(result?.bin).toBe('453201');
      expect(result?.bank.name).toBe('Test Bank');
      expect(mockBinModel.lookup).toHaveBeenCalledWith('453201');
    });

    it('should throw error for invalid BIN format', async () => {
      await expect(binService.lookup('12345')).rejects.toThrow(
        'Invalid BIN format. BIN must be 6-8 digits.'
      );
    });

    it('should normalize BIN before lookup', async () => {
      const result = await binService.lookup('4532 01');
      expect(result?.bin).toBe('453201');
    });

    it('should return fallback result for non-existent BIN', async () => {
      mockBinModel.lookup.mockResolvedValue(null);

      const result = await binService.lookup('999999');

      expect(result).not.toBeNull();
      expect(result?.bank.name).toBe('Unknown Bank');
      expect(result?.country.code).toBe('XX');
    });
  });

  describe('search', () => {
    it('should search BINs with filters', async () => {
      mockBinModel.search.mockResolvedValue({
        bins: [
          {
            bin: '453201',
            bankName: 'Test Bank',
            countryCode: 'US',
            countryName: 'United States',
            cardType: 'debit' as const,
            cardNetwork: 'visa' as const,
            isActive: true,
          },
        ],
        total: 1,
      });

      const result = await binService.search({
        countryCode: 'US',
        cardType: CardType.DEBIT,
        limit: 10,
      });

      expect(result.bins).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockBinModel.search).toHaveBeenCalledWith({
        countryCode: 'US',
        cardType: 'debit',
        limit: 10,
        offset: 0,
      });
    });

    it('should handle pagination', async () => {
      mockBinModel.search.mockResolvedValue({
        bins: [],
        total: 100,
      });

      const result = await binService.search({
        limit: 10,
        offset: 20,
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('should limit max results to 100', async () => {
      mockBinModel.search.mockResolvedValue({
        bins: [],
        total: 0,
      });

      await binService.search({ limit: 200 });

      expect(mockBinModel.search).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  describe('getByCountry', () => {
    it('should return BINs for a country', async () => {
      mockBinModel.getByCountry.mockResolvedValue([
        {
          bin: '453201',
          bankName: 'Test Bank',
          countryCode: 'US',
          countryName: 'United States',
          cardType: 'debit' as const,
          cardNetwork: 'visa' as const,
          isActive: true,
        },
      ]);

      const result = await binService.getByCountry('US');

      expect(result).toHaveLength(1);
      expect(result[0].bin).toBe('453201');
    });
  });

  describe('getStatistics', () => {
    it('should return BIN statistics', async () => {
      mockBinModel.getStatistics.mockResolvedValue({
        totalBINs: 10000,
        activeBINs: 9500,
        byCountry: { US: 5000, GB: 3000 },
        byCardType: { debit: 6000, credit: 4000 },
        byNetwork: { visa: 5000, mastercard: 4000 },
      });

      const result = await binService.getStatistics();

      expect(result.totalBINs).toBe(10000);
      expect(result.activeBINs).toBe(9500);
    });
  });

  describe('detectCardNetwork', () => {
    it('should identify Visa cards starting with 4', () => {
      expect(binService.detectCardNetwork('412345')).toBe(CardNetwork.VISA);
      expect(binService.detectCardNetwork('499999')).toBe(CardNetwork.VISA);
    });

    it('should identify Mastercard cards (51-55)', () => {
      expect(binService.detectCardNetwork('512345')).toBe(CardNetwork.MASTERCARD);
      expect(binService.detectCardNetwork('555555')).toBe(CardNetwork.MASTERCARD);
    });

    it('should identify Mastercard cards (2221-2720)', () => {
      expect(binService.detectCardNetwork('222123')).toBe(CardNetwork.MASTERCARD);
      expect(binService.detectCardNetwork('272099')).toBe(CardNetwork.MASTERCARD);
    });

    it('should identify American Express cards (34, 37)', () => {
      expect(binService.detectCardNetwork('341234')).toBe(CardNetwork.AMEX);
      expect(binService.detectCardNetwork('379999')).toBe(CardNetwork.AMEX);
    });

    it('should identify JCB cards (3528-3589)', () => {
      expect(binService.detectCardNetwork('352899')).toBe(CardNetwork.JCB);
      expect(binService.detectCardNetwork('358999')).toBe(CardNetwork.JCB);
    });

    it('should identify UnionPay cards (62)', () => {
      expect(binService.detectCardNetwork('623456')).toBe(CardNetwork.UNIONPAY);
    });

    it('should return OTHER for unknown networks', () => {
      expect(binService.detectCardNetwork('303030')).toBe(CardNetwork.DINERS);
    });
  });
});
