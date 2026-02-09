import { Router } from 'express';
import { cardStatisticsController } from '../controllers/cardStatistics';
import { authenticate } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';

const router = Router();

/**
 * @route   GET /api/v1/cards/statistics
 * @desc    Get real-time statistics for today
 * @access  Private (authenticated)
 */
router.get(
  '/',
  authenticate,
  rateLimiterMiddleware(),
  cardStatisticsController.getRealTimeStatistics.bind(cardStatisticsController)
);

/**
 * @route   GET /api/v1/cards/statistics/latest
 * @desc    Get latest statistics (last N days)
 * @access  Private (authenticated)
 */
router.get(
  '/latest',
  authenticate,
  rateLimiterMiddleware(),
  cardStatisticsController.getLatestStatistics.bind(cardStatisticsController)
);

/**
 * @route   GET /api/v1/cards/statistics/range
 * @desc    Get statistics for a date range
 * @access  Private (authenticated)
 */
router.get(
  '/range',
  authenticate,
  rateLimiterMiddleware(),
  cardStatisticsController.getStatisticsByDateRange.bind(cardStatisticsController)
);

/**
 * @route   GET /api/v1/cards/statistics/aggregated
 * @desc    Get aggregated statistics for a date range
 * @access  Private (authenticated)
 */
router.get(
  '/aggregated',
  authenticate,
  rateLimiterMiddleware(),
  cardStatisticsController.getAggregatedStatistics.bind(cardStatisticsController)
);

/**
 * @route   GET /api/v1/cards/statistics/bin/:bin
 * @desc    Get statistics for a specific BIN
 * @access  Private (authenticated)
 */
router.get(
  '/bin/:bin',
  authenticate,
  rateLimiterMiddleware(),
  cardStatisticsController.getStatisticsByBin.bind(cardStatisticsController)
);

/**
 * @route   GET /api/v1/cards/statistics/:date
 * @desc    Get statistics for a specific date (YYYY-MM-DD)
 * @access  Private (authenticated)
 */
router.get(
  '/:date',
  authenticate,
  rateLimiterMiddleware(),
  cardStatisticsController.getStatisticsByDate.bind(cardStatisticsController)
);

export default router;
