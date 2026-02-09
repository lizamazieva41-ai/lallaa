import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { binService, BINSearchParams } from '../services/bin';
import { CardType, CardNetwork, BINLookupResult } from '../types';
import { asyncHandler, sendSuccess, sendError, ValidationError } from '../middleware/error';
import { logger } from '../utils/logger';
import { getRequestParam } from '../utils/requestParams';

// Validation schemas
const lookupSchema = Joi.object({
  bin: Joi.string()
    .pattern(/^\d{6,8}$/)
    .required()
    .messages({
      'string.pattern.base': 'BIN must be 6-8 digits',
      'any.required': 'BIN is required',
    }),
});

const searchSchema = Joi.object({
  countryCode: Joi.string().length(2).uppercase(),
  cardType: Joi.string().valid(...Object.values(CardType)),
  cardNetwork: Joi.string().valid(...Object.values(CardNetwork)),
  bankName: Joi.string().min(2).max(100),
  isActive: Joi.boolean(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

// BIN lookup controller
export const lookupBIN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const binValue = getRequestParam(req.params.bin);

    if (!binValue) {
      throw new ValidationError('BIN is required');
    }

    // Validate input
    const { error } = lookupSchema.validate({ bin: binValue });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const result = await binService.lookup(binValue);

    if (!result) {
      sendError(res, {
        statusCode: 404,
        code: 'BIN_NOT_FOUND',
        message: `BIN ${binValue} not found in database`,
        isOperational: true,
      } as any, req.requestId);
      return;
    }

    sendSuccess(res, result, req.requestId, req.rateLimit);
  }
);

// BIN search controller
export const searchBINs = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const query = req.query;

    // Validate query parameters
    const { error, value } = searchSchema.validate(query, { abortEarly: false });
    if (error) {
      const details: Record<string, unknown> = {};
      error.details.forEach((e) => {
        const path = e.path.join('.');
        details[path] = e.message;
      });
      throw new ValidationError('Invalid query parameters', details);
    }

    const params: BINSearchParams = {
      countryCode: value.countryCode,
      cardType: value.cardType,
      cardNetwork: value.cardNetwork,
      bankName: value.bankName,
      isActive: value.isActive,
      limit: value.limit,
      offset: value.offset,
    };

    const result = await binService.search(params);

    res.json({
      success: true,
      data: result.bins,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  }
);

// Get BINs by country
export const getBINsByCountry = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const countryCodeParam = getRequestParam(req.params.countryCode);
    const countryCode = countryCodeParam ? countryCodeParam.toUpperCase() : undefined;

    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      throw new ValidationError('Invalid country code');
    }

    const result = await binService.getByCountry(countryCode);

    sendSuccess(res, {
      countryCode,
      count: result.length,
      bins: result,
    }, req.requestId, req.rateLimit);
  }
);

// Get BIN statistics
export const getBINStatistics = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const result = await binService.getStatistics();

    sendSuccess(res, {
      totalBINs: result.totalBINs,
      activeBINs: result.activeBINs,
      byCountry: result.byCountry,
      byCardType: result.byCardType,
      byNetwork: result.byNetwork,
    }, req.requestId, req.rateLimit);
  }
);

// Validate BIN format
export const validateBIN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { bin } = req.body;

    if (!bin || typeof bin !== 'string') {
      throw new ValidationError('BIN is required');
    }

    const isValid = binService.validateBINFormat(bin);
    const normalizedBIN = isValid ? bin.replace(/\s/g, '').substring(0, 8) : null;

    sendSuccess(res, {
      isValid,
      bin: normalizedBIN,
      cardNetwork: isValid ? binService.parseCardNetwork(bin) : null,
    }, req.requestId, req.rateLimit);
  }
);

export default {
  lookupBIN,
  searchBINs,
  getBINsByCountry,
  getBINStatistics,
  validateBIN,
};
