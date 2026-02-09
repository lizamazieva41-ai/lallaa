import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { ValidationError } from './error';

/**
 * Validation middleware for async job requests
 */
export const validateAsyncJobRequest = [
  body('bin')
    .isString()
    .matches(/^\d{6,8}$/)
    .withMessage('BIN must be 6-8 digits'),
  body('count')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Count must be between 1 and 10000'),
  body('expiryMonths')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Expiry months must be between 1 and 120'),
  body('sequential')
    .optional()
    .isBoolean()
    .withMessage('Sequential must be a boolean'),
  body('startSequence')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Start sequence must be a non-negative integer'),
  body('generate999')
    .optional()
    .isBoolean()
    .withMessage('Generate999 must be a boolean'),
];

/**
 * Validation middleware for bulk generation parameters
 */
export const validateBulkGenerationRequest = [
  body('bin')
    .isString()
    .matches(/^\d{6,8}$/)
    .withMessage('BIN must be 6-8 digits'),
  body('count')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Count must be between 1 and 1000'),
  body('expiryMonths')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Expiry months must be between 1 and 120'),
];

/**
 * Validation middleware for uniqueness check parameters
 */
export const validateUniquenessCheckRequest = [
  body('cardNumber')
    .isString()
    .matches(/^\d{13,19}$/)
    .withMessage('Card number must be 13-19 digits'),
  body('expiryDate')
    .isString()
    .matches(/^\d{2}\/\d{2}$/)
    .withMessage('Expiry date must be in MM/YY format'),
  body('cvv')
    .isString()
    .matches(/^\d{3,4}$/)
    .withMessage('CVV must be 3 or 4 digits'),
];

/**
 * Generic validation result handler
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details: Record<string, unknown> = {};
    errors.array().forEach((error) => {
      const field = (error as any).param || (error as any).path;
      if (field) {
        details[field] = {
          message: error.msg,
          value: (error as any).value,
        };
      }
    });

    throw new ValidationError('Validation failed', details);
  }
  next();
};

/**
 * Validate job ID parameter
 */
export const validateJobId = [
  param('jobId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Job ID is required'),
];
