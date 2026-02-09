import { Request, Response, NextFunction } from 'express';
import { dataQualityMonitor } from '../../monitoring/dataQualityMonitor';
import { asyncHandler, sendSuccess, sendError } from '../../middleware/error';
import { logger } from '../../utils/logger';

/**
 * Get current quality metrics
 */
export const getQualityMetrics = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await dataQualityMonitor.collectMetrics();

    sendSuccess(res, {
      metrics: result.currentMetrics,
      timestamp: result.timestamp,
    }, req.requestId, req.rateLimit);
  }
);

/**
 * Get quality dashboard data
 */
export const getDashboard = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const dashboardData = await dataQualityMonitor.getDashboardData();

    sendSuccess(res, dashboardData, req.requestId, req.rateLimit);
  }
);

/**
 * Get quality trends
 */
export const getTrends = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const period = (req.query.period as '30d' | '60d' | '90d') || '30d';

    const result = await dataQualityMonitor.collectMetrics();
    const trends = result.trendAnalysis;

    sendSuccess(res, {
      period,
      trends,
    }, req.requestId, req.rateLimit);
  }
);

/**
 * Get detected anomalies
 */
export const getAnomalies = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const severity = req.query.severity as string | undefined;

    const result = await dataQualityMonitor.collectMetrics();
    let anomalies = result.anomalies.anomalies;

    if (severity) {
      anomalies = anomalies.filter(a => a.severity === severity);
    }

    sendSuccess(res, {
      anomalies,
      summary: result.anomalies.summary,
    }, req.requestId, req.rateLimit);
  }
);

/**
 * Get quality alerts
 */
export const getAlerts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const severity = req.query.severity as string | undefined;

    const result = await dataQualityMonitor.collectMetrics();
    let alerts = result.alerts;

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    sendSuccess(res, {
      alerts,
      total: alerts.length,
    }, req.requestId, req.rateLimit);
  }
);

/**
 * Manually trigger quality metrics collection
 */
export const collectMetrics = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await dataQualityMonitor.collectMetrics();

    logger.info('Quality metrics collected manually', {
      collectedBy: req.userId,
      overallScore: result.currentMetrics.overall.overallScore,
      anomalies: result.anomalies.summary.total,
    });

    sendSuccess(res, {
      message: 'Quality metrics collected successfully',
      result,
    }, req.requestId, req.rateLimit);
  }
);

/**
 * Get monitoring status
 */
export const getStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const status = dataQualityMonitor.getStatus();

    sendSuccess(res, status, req.requestId, req.rateLimit);
  }
);
