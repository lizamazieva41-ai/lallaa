import { Router, Request, Response } from 'express';
import * as conflictsController from '../../controllers/admin/conflicts';
import { authenticate, authorize } from '../../middleware/auth';
import { adminRateLimiter } from '../../middleware/rateLimit';
import { UserRole } from '../../types';

const router = Router();

/**
 * Admin Conflict Management Routes
 * All routes require admin authentication
 */

/**
 * @route GET /api/v1/admin/conflicts
 * @description Get all conflicts in manual review queue
 * @query {string} status - Filter by status (pending, in-progress, resolved, dismissed)
 * @query {string} priority - Filter by priority (low, medium, high, critical)
 * @query {string} bin - Filter by BIN
 * @access Admin
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  conflictsController.getConflicts
);

/**
 * @route GET /api/v1/admin/conflicts/:id
 * @description Get specific conflict by ID
 * @access Admin
 */
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  conflictsController.getConflictById
);

/**
 * @route POST /api/v1/admin/conflicts/:id/assign
 * @description Assign conflict to reviewer
 * @body {string} assignedTo - Reviewer user ID or email
 * @access Admin
 */
router.post(
  '/:id/assign',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  conflictsController.assignConflict
);

/**
 * @route POST /api/v1/admin/conflicts/:id/resolve
 * @description Resolve conflict manually
 * @body {string} resolutionNotes - Notes about the resolution
 * @body {any} resolvedValue - The resolved value (optional)
 * @access Admin
 */
router.post(
  '/:id/resolve',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  conflictsController.resolveConflict
);

/**
 * @route POST /api/v1/admin/conflicts/:id/dismiss
 * @description Dismiss conflict (not a real conflict)
 * @body {string} reason - Reason for dismissal
 * @access Admin
 */
router.post(
  '/:id/dismiss',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  conflictsController.dismissConflict
);

/**
 * @route GET /api/v1/admin/conflicts/statistics
 * @description Get conflict resolution statistics
 * @access Admin
 */
router.get(
  '/statistics',
  authenticate,
  authorize(UserRole.ADMIN),
  adminRateLimiter,
  conflictsController.getConflictStatistics
);

export default router;
