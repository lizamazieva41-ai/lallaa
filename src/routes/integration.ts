import { Router } from 'express';
import { integrationController } from '../controllers/integration';
import { authenticate } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/v1/integration/workflow/start
 * @description Start a new card verification workflow
 * @access Private
 * @body {bin: string, cardCount?: number, expiryMonths?: number, sequential?: boolean}
 */
router.post(
  '/workflow/start',
  rateLimiterMiddleware(),
  integrationController.startWorkflow.bind(integrationController)
);

/**
 * @route GET /api/v1/integration/workflow/:workflowId/status
 * @description Get workflow status
 * @access Private
 */
router.get(
  '/workflow/:workflowId/status',
  rateLimiterMiddleware(),
  integrationController.getWorkflowStatus.bind(integrationController)
);

/**
 * @route GET /api/v1/integration/workflow/:workflowId/result
 * @description Get workflow result (Excel file)
 * @access Private
 */
router.get(
  '/workflow/:workflowId/result',
  rateLimiterMiddleware(),
  integrationController.getWorkflowResult.bind(integrationController)
);

export default router;
