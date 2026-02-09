import { Request, Response, NextFunction } from 'express';
import { authorize } from '../middleware/auth';
import { UserRole } from '../types';
import { binService } from '../services/bin';
import { logger } from '../utils/logger';
import { asyncHandler, sendSuccess, sendError, ValidationError } from '../middleware/error';
import { getRequestParam } from '../utils/requestParams';

// Audit logging for admin actions
const logAdminAction = (
  action: string,
  userId: string,
  details?: Record<string, any>
) => {
  logger.info('Admin action performed', {
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Admin BIN lookup with full provenance data
export const adminLookupBIN = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const binValue = getRequestParam(req.params.bin);

    // Validate BIN format
    if (!binValue || !binService.validateBINFormat(binValue)) {
      throw new ValidationError('Invalid BIN format. BIN must be 6-8 digits.');
    }

    const result = await binService.lookup(binValue);

    if (!result) {
      logAdminAction('admin_lookup_bin', req.userId!, { bin: binValue, found: false });
      sendError(res, new ValidationError(`BIN ${binValue} not found in database`), req.requestId);
      return;
    }

      logAdminAction('admin_lookup_bin', req.userId!, { bin: binValue, found: true });
    sendSuccess(res, {
      bin: binValue,
      bank: result.bank,
      country: result.country,
      card: result.card,
      metadata: result.metadata,
    }, req.requestId, req.rateLimit);
  }
);

// Get BINs by source (admin only)
export const getBINsBySource = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sourceParam = req.query.source;
    const sourceValue = Array.isArray(sourceParam)
      ? typeof sourceParam[0] === 'string'
        ? sourceParam[0]
        : undefined
      : typeof sourceParam === 'string'
      ? sourceParam
      : undefined;

    // Validate source parameter
    if (!sourceValue) {
      throw new ValidationError('Source parameter is required and must be a string');
    }

    const bins = await binService.getBINsBySource(sourceValue);

    logAdminAction('admin_bins_by_source', req.userId!, { source: sourceValue });
    sendSuccess(res, {
      source: sourceValue,
      count: bins.length,
      bins: bins.map((bin) => ({
        bin: bin.bin,
        bankName: bin.bankName,
        bankNameLocal: bin.bankNameLocal,
        bankCode: bin.bankCode,
        cardType: bin.cardType,
        cardNetwork: bin.cardNetwork,
        importDate: bin.importDate?.toISOString(),
      })),
    }, req.requestId, req.rateLimit);
  }
);

// Get data quality report by source (admin only)
export const getSourceQualityReport = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const report = await binService.getSourceQualityReport();

    logAdminAction('admin_source_quality_report', req.userId!, { report });
    sendSuccess(res, {
      report,
      timestamp: new Date().toISOString(),
    }, req.requestId, req.rateLimit);
  }
);

// Get ETL run history (admin only)
export const getETLRunHistory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 50;
    const maxLimit = Math.min(limit, 100);
    const history = await binService.getETLRunHistory(maxLimit);

    logAdminAction('admin_etl_history', req.userId!, { limit, maxLimit });
    sendSuccess(res, {
      history: history.map((record) => ({
        id: record.id,
        source: record.source,
        version: record.version,
        recordCount: record.recordCount,
        status: record.status,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
      })),
    }, req.requestId, req.rateLimit);
  }
);

// Clear lookup cache (admin action)
export const clearCache = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    binService.clearCache();

    logAdminAction('admin_cache_clear', req.userId!, {
      previousSize: 0,
    });

    sendSuccess(res, {
      message: 'Cache cleared successfully',
    }, req.requestId);
  }
);

// Get cache statistics (admin only)
export const getCacheStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const stats = binService.getCacheStats();

    logAdminAction('admin_cache_stats', req.userId!, {
      cacheSize: stats.size,
    });

    sendSuccess(res, {
      stats,
    }, req.requestId, req.rateLimit);
  }
);
