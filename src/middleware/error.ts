import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import Joi from 'joi';
import { logger, logError } from '../utils/logger';
import { AppError, ApiResponse } from '../types';

// Custom error class
export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message, 400, code, true, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code, true);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', code: string = 'CONFLICT') {
    super(message, 409, code, true);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends AppError {
  retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }
}

export class UniquenessCheckError extends AppError {
  constructor(
    message: string = 'Uniqueness check failed',
    details?: Record<string, unknown>,
    code: string = 'UNIQUENESS_CHECK_FAILED'
  ) {
    super(message, 409, code, true, details);
    this.name = 'UniquenessCheckError';
  }
}

export class UniquenessReservationError extends AppError {
  constructor(
    message: string = 'Failed to reserve unique card hash',
    details?: Record<string, unknown>,
    code: string = 'UNIQUENESS_RESERVATION_FAILED'
  ) {
    super(message, 409, code, true, details);
    this.name = 'UniquenessReservationError';
  }
}

export class JobQueueError extends AppError {
  constructor(
    message: string = 'Job queue operation failed',
    details?: Record<string, unknown>,
    code: string = 'JOB_QUEUE_ERROR'
  ) {
    super(message, 500, code, true, details);
    this.name = 'JobQueueError';
  }
}

// Error response formatter
const formatErrorResponse = (
  error: AppError,
  requestId?: string
): ApiResponse<null> => {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || '',
    },
  };

  if (error.details) {
    response.error!.details = error.details;
  }

  return response;
};

// Global error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId || 'unknown';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/68f74db3-bc9b-4d85-afd1-80287a0b1f9b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'baseline',hypothesisId:'H4',location:'src/middleware/error.ts:errorHandler',message:'error.caught',data:{requestId,path:req.path,method:req.method,errName:(err as any)?.name,errMessage:err.message,errIsAppError:err instanceof AppError},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // Log the error with enhanced context for uniqueness issues
  if (err instanceof AppError && err.isOperational) {
    const logContext: any = {
      requestId,
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    };

    // Add specific context for uniqueness errors
    if (err instanceof UniquenessCheckError || err instanceof UniquenessReservationError) {
      logContext.errorType = 'uniqueness';
      logContext.details = err.details;
      logContext.userId = (req as any).userId;
      logContext.apiKeyId = (req as any).apiKeyId;
    }

    logger.warn('Operational error', logContext);
  } else {
    logError(err, {
      requestId,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      userId: (req as any).userId,
    });
  }

  // Handle different error types
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let recoverySuggestion: string | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;

    // Add recovery suggestions for specific error types
    if (err instanceof UniquenessCheckError) {
      recoverySuggestion = 'The card generation failed due to uniqueness constraints. Please try again with different parameters or use async generation for bulk operations.';
    } else if (err instanceof UniquenessReservationError) {
      recoverySuggestion = 'Failed to reserve card hash. This may be due to high concurrency. Please retry the request.';
    } else if (err instanceof JobQueueError) {
      recoverySuggestion = 'Job queue operation failed. Please check job status or retry the request.';
    } else if (err instanceof TooManyRequestsError) {
      recoverySuggestion = `Rate limit exceeded. Please wait ${err.retryAfter || 60} seconds before retrying.`;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';

    const details: Record<string, unknown> = {};
    const response = formatErrorResponse(
      new AppError(message, statusCode, code, true, details),
      requestId
    );
    res.status(statusCode).json(response);
    return;
  } else if (err instanceof Joi.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';

    const details: Record<string, unknown> = {};
    err.details.forEach((e) => {
      const path = e.path.join('.');
      details[path] = {
        message: e.message,
        type: e.type,
      };
    });

    const response = formatErrorResponse(
      new AppError(message, statusCode, code, true, details),
      requestId
    );
    res.status(statusCode).json(response);
    return;
  }

  // Send error response
  const errorResponse = formatErrorResponse(
    new AppError(message, statusCode, code, false, (err as any).details),
    requestId
  );

  // Add recovery suggestion if available
  if (recoverySuggestion && errorResponse.error) {
    errorResponse.error.details = {
      ...errorResponse.error.details,
      recoverySuggestion,
    };
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

// Async handler wrapper to catch errors
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error response helper for controllers
export const sendError = (
  res: Response,
  error: AppError,
  requestId?: string
): void => {
  const response = formatErrorResponse(error, requestId);
  res.status(error.statusCode).json(response);
};

// Success response helper for controllers
export const sendSuccess = <T>(
  res: Response,
  data: T,
  requestId?: string,
  rateLimit?: { limit: number; remaining: number; resetAt: number }
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || '',
    },
  };

  if (rateLimit) {
    response.meta!.rateLimit = {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetAt: new Date(rateLimit.resetAt).toISOString(),
    };
  }

  res.json(response);
};

// Paginated response helper
export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  requestId?: string
): void => {
  const response = {
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || '',
    },
  };

  res.json(response);
};
