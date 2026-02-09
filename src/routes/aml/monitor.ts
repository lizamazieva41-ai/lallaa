import { Router } from 'express';

import * as amlController from '../../controllers/aml/monitor';
import { authenticate } from '../../middleware/auth';
import { rateLimiterMiddleware } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);
router.use(rateLimiterMiddleware());

router.get('/rules', amlController.listRules);
router.post('/evaluate', amlController.evaluateTransaction);
router.post('/cases/:caseId/sar', amlController.generateSAR);

export default router;

