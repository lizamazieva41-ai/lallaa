/**
 * Unit Tests for BIN Model
 */

import { binModel } from '../../src/models/bin';
import database from '../../src/database/connection';
import { CardNetwork, CardType } from '../../src/types';

// Mock database for testing
jest.mock('../../src/database/connection', () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));

const mockDb = database as jest.Mocked<typeof database>;

const buildBinRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  bin: '411111',
  bank_name: 'Test Bank',
  bank_name_local: null,
  country_code: 'US',
  country_name: 'United States',
  card_type: CardType.CREDIT,
  card_network: CardNetwork.VISA,
  is_active: true,
  bank_code: '123456',
  branch_code: null,
  program_type: null,
  regulatory_type: null,
  bin_range_start: null,
  bin_range_end: null,
  length: 16,
  luhn: true,
  scheme: 'visa',
  brand: 'Visa Classic',
  issuer: 'Test Bank',
  country: 'United States',
  url: null,
  phone: null,
  city: null,
  source: 'test-data',
  source_version: '1.0',
  import_date: new Date(),
  last_updated: new Date(),
  raw: { scheme: 'visa' },
  confidence_score: 0.9,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const buildBinInput = (overrides: Partial<Record<string, unknown>> = {}) => ({
  bin: '411111',
  bankName: 'Test Bank',
  bankNameLocal: undefined,
  countryCode: 'US',
  countryName: 'United States',
  cardType: CardType.CREDIT,
  cardNetwork: CardNetwork.VISA,
  isActive: true,
  bankCode: '123456',
  branchCode: undefined,
  programType: undefined,
  regulatoryType: undefined,
  binRangeStart: undefined,
  binRangeEnd: undefined,
  length: 16,
  luhn: true,
  scheme: 'visa',
  brand: 'Visa Classic',
  issuer: 'Test Bank',
  country: 'United States',
  url: undefined,
  phone: undefined,
  city: undefined,
  source: 'test-data',
  sourceVersion: '1.0',
  importDate: new Date('2024-01-01T00:00:00.000Z'),
  lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
  raw: { scheme: 'visa' },
  confidenceScore: 0.9,
  ...overrides,
});

describe('BIN Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByBIN', () => {
    it('should return BIN data when found', async () => {
      const bin = '411111';
      const mockBinData = buildBinRow({ bin });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockBinData],
        rowCount: 1,
      } as any);

      const result = await binModel.findByBIN(bin);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM bins'),
        [bin]
      );
      expect(result?.bin).toBe(bin);
      expect(result?.bankName).toBe('Test Bank');
      expect(result?.countryCode).toBe('US');
    });

    it('should return null when BIN not found', async () => {
      const bin = '999999';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await binModel.findByBIN(bin);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM bins'),
        [bin]
      );
      expect(result).toBeNull();
    });
  });

  describe('getBySource', () => {
    it('should return BINs filtered by source', async () => {
      const source = 'binlist/data';
      const mockBins = [
        buildBinRow({ bin: '411111', source }),
        buildBinRow({ bin: '555555', source }),
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockBins,
        rowCount: 2,
      } as any);

      const result = await binModel.getBySource(source);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM bins'),
        [source]
      );
      expect(result).toHaveLength(2);
      expect(result[0].source).toBe(source);
    });
  });

  describe('getByBank', () => {
    it('should return BINs filtered by bank code', async () => {
      const bankCode = '123456';
      const mockBins = [
        buildBinRow({ bin: '411111', bank_code: bankCode }),
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockBins,
        rowCount: 1,
      } as any);

      const result = await binModel.getByBank(bankCode);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM bins'),
        [bankCode]
      );
      expect(result).toHaveLength(1);
      expect(result[0].bankCode).toBe(bankCode);
    });
  });

  describe('search', () => {
    it('should apply filters and pagination', async () => {
      const mockRows = [
        buildBinRow({ bin: '411111' }),
        buildBinRow({ bin: '411112' }),
      ];

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total: '2' }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({
          rows: mockRows,
          rowCount: 2,
        } as any);

      const result = await binModel.search({
        countryCode: 'us',
        bankName: 'Test',
        isActive: true,
        limit: 5,
        offset: 10,
      });

      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('COUNT(*)'),
        ['US', '%Test%', true]
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ORDER BY bin ASC'),
        ['US', '%Test%', true, 5, 10]
      );
      expect(result.total).toBe(2);
      expect(result.bins).toHaveLength(2);
    });
  });

  describe('create', () => {
    it('should insert and return new BIN', async () => {
      const input = buildBinInput();
      const mockRow = buildBinRow();

      mockDb.query.mockResolvedValueOnce({
        rows: [mockRow],
        rowCount: 1,
      } as any);

      const result = await binModel.create(input as any);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO bins'),
        expect.arrayContaining([input.bin, input.bankName, input.countryCode])
      );
      expect(result.bin).toBe(input.bin);
      expect(result.bankName).toBe(input.bankName);
    });
  });

  describe('update', () => {
    it('should return existing BIN when no updates provided', async () => {
      const existing = buildBinRow({ bin: '411111' });
      const spy = jest.spyOn(binModel, 'findByBIN').mockResolvedValue({
        bin: existing.bin,
        bankName: existing.bank_name,
        bankNameLocal: existing.bank_name_local || undefined,
        countryCode: existing.country_code,
        countryName: existing.country_name,
        cardType: existing.card_type,
        cardNetwork: existing.card_network,
        isActive: existing.is_active,
        bankCode: existing.bank_code || undefined,
        branchCode: existing.branch_code || undefined,
        programType: existing.program_type || undefined,
        regulatoryType: existing.regulatory_type || undefined,
        binRangeStart: existing.bin_range_start || undefined,
        binRangeEnd: existing.bin_range_end || undefined,
        length: existing.length ?? undefined,
        luhn: existing.luhn ?? undefined,
        scheme: existing.scheme || undefined,
        brand: existing.brand || undefined,
        issuer: existing.issuer || undefined,
        country: existing.country || undefined,
        url: existing.url || undefined,
        phone: existing.phone || undefined,
        city: existing.city || undefined,
        source: existing.source,
        sourceVersion: existing.source_version || undefined,
        importDate: existing.import_date ?? undefined,
        lastUpdated: existing.last_updated ?? undefined,
        raw: existing.raw || undefined,
        confidenceScore: Number(existing.confidence_score),
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      });

      const result = await binModel.update('411111', {});
      expect(spy).toHaveBeenCalledWith('411111');
      expect(result?.bin).toBe('411111');
    });

    it('should update and return BIN', async () => {
      const mockRow = buildBinRow({ bank_name: 'Updated Bank' });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockRow],
        rowCount: 1,
      } as any);

      const result = await binModel.update('411111', { bankName: 'Updated Bank' } as any);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE bins'),
        ['Updated Bank', '411111']
      );
      expect(result?.bankName).toBe('Updated Bank');
    });

    it('should return null when BIN not found', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await binModel.update('000000', { bankName: 'Missing' } as any);
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete BIN and return true when deleted', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
      } as any);

      const result = await binModel.delete('411111');
      expect(result).toBe(true);
    });

    it('should return false when nothing deleted', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 0,
      } as any);

      const result = await binModel.delete('411111');
      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return aggregated statistics', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total: '100', active: '90', inactive: '10' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ country_code: 'US', count: '40' }],
        } as any);

      const result = await binModel.getStatistics();

      expect(result.totalBINs).toBe(100);
      expect(result.activeBINs).toBe(90);
      expect(result.byCountry.US).toBe(40);
    });
  });

  describe('getSourceQualityReport', () => {
    it('should return quality metrics by source', async () => {
      const mockQualityReport = [
        {
          source: 'binlist/data',
          total: '1000',
          active: '950',
          last_import: new Date(),
          completeness: '80',
        },
        {
          source: 'other-source',
          total: '500',
          active: '400',
          last_import: new Date(),
          completeness: '60',
        },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockQualityReport,
        rowCount: 2,
      } as any);

      const result = await binModel.getSourceQualityReport();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
      expect(result['binlist/data'].totalBINs).toBe(1000);
      expect(result['binlist/data'].activeBINs).toBe(950);
    });
  });

  describe('getETLRunHistory', () => {
    it('should return ETL run history', async () => {
      const mockHistory = [
        {
          source: 'binlist/data',
          version: '1.0',
          record_count: '1000',
          started_at: new Date(),
          completed_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockHistory,
        rowCount: 1,
      } as any);

      const result = await binModel.getETLRunHistory(10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [10]
      );
      expect(result).toHaveLength(1);
      expect(result[0].recordCount).toBe(1000);
    });
  });
});
