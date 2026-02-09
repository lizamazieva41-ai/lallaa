import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ibanService } from '../services/iban';
import { asyncHandler, sendSuccess, sendError, ValidationError } from '../middleware/error';
import { getRequestParam } from '../utils/requestParams';

// Validation schemas
const validateSchema = Joi.object({
  iban: Joi.string()
    .min(5)
    .max(50)
    .required()
    .messages({
      'string.min': 'IBAN is too short',
      'string.max': 'IBAN is too long',
      'any.required': 'IBAN is required',
    }),
});

const generateSchema = Joi.object({
  countryCode: Joi.string()
    .length(2)
    .uppercase()
    .required()
    .messages({
      'string.length': 'Country code must be 2 characters',
      'any.required': 'Country code is required',
    }),
  bankCode: Joi.string().max(20),
  accountNumber: Joi.string().max(30),
  format: Joi.boolean().default(true),
});

const batchValidateSchema = Joi.object({
  ibans: Joi.array()
    .items(Joi.string().min(5).max(50))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one IBAN is required',
      'array.max': 'Maximum 100 IBANs allowed per batch',
    }),
});

// Validate IBAN controller
export const validateIBAN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { iban } = req.body;

    // Validate input
    const { error } = validateSchema.validate({ iban }, { abortEarly: false });
    if (error) {
      throw new ValidationError('Invalid IBAN format', {
        details: error.details.map((d) => d.message),
      });
    }

    const result = await ibanService.validate(iban);

    sendSuccess(res, result, req.requestId, req.rateLimit);
  }
);

// Generate IBAN controller
export const generateIBAN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { countryCode, bankCode, accountNumber, format } = req.body;

    // Validate input
    const { error, value } = generateSchema.validate(
      { countryCode, bankCode, accountNumber, format },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid parameters', {
        details: error.details.map((d) => d.message),
      });
    }

    const result = await ibanService.generate({
      countryCode: value.countryCode,
      bankCode: value.bankCode,
      accountNumber: value.accountNumber,
      format: value.format,
    });

    sendSuccess(res, {
      iban: result,
      countryCode: value.countryCode,
      formatted: ibanService.formatIBAN(result),
    }, req.requestId, req.rateLimit);
  }
);

// Parse IBAN controller
export const parseIBAN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { iban } = req.body;

    if (!iban || typeof iban !== 'string') {
      throw new ValidationError('IBAN is required');
    }

    const result = await ibanService.parse(iban);

    sendSuccess(res, result, req.requestId, req.rateLimit);
  }
);

// Batch validate IBANs controller
export const batchValidateIBANs = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { ibans } = req.body;

    // Validate input
    const { error, value } = batchValidateSchema.validate(
      { ibans },
      { abortEarly: false }
    );
    if (error) {
      throw new ValidationError('Invalid batch data', {
        details: error.details.map((d) => d.message),
      });
    }

    const results = await ibanService.validateBatch(value.ibans);

    // Calculate summary
    const validCount = results.filter((r) => r.isValid).length;
    const invalidCount = results.length - validCount;

    sendSuccess(
      res,
      {
        results,
        summary: {
          total: results.length,
          valid: validCount,
          invalid: invalidCount,
          validPercentage: ((validCount / results.length) * 100).toFixed(2),
        },
      },
      req.requestId,
      req.rateLimit
    );
  }
);

// Convert IBAN formats controller
export const convertIBAN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { iban, format } = req.body;

    if (!iban || typeof iban !== 'string') {
      throw new ValidationError('IBAN is required');
    }

    const toFormat = format === 'human' ? 'human' : 'machine';

    const result =
      toFormat === 'human'
        ? ibanService.toHumanReadable(iban)
        : ibanService.toMachineReadable(iban);

    sendSuccess(
      res,
      {
        original: iban,
        converted: result,
        format: toFormat,
      },
      req.requestId,
      req.rateLimit
    );
  }
);

// Generate test IBAN controller
export const generateTestIBAN = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const countryCodeParam = getRequestParam(req.params.countryCode);
    const countryCode = countryCodeParam ? countryCodeParam.toUpperCase() : undefined;

    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      throw new ValidationError('Invalid country code');
    }

    try {
      const result = await ibanService.generateTestIBAN(countryCode);

      sendSuccess(
        res,
        {
          countryCode,
          iban: result,
          formatted: ibanService.formatIBAN(result),
          isTest: true,
        },
        req.requestId,
        req.rateLimit
      );
    } catch (err) {
      sendError(
        res,
        {
          statusCode: 400,
          code: 'INVALID_COUNTRY',
          message: (err as Error).message,
          isOperational: true,
        } as any,
        req.requestId
      );
    }
  }
);

export default {
  validateIBAN,
  generateIBAN,
  parseIBAN,
  batchValidateIBANs,
  convertIBAN,
  generateTestIBAN,
};
