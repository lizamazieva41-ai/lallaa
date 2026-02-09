import { Request, Response, NextFunction } from 'express';
import { manualReviewQueue } from '../../services/conflictResolution/manualReviewQueue';
import { asyncHandler, sendSuccess, sendError, NotFoundError, ValidationError } from '../../middleware/error';
import { logger } from '../../utils/logger';

/**
 * Normalize req.params.id to string
 */
const normalizeParamId = (id: string | string[] | undefined): string => {
  if (Array.isArray(id)) {
    return id[0];
  }
  if (typeof id === 'string') {
    return id;
  }
  throw new ValidationError('ID parameter is required');
};

/**
 * Get all conflicts in manual review queue
 */
export const getConflicts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const bin = req.query.bin as string | undefined;

    let items = manualReviewQueue.getPendingItems();

    if (status) {
      items = items.filter(item => item.status === status);
    }

    if (priority) {
      items = items.filter(item => item.priority === priority);
    }

    if (bin) {
      items = items.filter(item => item.bin === bin);
    }

    // Sort by priority and creation date
    items.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    sendSuccess(
      res,
      {
        items,
        total: items.length,
      },
      req.requestId,
      req.rateLimit
    );
  }
);

/**
 * Get specific conflict by ID
 */
export const getConflictById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = normalizeParamId(req.params.id);

    const item = manualReviewQueue.getItem(id);

    if (!item) {
      throw new NotFoundError(`Conflict ${id} not found`);
    }

    sendSuccess(res, item, req.requestId, req.rateLimit);
  }
);

/**
 * Assign conflict to reviewer
 */
export const assignConflict = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = normalizeParamId(req.params.id);
    const { assignedTo } = req.body;

    if (!assignedTo) {
      throw new ValidationError('assignedTo is required');
    }

    const success = manualReviewQueue.assignItem(id, assignedTo);

    if (!success) {
      throw new NotFoundError(`Conflict ${id} not found`);
    }

    logger.info('Conflict assigned', { id, assignedTo, assignedBy: req.userId });

    sendSuccess(
      res,
      {
        id,
        assignedTo,
        status: 'in-progress',
      },
      req.requestId,
      req.rateLimit
    );
  }
);

/**
 * Resolve conflict manually
 */
export const resolveConflict = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = normalizeParamId(req.params.id);
    const { resolutionNotes, resolvedValue } = req.body;

    if (!resolutionNotes) {
      throw new ValidationError('resolutionNotes is required');
    }

    const success = manualReviewQueue.resolveItem(id, resolutionNotes, resolvedValue);

    if (!success) {
      throw new NotFoundError(`Conflict ${id} not found`);
    }

    logger.info('Conflict resolved', { id, resolvedBy: req.userId, resolutionNotes });

    const item = manualReviewQueue.getItem(id);

    sendSuccess(
      res,
      {
        id,
        status: 'resolved',
        resolutionNotes,
        resolvedValue: item?.conflictResolution.resolution.resolvedValue,
      },
      req.requestId,
      req.rateLimit
    );
  }
);

/**
 * Dismiss conflict
 */
export const dismissConflict = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = normalizeParamId(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      throw new ValidationError('reason is required');
    }

    const success = manualReviewQueue.dismissItem(id, reason);

    if (!success) {
      throw new NotFoundError(`Conflict ${id} not found`);
    }

    logger.info('Conflict dismissed', { id, dismissedBy: req.userId, reason });

    sendSuccess(
      res,
      {
        id,
        status: 'dismissed',
        reason,
      },
      req.requestId,
      req.rateLimit
    );
  }
);

/**
 * Get conflict resolution statistics
 */
export const getConflictStatistics = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const stats = manualReviewQueue.getStatistics();

    sendSuccess(res, stats, req.requestId, req.rateLimit);
  }
);
