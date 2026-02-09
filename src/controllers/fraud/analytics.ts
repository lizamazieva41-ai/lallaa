import { Request, Response } from 'express';

import { streamProcessor } from '../../services/fraudAnalytics/streamProcessor';

export const getAlerts = (req: Request, res: Response): void => {
  const limit = parseInt(String(req.query.limit || '100'), 10);
  const alerts = streamProcessor.getRecentAlerts(Number.isFinite(limit) ? limit : 100);
  res.status(200).json({ success: true, data: { alerts, count: alerts.length } });
};

