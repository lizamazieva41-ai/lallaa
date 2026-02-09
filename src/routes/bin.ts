import { Router } from 'express';
import * as binController from '../controllers/bin';
import validateRouter from './bin/validate';
import { authenticate, optionalAuth } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/bin/:bin
 * @description Lookup BIN information
 * @access Private
 */
router.get(
  '/:bin',
  rateLimiterMiddleware(),
  binController.lookupBIN
);

/**
 * @route GET /api/v1/bin
 * @description Search BINs with filters
 * @access Private
 */
router.get(
  '/',
  rateLimiterMiddleware(),
  binController.searchBINs
);

/**
 * @route GET /api/v1/bin/country/:countryCode
 * @description Get BINs by country
 * @access Private
 */
router.get(
  '/country/:countryCode',
  rateLimiterMiddleware(),
  binController.getBINsByCountry
);

/**
 * @route GET /api/v1/bin/stats
 * @description Get BIN statistics
 * @access Private
 */
router.get(
  '/stats',
  rateLimiterMiddleware(),
  binController.getBINStatistics
);

/**
 * @route POST /api/v1/bin/validate
 * @description Validate BIN format
 * @access Private
 */
router.post(
  '/validate',
  rateLimiterMiddleware(),
  binController.validateBIN
);

/**
 * Enhanced validation routes (Braintree validation, real-time validation)
 */
router.use('/validate', validateRouter);

export default router;
