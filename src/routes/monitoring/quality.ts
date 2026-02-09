import { Router, Request, Response } from 'express';
import * as qualityController from '../../controllers/monitoring/quality';
import { authenticate, authorize } from '../../middleware/auth';
import { adminRateLimiter } from '../../middleware/rateLimit';
import { UserRole } from '../../types';

const router = Router();

/**
 * Quality Monitoring Routes
 * All routes require admin authentication
 */

/**
 * @route GET /api/v1/monitoring/quality
 * @description Get current quality metrics
 * @access Admin
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.getQualityMetrics
);

/**
 * @route GET /api/v1/monitoring/quality/dashboard
 * @description Get quality dashboard data (metrics, trends, anomalies, alerts)
 * @access Admin
 */
router.get(
  '/dashboard',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.getDashboard
);

/**
 * @route GET /api/v1/monitoring/quality/trends
 * @description Get quality trends for specified period
 * @query {string} period - Trend period (30d, 60d, 90d)
 * @access Admin
 */
router.get(
  '/trends',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.getTrends
);

/**
 * @route GET /api/v1/monitoring/quality/anomalies
 * @description Get detected anomalies
 * @query {string} severity - Filter by severity (low, medium, high, critical)
 * @access Admin
 */
router.get(
  '/anomalies',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.getAnomalies
);

/**
 * @route GET /api/v1/monitoring/quality/alerts
 * @description Get quality alerts
 * @query {string} severity - Filter by severity
 * @access Admin
 */
router.get(
  '/alerts',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.getAlerts
);

/**
 * @route POST /api/v1/monitoring/quality/collect
 * @description Manually trigger quality metrics collection
 * @access Admin
 */
router.post(
  '/collect',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.collectMetrics
);

/**
 * @route GET /api/v1/monitoring/quality/status
 * @description Get monitoring status
 * @access Admin
 */
router.get(
  '/status',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  qualityController.getStatus
);

export default router;
