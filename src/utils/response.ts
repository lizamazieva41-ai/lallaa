import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: any,
  requestId?: string,
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || 'unknown'
    }
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errorCode?: string
): Response => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode || 'INTERNAL_ERROR',
      message
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};