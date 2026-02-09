import { Request, Response } from 'express';
import { cardStatisticsService } from '../services/cardStatistics';
import { logger } from '../utils/logger';

export class CardStatisticsController {
  /**
   * Get real-time statistics for today
   * GET /api/v1/cards/statistics
   */
  public async getRealTimeStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await cardStatisticsService.getRealTimeStatistics();

      res.json({
        success: true,
        data: statistics,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get real-time statistics', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch real-time statistics',
        },
      });
    }
  }

  /**
   * Get statistics for a specific date
   * GET /api/v1/cards/statistics/:date
   */
  public async getStatisticsByDate(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.params;

      if (!date || Array.isArray(date)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_DATE',
            message: 'Date parameter is required (YYYY-MM-DD format)',
          },
        });
        return;
      }

      const targetDate = new Date(date as string);
      if (isNaN(targetDate.getTime())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid date format. Use YYYY-MM-DD',
          },
        });
        return;
      }

      const statistics = await cardStatisticsService.getStatisticsByDate(targetDate);

      if (!statistics) {
        res.status(404).json({
          success: false,
          error: {
            code: 'STATS_NOT_FOUND',
            message: `Statistics not found for date ${date}`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: statistics,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get statistics by date', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch statistics',
        },
      });
    }
  }

  /**
   * Get statistics for a date range
   * GET /api/v1/cards/statistics/range?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  public async getStatisticsByDateRange(req: Request, res: Response): Promise<void> {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'Both start and end date parameters are required (YYYY-MM-DD format)',
          },
        });
        return;
      }

      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid date format. Use YYYY-MM-DD',
          },
        });
        return;
      }

      if (startDate > endDate) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RANGE',
            message: 'Start date must be before or equal to end date',
          },
        });
        return;
      }

      const statistics = await cardStatisticsService.getStatisticsByDateRange(startDate, endDate);

      res.json({
        success: true,
        data: {
          statistics,
          count: statistics.length,
          dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get statistics by date range', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch statistics',
        },
      });
    }
  }

  /**
   * Get aggregated statistics for a date range
   * GET /api/v1/cards/statistics/aggregated?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  public async getAggregatedStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'Both start and end date parameters are required (YYYY-MM-DD format)',
          },
        });
        return;
      }

      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid date format. Use YYYY-MM-DD',
          },
        });
        return;
      }

      const statistics = await cardStatisticsService.getAggregatedStatistics(startDate, endDate);

      res.json({
        success: true,
        data: {
          ...statistics,
          dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get aggregated statistics', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch aggregated statistics',
        },
      });
    }
  }

  /**
   * Get latest statistics (last N days)
   * GET /api/v1/cards/statistics/latest?days=30
   */
  public async getLatestStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { days } = req.query;
      const daysNum = days ? parseInt(days as string, 10) : 30;

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DAYS',
            message: 'Days parameter must be between 1 and 365',
          },
        });
        return;
      }

      const statistics = await cardStatisticsService.getLatestStatistics(daysNum);

      res.json({
        success: true,
        data: {
          statistics,
          count: statistics.length,
          days: daysNum,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get latest statistics', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch latest statistics',
        },
      });
    }
  }

  /**
   * Get statistics for a specific BIN
   * GET /api/v1/cards/statistics/bin/:bin
   */
  public async getStatisticsByBin(req: Request, res: Response): Promise<void> {
    try {
      const { bin } = req.params;

      if (!bin || Array.isArray(bin) || !/^\d{6,8}$/.test(bin)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BIN',
            message: 'BIN must be 6-8 digits',
          },
        });
        return;
      }

      const statistics = await cardStatisticsService.getStatisticsByBin(bin as string);

      res.json({
        success: true,
        data: statistics,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get statistics by BIN', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch statistics for BIN',
        },
      });
    }
  }
}

export const cardStatisticsController = new CardStatisticsController();
