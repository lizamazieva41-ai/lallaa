import { Router } from 'express';

import * as fraudScoreController from '../../controllers/fraud/score';
import { authenticate } from '../../middleware/auth';
import { rateLimiterMiddleware } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);
router.use(rateLimiterMiddleware());

router.post('/score', fraudScoreController.scoreSingle);
router.post('/score/batch', fraudScoreController.scoreBatch);

export default router;

