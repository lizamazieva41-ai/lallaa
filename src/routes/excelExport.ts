import { Router } from 'express';
import { excelExportController } from '../controllers/excelExport';
import { authenticate } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/v1/excel/export
 * @description Export cards to Excel format
 * @access Private
 * @body {bin: string, cardCount?: number, expiryMonths?: number, sequential?: boolean}
 */
router.post(
  '/export',
  rateLimiterMiddleware(),
  excelExportController.exportCards.bind(excelExportController)
);

export default router;
