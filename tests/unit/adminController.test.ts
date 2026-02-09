import { adminLookupBIN, getBINsBySource, getETLRunHistory, clearCache, getCacheStats } from '../../src/controllers/admin';
import { binService } from '../../src/services/bin';
import { ValidationError } from '../../src/middleware/error';

jest.mock('../../src/services/bin', () => ({
  binService: {
    validateBINFormat: jest.fn(),
    lookup: jest.fn(),
    getBINsBySource: jest.fn(),
    getETLRunHistory: jest.fn(),
    clearCache: jest.fn(),
    getCacheStats: jest.fn(),
    getSourceQualityReport: jest.fn(),
  },
}));

const mockBinService = binService as jest.Mocked<typeof binService>;

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('AdminController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return validation error for invalid BIN', async () => {
    mockBinService.validateBINFormat.mockReturnValue(false);
    const req = { params: { bin: '12345' } } as any;
    const res = buildRes();
    const next = jest.fn();

    await adminLookupBIN(req, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('should return 400 when BIN not found', async () => {
    mockBinService.validateBINFormat.mockReturnValue(true);
    mockBinService.lookup.mockResolvedValue(null as any);
    const req = { params: { bin: '411111' }, userId: 'user-1' } as any;
    const res = buildRes();
    const next = jest.fn();

    await adminLookupBIN(req, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      })
    );
  });

  it('should return BIN data for admin lookup', async () => {
    mockBinService.validateBINFormat.mockReturnValue(true);
    mockBinService.lookup.mockResolvedValue({
      bank: { name: 'Bank' },
      country: { code: 'US' },
      card: { type: 'debit', network: 'visa' },
      metadata: {},
    } as any);

    const req = { params: { bin: '411111' }, userId: 'user-1' } as any;
    const res = buildRes();
    const next = jest.fn();

    await adminLookupBIN(req, res as any, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ bin: '411111' }),
      })
    );
  });

  it('should require source for BINs by source', async () => {
    const req = { query: {} } as any;
    const res = buildRes();
    const next = jest.fn();

    await getBINsBySource(req, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('should return ETL run history with capped limit', async () => {
    mockBinService.getETLRunHistory.mockResolvedValue([] as any);
    const req = { query: { limit: '200' }, userId: 'user-1' } as any;
    const res = buildRes();
    const next = jest.fn();

    await getETLRunHistory(req, res as any, next);
    expect(mockBinService.getETLRunHistory).toHaveBeenCalledWith(100);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('should clear cache', async () => {
    const req = { userId: 'user-1' } as any;
    const res = buildRes();
    const next = jest.fn();

    await clearCache(req, res as any, next);
    expect(mockBinService.clearCache).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('should return cache stats', async () => {
    mockBinService.getCacheStats.mockReturnValue({ size: 1 } as any);
    const req = { userId: 'user-1' } as any;
    const res = buildRes();
    const next = jest.fn();

    await getCacheStats(req, res as any, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ stats: { size: 1 } }),
      })
    );
  });
});
