import { cardController } from '../../src/controllers/cards';
import { CardGenerationService } from '../../src/services/cardGeneration';
import { cardGatewayModel, testCardModel } from '../../src/models/testCard';

jest.mock('../../src/services/cardGeneration', () => ({
  CardGenerationService: {
    getSupportedVendors: jest.fn(),
    generateSingle: jest.fn(),
    generateMultiple: jest.fn(),
  },
}));

jest.mock('../../src/models/testCard', () => ({
  cardGatewayModel: {
    findAll: jest.fn(),
    findBySlug: jest.fn(),
  },
  testCardModel: {
    search: jest.fn(),
    getStatistics: jest.fn(),
  },
}));

const mockCardService = CardGenerationService as jest.Mocked<typeof CardGenerationService>;
const mockGatewayModel = cardGatewayModel as jest.Mocked<typeof cardGatewayModel>;
const mockTestCardModel = testCardModel as jest.Mocked<typeof testCardModel>;

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('CardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject missing vendor', async () => {
    const req = { query: {}, requestId: 'req-1' } as any;
    const res = buildRes();

    await cardController.generateCards(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'MISSING_VENDOR' }),
      })
    );
  });

  it('should reject invalid count', async () => {
    const req = { query: { vendor: 'visa', count: '999' }, requestId: 'req-2' } as any;
    const res = buildRes();

    await cardController.generateCards(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_COUNT' }),
      })
    );
  });

  it('should generate a single card', async () => {
    mockCardService.generateSingle.mockReturnValue({
      cardNumber: '4111111111111111',
      vendor: 'visa',
      brand: 'Visa',
    });

    const req = { query: { vendor: 'visa' }, requestId: 'req-3' } as any;
    const res = buildRes();

    await cardController.generateCards(req, res as any);
    expect(mockCardService.generateSingle).toHaveBeenCalledWith({ vendor: 'visa' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ count: 1 }),
      })
    );
  });

  it('should generate multiple cards', async () => {
    mockCardService.generateMultiple.mockReturnValue([
      { cardNumber: '4111111111111111', vendor: 'visa', brand: 'Visa' },
      { cardNumber: '4111111111111112', vendor: 'visa', brand: 'Visa' },
    ]);

    const req = { query: { vendor: 'visa', count: '2' }, requestId: 'req-4' } as any;
    const res = buildRes();

    await cardController.generateCards(req, res as any);
    expect(mockCardService.generateMultiple).toHaveBeenCalledWith({ vendor: 'visa', count: 2 });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ count: 2 }),
      })
    );
  });

  it('should handle unsupported vendor error', async () => {
    mockCardService.generateSingle.mockImplementation(() => {
      throw new Error('Unsupported vendor');
    });

    const req = { query: { vendor: 'invalid' }, requestId: 'req-5' } as any;
    const res = buildRes();

    await cardController.generateCards(req, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNSUPPORTED_VENDOR' }),
      })
    );
  });

  it('should return supported vendors', async () => {
    mockCardService.getSupportedVendors.mockReturnValue(['visa', 'mastercard']);
    const req = { requestId: 'req-6' } as any;
    const res = buildRes();

    await cardController.getSupportedVendors(req, res as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ count: 2 }),
      })
    );
  });

  it('should return gateways', async () => {
    mockGatewayModel.findAll.mockResolvedValue([{ id: 'gw-1', name: 'Gateway' }] as any);
    const req = { requestId: 'req-7' } as any;
    const res = buildRes();

    await cardController.getGateways(req, res as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ count: 1 }),
      })
    );
  });

  it('should return gateway by slug', async () => {
    mockGatewayModel.findBySlug.mockResolvedValue({ id: 'gw-1', slug: 'stripe' } as any);
    const req = { params: { slug: 'stripe' }, requestId: 'req-8' } as any;
    const res = buildRes();

    await cardController.getGatewayBySlug(req, res as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ gateway: expect.any(Object) }),
      })
    );
  });

  it('should return 404 for missing gateway', async () => {
    mockGatewayModel.findBySlug.mockResolvedValue(null);
    const req = { params: { slug: 'missing' }, requestId: 'req-9' } as any;
    const res = buildRes();

    await cardController.getGatewayBySlug(req, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should search test cards with filters', async () => {
    mockTestCardModel.search.mockResolvedValue({
      cards: [{ id: 'card-1' }],
      total: 1,
    } as any);

    const req = {
      query: { gatewaySlug: 'stripe', is3dsEnrolled: 'true', limit: '5', offset: '0' },
      requestId: 'req-10'
    } as any;
    const res = buildRes();

    await cardController.getTestCards(req, res as any);
    expect(mockTestCardModel.search).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewaySlug: 'stripe',
        is3dsEnrolled: true,
        limit: 5,
        offset: 0,
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ cards: [{ id: 'card-1' }] }),
      })
    );
  });

  it('should return test cards by gateway', async () => {
    mockGatewayModel.findBySlug.mockResolvedValue({ id: 'gw-1', slug: 'stripe' } as any);
    mockTestCardModel.search.mockResolvedValue({
      cards: [{ id: 'card-1' }],
      total: 1,
    } as any);

    const req = {
      params: { slug: 'stripe' },
      query: { limit: '10', offset: '0' },
      requestId: 'req-11',
    } as any;
    const res = buildRes();

    await cardController.getTestCardsByGateway(req, res as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ cards: [{ id: 'card-1' }] }),
      })
    );
  });

  it('should return stats', async () => {
    mockCardService.getSupportedVendors.mockReturnValue(['visa']);
    mockTestCardModel.getStatistics.mockResolvedValue({ total: 1 } as any);

    const req = { requestId: 'req-12' } as any;
    const res = buildRes();

    await cardController.getStatistics(req, res as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          cardGeneration: expect.any(Object),
          testCards: expect.any(Object),
        }),
      })
    );
  });
});
