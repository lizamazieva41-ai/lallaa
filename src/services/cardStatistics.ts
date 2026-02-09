import { cardStatisticsModel } from '../models/cardStatistics';
import { cardAuditModel } from '../models/cardAudit';
import { generatedCardModel } from '../models/generatedCard';
import { logger } from '../utils/logger';
import { statisticsCacheService } from './redisCache';
import {
  recordCardStatisticsQuery,
  recordStatisticsAggregation,
  updateCardGenerationDuplicateRate,
} from './metrics';

export interface StatisticsCalculationOptions {
  /**
   * Date to calculate statistics for
   * @default today
   */
  date?: Date;
  /**
   * Force recalculation even if statistics already exist
   * @default false
   */
  force?: boolean;
}

export interface RealTimeStatistics {
  today: {
    totalGenerated: number;
    totalUnique: number;
    totalDuplicates: number;
    byMode: {
      random: number;
      sequential: number;
      batch999: number;
    };
  };
  topBins: Array<{ bin: string; count: number }>;
  topCountries: Array<{ countryCode: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    successRate: number;
  };
}

export class CardStatisticsService {
  /**
   * Calculate and store daily statistics
   * This should be called by a daily cron job (e.g., at 00:00 UTC)
   */
  public async calculateDailyStatistics(
    options: StatisticsCalculationOptions = {}
  ): Promise<void> {
    const aggregationStartTime = Date.now();
    const targetDate = options.date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    recordStatisticsAggregation('started');

    // Check if statistics already exist
    if (!options.force) {
      const existing = await cardStatisticsModel.findByDate(targetDate);
      if (existing) {
        logger.info('Statistics already exist for date', { date: targetDate });
        return;
      }
    }

    logger.info('Calculating daily statistics', { date: targetDate });

    // Get date range for the day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Get statistics from generated_cards table
    const cardStats = await generatedCardModel.getStatisticsByDateRange(startDate, endDate);

    // Get performance metrics from audit logs
    const performanceMetrics = await cardAuditModel.getPerformanceMetrics(startDate, endDate);

    // Aggregate top users from audit logs
    const auditLogs = await cardAuditModel.findByDateRange(startDate, endDate, 10000, 0);
    const userCounts: Record<string, number> = {};
    for (const audit of auditLogs.audits) {
      if (audit.userId) {
        userCounts[audit.userId] = (userCounts[audit.userId] || 0) + audit.cardsGenerated;
      }
    }

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .reduce((acc, item) => {
        acc[item.userId] = item.count;
        return acc;
      }, {} as Record<string, number>);

    // Prepare statistics data
    const statistics = {
      date: targetDate,
      totalGenerated: cardStats.totalGenerated,
      totalUnique: cardStats.totalUnique,
      totalDuplicates: cardStats.totalDuplicates,
      randomCount: cardStats.byMode.random || 0,
      sequentialCount: cardStats.byMode.sequential || 0,
      batch999Count: cardStats.byMode.batch_999 || 0,
      binsUsed: cardStats.byBin.length,
      topBins: cardStats.byBin.reduce((acc, item) => {
        acc[item.bin] = item.count;
        return acc;
      }, {} as Record<string, number>),
      countriesUsed: cardStats.byCountry.length,
      topCountries: cardStats.byCountry.reduce((acc, item) => {
        acc[item.countryCode] = item.count;
        return acc;
      }, {} as Record<string, number>),
      usersActive: Object.keys(userCounts).length,
      topUsers,
      avgGenerationTimeMs: performanceMetrics.avgResponseTime,
      p95GenerationTimeMs: performanceMetrics.p95ResponseTime,
      p99GenerationTimeMs: performanceMetrics.p99ResponseTime,
    };

    // Upsert statistics
    await cardStatisticsModel.upsert(statistics);

    // Invalidate cache for this date
    const dateStr = targetDate.toISOString().split('T')[0];
    await statisticsCacheService.delete(`date:${dateStr}`);
    // Also invalidate real-time cache as it may be affected
    await statisticsCacheService.delete('realtime:today');

    // Calculate and update duplicate rate metric
    const duplicateRate = statistics.totalGenerated > 0
      ? statistics.totalDuplicates / statistics.totalGenerated
      : 0;
    updateCardGenerationDuplicateRate(duplicateRate);

    const aggregationDuration = (Date.now() - aggregationStartTime) / 1000;
    recordStatisticsAggregation('completed', aggregationDuration);

    logger.info('Daily statistics calculated and stored', {
      date: targetDate,
      totalGenerated: statistics.totalGenerated,
      totalUnique: statistics.totalUnique,
    });
  }

  /**
   * Get real-time statistics for today
   */
  public async getRealTimeStatistics(): Promise<RealTimeStatistics> {
    const queryStartTime = Date.now();
    
    // Check Redis cache first (5 minute TTL)
    const cacheKey = 'realtime:today';
    const cached = await statisticsCacheService.get<RealTimeStatistics>(cacheKey);
    if (cached.hit && cached.data) {
      logger.debug('Real-time statistics cache hit');
      const queryDuration = (Date.now() - queryStartTime) / 1000;
      recordCardStatisticsQuery('realtime', queryDuration);
      return cached.data;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Get today's statistics from generated_cards
    const cardStats = await generatedCardModel.getStatisticsByDateRange(today, endDate);

    // Get performance metrics from audit logs
    const performanceMetrics = await cardAuditModel.getPerformanceMetrics(today, endDate);

    // Get top users from audit logs
    const auditLogs = await cardAuditModel.findByDateRange(today, endDate, 1000, 0);
    const userCounts: Record<string, number> = {};
    for (const audit of auditLogs.audits) {
      if (audit.userId) {
        userCounts[audit.userId] = (userCounts[audit.userId] || 0) + audit.cardsGenerated;
      }
    }

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const result: RealTimeStatistics = {
      today: {
        totalGenerated: cardStats.totalGenerated,
        totalUnique: cardStats.totalUnique,
        totalDuplicates: cardStats.totalDuplicates,
        byMode: {
          random: cardStats.byMode.random || 0,
          sequential: cardStats.byMode.sequential || 0,
          batch999: cardStats.byMode.batch_999 || 0,
        },
      },
      topBins: cardStats.byBin.slice(0, 10),
      topCountries: cardStats.byCountry.slice(0, 10),
      topUsers,
      performance: {
        avgResponseTime: performanceMetrics.avgResponseTime,
        p95ResponseTime: performanceMetrics.p95ResponseTime,
        p99ResponseTime: performanceMetrics.p99ResponseTime,
        totalRequests: performanceMetrics.totalRequests,
        successRate: performanceMetrics.successRate,
      },
    };

    // Cache result (5 minute TTL)
    await statisticsCacheService.set(cacheKey, result, 300);

    const queryDuration = (Date.now() - queryStartTime) / 1000;
    recordCardStatisticsQuery('realtime', queryDuration);

    return result;
  }

  /**
   * Get statistics for a specific date
   */
  public async getStatisticsByDate(date: Date) {
    const queryStartTime = Date.now();
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0];
    
    // Check Redis cache (1 hour TTL for historical data)
    const cacheKey = `date:${dateStr}`;
    const cached = await statisticsCacheService.get(cacheKey);
    if (cached.hit && cached.data) {
      logger.debug('Statistics by date cache hit', { date: dateStr });
      const queryDuration = (Date.now() - queryStartTime) / 1000;
      recordCardStatisticsQuery('by_date', queryDuration);
      return cached.data;
    }

    const result = await cardStatisticsModel.findByDate(date);
    
    // Cache result if found (1 hour TTL)
    if (result) {
      await statisticsCacheService.set(cacheKey, result, 3600);
    }

    const queryDuration = (Date.now() - queryStartTime) / 1000;
    recordCardStatisticsQuery('by_date', queryDuration);

    return result;
  }

  /**
   * Get statistics for a date range
   */
  public async getStatisticsByDateRange(startDate: Date, endDate: Date) {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return await cardStatisticsModel.findByDateRange(startDate, endDate);
  }

  /**
   * Get aggregated statistics for a date range
   */
  public async getAggregatedStatistics(startDate: Date, endDate: Date) {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return await cardStatisticsModel.getAggregatedStatistics(startDate, endDate);
  }

  /**
   * Get latest statistics (last N days)
   */
  public async getLatestStatistics(days: number = 30) {
    return await cardStatisticsModel.getLatest(days);
  }

  /**
   * Get statistics for a specific BIN
   */
  public async getStatisticsByBin(bin: string) {
    const queryStartTime = Date.now();
    
    // Check Redis cache (15 minute TTL)
    const cacheKey = `bin:${bin}`;
    const cached = await statisticsCacheService.get(cacheKey);
    if (cached.hit && cached.data) {
      logger.debug('Statistics by BIN cache hit', { bin });
      const queryDuration = (Date.now() - queryStartTime) / 1000;
      recordCardStatisticsQuery('by_bin', queryDuration);
      return cached.data;
    }

    const cards = await generatedCardModel.findByBin(bin, 10000, 0);
    
    const byMode: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    
    for (const card of cards.cards) {
      byMode[card.generationMode] = (byMode[card.generationMode] || 0) + 1;
      if (card.countryCode) {
        byCountry[card.countryCode] = (byCountry[card.countryCode] || 0) + 1;
      }
    }

    const result = {
      bin,
      totalGenerated: cards.total,
      byMode,
      byCountry,
      uniqueCards: new Set(cards.cards.map(c => c.cardHash)).size,
    };

    // Cache result (15 minute TTL)
    await statisticsCacheService.set(cacheKey, result, 900);

    const queryDuration = (Date.now() - queryStartTime) / 1000;
    recordCardStatisticsQuery('by_bin', queryDuration);

    return result;
  }
}

export const cardStatisticsService = new CardStatisticsService();
