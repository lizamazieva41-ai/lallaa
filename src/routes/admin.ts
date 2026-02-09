import { Router, Request, Response, NextFunction } from 'express';
import * as adminController from '../controllers/admin';
import conflictsRouter from './admin/conflicts';
import { authenticate, authorize } from '../middleware/auth';
import { adminRateLimiter, adminSensitiveRateLimiter } from '../middleware/rateLimit';
import { validateAdminRequest, adminBinLookupSchema, adminBinSourceSchema, adminETLHistorySchema } from '../middleware/adminValidation';
import { binService } from '../services/bin';
import { logger } from '../utils/logger';
import { UserRole } from '../types';

const router = Router();

/**
 * Admin Routes
 * These routes expose full BIN data including provenance fields (source, source_version, import_date)
 * All routes require admin authentication
 */

/**
 * @route GET /api/v1/admin/bin/:bin
 * @description Get full BIN record with provenance data (admin only)
 * @access Admin
 * @returns {Object} Complete BIN information including provenance
 */
router.get('/bin/:bin', validateAdminRequest(adminBinLookupSchema), adminRateLimiter, authorize(UserRole.ADMIN), adminController.adminLookupBIN);

/**
 * @route GET /api/v1/admin/bins/source
 * @description Get all BINs from a specific data source
 * @query {string} source - Data source name (e.g., 'binlist/data')
 * @access Admin
 */
router.get('/bins/source', validateAdminRequest(adminBinSourceSchema), adminRateLimiter, authorize(UserRole.ADMIN), adminController.getBINsBySource);

/**
 * @route GET /api/v1/admin/reports/source-quality
 * @description Get data quality report by source
 * @access Admin
 */
router.get('/reports/source-quality', adminRateLimiter, authorize(UserRole.ADMIN), adminController.getSourceQualityReport);

/**
 * @route GET /api/v1/admin/etl/history
 * @description Get ETL run history
 * @query {number} limit - Maximum number of records (default: 50, max: 100)
 * @access Admin
 * */
router.get('/etl/history', validateAdminRequest(adminETLHistorySchema), adminRateLimiter, authorize(UserRole.ADMIN), adminController.getETLRunHistory);

/**
 * @route POST /api/v1/admin/cache/clear
 * @description Clear lookup cache (admin user action)
 * @access Admin
 * */
router.post('/cache/clear', adminSensitiveRateLimiter, authorize(UserRole.ADMIN), adminController.clearCache);

/**
 * @route GET /api/v1/admin/cache/stats
 * @description Get cache statistics
 * @access Admin
 * */
router.get('/cache/stats', adminRateLimiter, authorize(UserRole.ADMIN), adminController.getCacheStats);

/**
 * @route POST /api/v1/admin/cache/flush
 * @description Flush cache for ETL operations
 * @access Admin
 */
router.post('/cache/flush', adminSensitiveRateLimiter, authorize(UserRole.ADMIN), (req: Request, res: Response, next: NextFunction) => {
  const previousSize = binService.getCacheStats().size;
  binService.clearCache();

  logger.info('Cache flushed by admin', {
    previousSize,
    adminUserId: req.userId,
    sourceIp: req.ip,
    action: 'admin_cache_flush',
  });

  res.json({
    success: true,
    message: 'Cache flushed successfully',
    flushedAt: new Date().toISOString(),
    previousSize,
  });
});

/**
 * Conflict management routes
 */
router.use('/conflicts', conflictsRouter);

export default router;