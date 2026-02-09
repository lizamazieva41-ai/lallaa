/**
 * Unit Tests for Test Card Model
 */

import { testCardModel } from '../../src/models/testCard';
import database from '../../src/database/connection';

// Mock database for testing
jest.mock('../../src/database/connection', () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));

const mockDb = database as jest.Mocked<typeof database>;

const buildCardRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  gateway_id: 10,
  brand: 'Visa',
  pan: '411111******1111',
  cvc: '123',
  expiry_hint: '12/30',
  expected_result: 'success',
  test_scenario: 'payment',
  notes: null,
  source_link: null,
  is_3ds_enrolled: false,
  card_type: 'credit',
  region: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('Test Card Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByGateway', () => {
    it('should return cards for a gateway', async () => {
      const mockCards = [buildCardRow({ id: 1 }), buildCardRow({ id: 2 })];

      mockDb.query.mockResolvedValueOnce({
        rows: mockCards,
        rowCount: 2,
      } as any);

      const result = await testCardModel.findByGateway(10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_cards'),
        [10]
      );
      expect(result).toHaveLength(2);
      expect(result[0].gatewayId).toBe(10);
    });
  });

  describe('search', () => {
    it('should search cards with filters', async () => {
      const mockCard = buildCardRow();

      mockDb.query.mockResolvedValueOnce({
        rows: [{ total: '1' }],
        rowCount: 1,
      } as any);
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          ...mockCard,
          gateway_name: 'Gateway Name',
          gateway_slug: 'stripe',
          gateway_docs_url: null,
          gateway_description: null,
          gateway_is_active: true,
          gateway_created_at: new Date(),
          gateway_updated_at: new Date(),
        }],
        rowCount: 1,
      } as any);

      const result = await testCardModel.search({
        gatewaySlug: 'stripe',
        brand: 'Visa',
        limit: 10,
        offset: 0,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_cards'),
        expect.arrayContaining(['stripe', 'Visa', 10, 0])
      );
      expect(result.cards).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('create', () => {
    it('should create a test card', async () => {
      const card = {
        gatewayId: 10,
        brand: 'Visa',
        pan: '411111******1111',
        cvc: '123',
        expiryHint: '12/30',
        expectedResult: 'success',
        testScenario: 'payment',
        is3dsEnrolled: false,
        cardType: 'credit' as const,
        notes: undefined,
        sourceLink: undefined,
        region: undefined,
      };

      const mockCard = buildCardRow({ gateway_id: card.gatewayId });

      mockDb.query.mockResolvedValueOnce({
        rows: [mockCard],
        rowCount: 1,
      } as any);

      const result = await testCardModel.create(card);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_cards'),
        expect.arrayContaining([
          card.gatewayId,
          card.brand,
          card.pan,
          card.cvc,
        ])
      );
      expect(result.brand).toBe(card.brand);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total_cards: '5', total_gateways: '2' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ name: 'Stripe', count: '3' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ brand: 'Visa', count: '4' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ expected_result: 'success', count: '5' }],
        } as any);

      const result = await testCardModel.getStatistics();

      expect(result.totalCards).toBe(5);
      expect(result.totalGateways).toBe(2);
      expect(result.cardsByGateway.Stripe).toBe(3);
    });
  });
});
