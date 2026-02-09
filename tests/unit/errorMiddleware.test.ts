import Joi from 'joi';
import { ZodError, z } from 'zod';
import {
  ValidationError,
  errorHandler,
  notFoundHandler,
  sendSuccess,
  sendError,
} from '../../src/middleware/error';

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('Error middleware', () => {
  it('should handle AppError', () => {
    const err = new ValidationError('Invalid input');
    const req = { path: '/test', method: 'GET', requestId: 'req-1' } as any;
    const res = buildRes();

    errorHandler(err, req, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      })
    );
  });

  it('should handle ZodError', () => {
    const schema = z.object({ name: z.string() });
    let err: ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      err = e as ZodError;
    }

    const req = { path: '/test', method: 'POST', requestId: 'req-2' } as any;
    const res = buildRes();

    errorHandler(err!, req, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      })
    );
  });

  it('should handle Joi validation error', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const { error } = schema.validate({ name: 123 });

    const req = { path: '/test', method: 'POST', requestId: 'req-3' } as any;
    const res = buildRes();

    errorHandler(error as Error, req, res as any, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      })
    );
  });

  it('should call next with not found error', () => {
    const req = { method: 'GET', path: '/missing' } as any;
    const next = jest.fn();

    notFoundHandler(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should send success response', () => {
    const res = buildRes();
    sendSuccess(res as any, { ok: true }, 'req-4', {
      limit: 10,
      remaining: 9,
      resetAt: Date.now(),
    });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { ok: true },
      })
    );
  });

  it('should send error response', () => {
    const res = buildRes();
    const err = new ValidationError('Invalid input');

    sendError(res as any, err, 'req-5');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      })
    );
  });
});
