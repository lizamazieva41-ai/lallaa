import { Router, Request, Response } from 'express';
import * as validateController from '../../controllers/bin/validate';
import { authenticate } from '../../middleware/auth';
import { rateLimiterMiddleware } from '../../middleware/rateLimit';

const router = Router();

/**
 * Enhanced Validation Routes
 */

/**
 * @route POST /api/v1/bin/validate
 * @description Validate card number using Braintree validation
 * @body {string} cardNumber - Card number to validate
 * @access Authenticated
 */
router.post(
  '/',
  authenticate,
  rateLimiterMiddleware,
  validateController.validateCardNumber
);

/**
 * @route POST /api/v1/bin/validate/realtime
 * @description Real-time validation as user types
 * @body {string} cardNumber - Partial or complete card number
 * @access Authenticated
 */
router.post(
  '/realtime',
  authenticate,
  rateLimiterMiddleware,
  validateController.validateRealTime
);

/**
 * @route POST /api/v1/bin/validate/format
 * @description Format and validate card number
 * @body {string} cardNumber - Card number to format and validate
 * @access Authenticated
 */
router.post(
  '/format',
  authenticate,
  rateLimiterMiddleware,
  validateController.formatAndValidate
);

export default router;
