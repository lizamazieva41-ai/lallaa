import { Router } from 'express';
import * as ibanController from '../controllers/iban';
import { authenticate, optionalAuth } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/v1/iban/validate
 * @description Validate IBAN
 * @access Private
 */
router.post(
  '/validate',
  rateLimiterMiddleware(),
  ibanController.validateIBAN
);

/**
 * @route POST /api/v1/iban/generate
 * @description Generate valid IBAN
 * @access Private
 */
router.post(
  '/generate',
  rateLimiterMiddleware(),
  ibanController.generateIBAN
);

/**
 * @route POST /api/v1/iban/parse
 * @description Parse IBAN and extract components
 * @access Private
 */
router.post(
  '/parse',
  rateLimiterMiddleware(),
  ibanController.parseIBAN
);

/**
 * @route POST /api/v1/iban/batch-validate
 * @description Batch validate multiple IBANs
 * @access Private
 */
router.post(
  '/batch-validate',
  rateLimiterMiddleware(),
  ibanController.batchValidateIBANs
);

/**
 * @route POST /api/v1/iban/convert
 * @description Convert IBAN between formats (human/machine readable)
 * @access Private
 */
router.post(
  '/convert',
  rateLimiterMiddleware(),
  ibanController.convertIBAN
);

/**
 * @route GET /api/v1/iban/test/:countryCode
 * @description Generate test IBAN for a country
 * @access Private
 */
router.get(
  '/test/:countryCode',
  rateLimiterMiddleware(),
  ibanController.generateTestIBAN
);

export default router;
