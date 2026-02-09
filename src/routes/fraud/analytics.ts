import { Router } from 'express';

import * as fraudAnalyticsController from '../../controllers/fraud/analytics';
import { authenticate } from '../../middleware/auth';
import { rateLimiterMiddleware } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);
router.use(rateLimiterMiddleware());

router.get('/alerts', fraudAnalyticsController.getAlerts);

export default router;

