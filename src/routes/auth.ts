import { Router } from 'express';
import * as authController from '../controllers/auth';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authRateLimiter, apiKeyRateLimiter } from '../middleware/rateLimit';
import { rateLimiterMiddleware } from '../middleware/rateLimit';

const router = Router();

/**
 * @route POST /api/v1/auth/register
 * @description Register a new user account
 * @access Public
 */
router.post(
  '/register',
  authRateLimiter,
  authController.register
);

/**
 * @route POST /api/v1/auth/login
 * @description Login with email and password
 * @access Public
 */
router.post(
  '/login',
  authRateLimiter,
  authController.login
);

/**
 * @route POST /api/v1/auth/refresh
 * @description Refresh access token using refresh token
 * @access Public
 */
router.post(
  '/refresh',
  rateLimiterMiddleware({ points: 20, duration: 60 }),
  authController.refreshToken
);

/**
 * @route POST /api/v1/auth/logout
 * @description Logout and invalidate tokens
 * @access Private
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route GET /api/v1/auth/me
 * @description Get current authenticated user
 * @access Private
 */
router.get(
  '/me',
  authenticate,
  authController.getCurrentUser
);

/**
 * @route POST /api/v1/auth/change-password
 * @description Change user password
 * @access Private
 */
router.post(
  '/change-password',
  authenticate,
  rateLimiterMiddleware({ points: 5, duration: 60 * 15 }),
  authController.changePassword
);

/**
 * @route POST /api/v1/auth/reset-password/request
 * @description Request password reset email
 * @access Public
 */
router.post(
  '/reset-password/request',
  authRateLimiter,
  authController.requestPasswordReset
);

/**
 * @route POST /api/v1/auth/reset-password
 * @description Reset password with token
 * @access Public
 */
router.post(
  '/reset-password',
  authRateLimiter,
  authController.resetPassword
);

// 2FA Management

/**
 * @route POST /api/v1/auth/2fa/setup
 * @description Setup 2FA for user account
 * @access Private
 */
router.post(
  '/2fa/setup',
  authenticate,
  rateLimiterMiddleware({ points: 3, duration: 60 * 5 }),
  authController.setupTwoFactor
);

/**
 * @route POST /api/v1/auth/2fa/verify
 * @description Verify 2FA token and enable 2FA
 * @access Private
 */
router.post(
  '/2fa/verify',
  authenticate,
  rateLimiterMiddleware({ points: 10, duration: 60 * 5 }),
  authController.verifyTwoFactor
);

/**
 * @route POST /api/v1/auth/2fa/disable
 * @description Disable 2FA for user account
 * @access Private
 */
router.post(
  '/2fa/disable',
  authenticate,
  rateLimiterMiddleware({ points: 3, duration: 60 * 5 }),
  authController.disableTwoFactor
);

/**
 * @route POST /api/v1/auth/2fa/backup-codes/regenerate
 * @description Regenerate backup codes
 * @access Private
 */
router.post(
  '/2fa/backup-codes/regenerate',
  authenticate,
  rateLimiterMiddleware({ points: 3, duration: 60 * 60 }),
  authController.regenerateBackupCodes
);

// API Keys Management

/**
 * @route POST /api/v1/auth/api-keys
 * @description Create a new API key
 * @access Private
 */
router.post(
  '/api-keys',
  authenticate,
  apiKeyRateLimiter,
  authController.createAPIKey
);

/**
 * @route GET /api/v1/auth/api-keys
 * @description List all API keys for the current user
 * @access Private
 */
router.get(
  '/api-keys',
  authenticate,
  authController.getAPIKeys
);

/**
 * @route DELETE /api/v1/auth/api-keys/:keyId
 * @description Revoke an API key
 * @access Private
 */
router.delete(
  '/api-keys/:keyId',
  authenticate,
  authController.revokeAPIKey
);

/**
 * @route POST /api/v1/auth/api-keys/:keyId/rotate
 * @description Rotate (regenerate) an API key
 * @access Private
 */
router.post(
  '/api-keys/:keyId/rotate',
  authenticate,
  apiKeyRateLimiter,
  authController.rotateAPIKey
);

export default router;
