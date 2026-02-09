import { Router } from 'express';
import { cardController } from '../controllers/cards';
import { body, query, param, validationResult } from 'express-validator';
import { authenticate, authenticateAPIKey, authorize } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';
import { secureCardGeneration, secureTestCards } from '../middleware/featureFlags';

const router = Router();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: errors.array(),
      },
    });
  }
  next();
};

// Credit Card Generation Routes - Requires authentication + feature flags + stricter rate limiting
router.get(
  '/generate',
  ...secureCardGeneration,
  authenticate,
  rateLimiterMiddleware({ 
    points: 5,    // Default points for free tier - will be adjusted based on user tier
    duration: 60 * 60, // 1 hour window
  }),
  [
    query('vendor')
      .isString()
      .isIn(['visa', 'mastercard', 'amex', 'diners', 'discover', 'enroute', 'jcb', 'voyager'])
      .withMessage('Vendor must be one of: visa, mastercard, amex, diners, discover, enroute, jcb, voyager'),
    query('count')
      .optional()
      .isInt({ min: 1, max: 10 }) // Reduced max from 100 to 10 for security
      .withMessage('Count must be between 1 and 10'),
  ],
  handleValidationErrors,
  cardController.generateCards.bind(cardController)
);

router.get(
  '/vendors',
  cardController.getSupportedVendors.bind(cardController)
);

// Generate card from BIN - Requires authentication + feature flags + rate limiting
router.post(
  '/generate-from-bin',
  ...secureCardGeneration,
  authenticate,
  rateLimiterMiddleware({ 
    points: 5,    // Default points for free tier - will be adjusted based on user tier
    duration: 60 * 60, // 1 hour window
  }),
  [
    body('bin')
      .isString()
      .matches(/^\d{6,8}$/)
      .withMessage('BIN must be 6-8 digits'),
    body('expiryMonths')
      .optional()
      .isInt({ min: 1, max: 120 })
      .withMessage('Expiry months must be between 1 and 120'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Count must be between 1 and 10'),
    body('sequential')
      .optional()
      .isBoolean()
      .withMessage('Sequential must be a boolean'),
    body('startSequence')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Start sequence must be a non-negative integer'),
    body('cvv')
      .optional()
      .isString()
      .matches(/^\d{3,4}$/)
      .withMessage('CVV must be 3 or 4 digits'),
    body('generate999')
      .optional()
      .isBoolean()
      .withMessage('Generate999 must be a boolean'),
  ],
  handleValidationErrors,
  cardController.generateCardFromBIN.bind(cardController)
);

// Test Payment Cards Routes - Require authentication + feature flags
router.get(
  '/gateways',
  ...secureTestCards,
  authenticate,
  cardController.getGateways.bind(cardController)
);

router.get(
  '/gateways/:slug',
  ...secureTestCards,
  authenticate,
  [
    param('slug')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Gateway slug must be between 1 and 50 characters'),
  ],
  handleValidationErrors,
  cardController.getGatewayBySlug.bind(cardController)
);

router.get(
  '/gateways/:slug/cards',
  ...secureTestCards,
  authenticate,
  rateLimiterMiddleware({ 
    points: 10,   // Default points for free tier - will be adjusted based on user tier
    duration: 60 * 60, // 1 hour window
  }),
  [
    param('slug')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Gateway slug must be between 1 and 50 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }) // Reduced max from 100 to 50
      .withMessage('Limit must be between 1 and 50'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
  ],
  handleValidationErrors,
  cardController.getTestCardsByGateway.bind(cardController)
);

router.get(
  '/search',
  ...secureTestCards,
  authenticate,
  rateLimiterMiddleware({ 
    points: 10,   // Default points for free tier - will be adjusted based on user tier
    duration: 60 * 60, // 1 hour window
  }),
  [
    query('gatewaySlug')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Gateway slug must be between 1 and 50 characters'),
    query('brand')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Brand must be between 1 and 50 characters'),
    query('expectedResult')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Expected result must be between 1 and 100 characters'),
    query('is3dsEnrolled')
      .optional()
      .isBoolean()
      .withMessage('is3dsEnrolled must be a boolean'),
    query('cardType')
      .optional()
      .isIn(['credit', 'debit', 'prepaid'])
      .withMessage('Card type must be one of: credit, debit, prepaid'),
    query('region')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Region must be between 1 and 50 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }) // Reduced max from 100 to 50
      .withMessage('Limit must be between 1 and 50'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
  ],
  handleValidationErrors,
  cardController.getTestCards.bind(cardController)
);

router.get(
  '/statistics',
  authenticate,
  authorize('admin', 'premium'), // Only admin and premium users can access statistics
  cardController.getStatistics.bind(cardController)
);

// Async Job Endpoints
router.post(
  '/generate-async',
  ...secureCardGeneration,
  authenticate,
  rateLimiterMiddleware({
    points: 10, // Higher limit for async jobs
    duration: 60 * 60, // 1 hour window
  }),
  [
    body('bin')
      .isString()
      .matches(/^\d{6,8}$/)
      .withMessage('BIN must be 6-8 digits'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Count must be between 1 and 10000'),
    body('expiryMonths')
      .optional()
      .isInt({ min: 1, max: 120 })
      .withMessage('Expiry months must be between 1 and 120'),
    body('sequential')
      .optional()
      .isBoolean()
      .withMessage('Sequential must be a boolean'),
    body('startSequence')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Start sequence must be a non-negative integer'),
    body('generate999')
      .optional()
      .isBoolean()
      .withMessage('Generate999 must be a boolean'),
  ],
  handleValidationErrors,
  cardController.generateCardsAsync.bind(cardController)
);

router.get(
  '/jobs/:jobId/status',
  authenticate,
  [
    param('jobId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Job ID is required'),
  ],
  handleValidationErrors,
  cardController.getJobStatus.bind(cardController)
);

router.get(
  '/jobs/:jobId/result',
  authenticate,
  [
    param('jobId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Job ID is required'),
  ],
  handleValidationErrors,
  cardController.getJobResult.bind(cardController)
);

export default router;