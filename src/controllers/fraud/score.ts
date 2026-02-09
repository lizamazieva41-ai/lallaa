import { Request, Response } from 'express';

import { fraudScorer } from '../../services/fraudDetection/fraudScorer';
import { logger } from '../../utils/logger';

export const scoreSingle = (req: Request, res: Response): void => {
  try {
    const input = req.body || {};
    const result = fraudScorer.score(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('Fraud score failed', { error });
    res.status(500).json({ success: false, message: 'Fraud scoring failed' });
  }
};

export const scoreBatch = (req: Request, res: Response): void => {
  try {
    const inputs = Array.isArray(req.body?.items) ? req.body.items : [];
    const results = fraudScorer.scoreBatch(inputs);
    res.status(200).json({ success: true, data: { results, count: results.length } });
  } catch (error) {
    logger.error('Fraud batch score failed', { error });
    res.status(500).json({ success: false, message: 'Fraud batch scoring failed' });
  }
};

