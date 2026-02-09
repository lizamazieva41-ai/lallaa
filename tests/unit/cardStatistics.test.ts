import { CardStatisticsService } from '../../src/services/cardStatistics';
import { cardStatisticsModel } from '../../src/models/cardStatistics';
import { cardAuditModel } from '../../src/models/cardAudit';
import { generatedCardModel } from '../../src/models/generatedCard';

// Mock the models
jest.mock('../../src/models/cardStatistics');
jest.mock('../../src/models/cardAudit');
jest.mock('../../src/models/generatedCard');

describe('CardStatisticsService', () => {
  let service: CardStatisticsService;

  beforeEach(() => {
    service = new CardStatisticsService();
    jest.clearAllMocks();
  });

  describe('calculateDailyStatistics', () => {
    it('should calculate and store daily statistics', async () => {
      const targetDate = new Date('2024-01-15');
      targetDate.setHours(0, 0, 0, 0);

      (cardStatisticsModel.findByDate as jest.Mock).mockResolvedValue(null);
      (generatedCardModel.getStatisticsByDateRange as jest.Mock).mockResolvedValue({
        totalGenerated: 1000,
        totalUnique: 995,
        totalDuplicates: 5,
        byMode: {
          random: 600,
          sequential: 300,
          batch_999: 100,
        },
        byBin: [
          { bin: '453212', count: 500 },
          { bin: '512345', count: 300 },
        ],
        byCountry: [
          { countryCode: 'US', count: 600 },
          { countryCode: 'GB', count: 400 },
        ],
      });
      (cardAuditModel.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        avgResponseTime: 45.2,
        p95ResponseTime: 120.5,
        p99ResponseTime: 250.8,
        totalRequests: 1000,
        successRate: 99.5,
      });
      (cardAuditModel.findByDateRange as jest.Mock).mockResolvedValue({
        audits: [
          { userId: 'user-1', cardsGenerated: 100 },
          { userId: 'user-2', cardsGenerated: 200 },
        ],
        total: 2,
      });
      (cardStatisticsModel.upsert as jest.Mock).mockResolvedValue({});

      await service.calculateDailyStatistics({ date: targetDate });

      expect(cardStatisticsModel.upsert).toHaveBeenCalled();
      const upsertCall = (cardStatisticsModel.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.totalGenerated).toBe(1000);
      expect(upsertCall.totalUnique).toBe(995);
      expect(upsertCall.totalDuplicates).toBe(5);
    });

    it('should skip if statistics already exist', async () => {
      const targetDate = new Date('2024-01-15');
      targetDate.setHours(0, 0, 0, 0);

      (cardStatisticsModel.findByDate as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        date: targetDate,
      });

      await service.calculateDailyStatistics({ date: targetDate });

      expect(cardStatisticsModel.upsert).not.toHaveBeenCalled();
    });

    it('should force recalculation if force=true', async () => {
      const targetDate = new Date('2024-01-15');
      targetDate.setHours(0, 0, 0, 0);

      (cardStatisticsModel.findByDate as jest.Mock).mockResolvedValue({
        id: 'existing-id',
      });
      (generatedCardModel.getStatisticsByDateRange as jest.Mock).mockResolvedValue({
        totalGenerated: 1000,
        totalUnique: 995,
        totalDuplicates: 5,
        byMode: {},
        byBin: [],
        byCountry: [],
      });
      (cardAuditModel.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        avgResponseTime: 45.2,
        p95ResponseTime: 120.5,
        p99ResponseTime: 250.8,
        totalRequests: 1000,
        successRate: 99.5,
      });
      (cardAuditModel.findByDateRange as jest.Mock).mockResolvedValue({
        audits: [],
        total: 0,
      });

      await service.calculateDailyStatistics({ date: targetDate, force: true });

      expect(cardStatisticsModel.upsert).toHaveBeenCalled();
    });
  });

  describe('getRealTimeStatistics', () => {
    it('should return real-time statistics for today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      (generatedCardModel.getStatisticsByDateRange as jest.Mock).mockResolvedValue({
        totalGenerated: 500,
        totalUnique: 495,
        totalDuplicates: 5,
        byMode: {
          random: 300,
          sequential: 150,
          batch_999: 50,
        },
        byBin: [
          { bin: '453212', count: 200 },
        ],
        byCountry: [
          { countryCode: 'US', count: 300 },
        ],
      });
      (cardAuditModel.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        avgResponseTime: 45.2,
        p95ResponseTime: 120.5,
        p99ResponseTime: 250.8,
        totalRequests: 500,
        successRate: 99.0,
      });
      (cardAuditModel.findByDateRange as jest.Mock).mockResolvedValue({
        audits: [
          { userId: 'user-1', cardsGenerated: 100 },
        ],
        total: 1,
      });

      const stats = await service.getRealTimeStatistics();

      expect(stats.today.totalGenerated).toBe(500);
      expect(stats.today.byMode.random).toBe(300);
      expect(stats.performance.avgResponseTime).toBe(45.2);
    });
  });

  describe('getStatisticsByBin', () => {
    it('should return statistics for a specific BIN', async () => {
      (generatedCardModel.findByBin as jest.Mock).mockResolvedValue({
        cards: [
          {
            cardHash: 'hash1',
            generationMode: 'random',
            countryCode: 'US',
          },
          {
            cardHash: 'hash2',
            generationMode: 'sequential',
            countryCode: 'US',
          },
        ],
        total: 2,
      });

      const stats = await service.getStatisticsByBin('453212');

      expect(stats.bin).toBe('453212');
      expect(stats.totalGenerated).toBe(2);
      expect(stats.byMode.random).toBe(1);
      expect(stats.byMode.sequential).toBe(1);
    });
  });
});
