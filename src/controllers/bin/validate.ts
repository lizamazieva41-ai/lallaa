import { Request, Response, NextFunction } from 'express';
import { braintreeValidator } from '../../services/enhancedValidation/braintreeValidator';
import { realTimeValidator } from '../../services/enhancedValidation/realTimeValidator';
import { asyncHandler, sendSuccess, sendError, ValidationError } from '../../middleware/error';
import { logger } from '../../utils/logger';

/**
 * Validate card number using Braintree validation
 */
export const validateCardNumber = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { cardNumber } = req.body;

    if (!cardNumber) {
      throw new ValidationError('cardNumber is required');
    }

    const validation = braintreeValidator.validateCardNumber(cardNumber);

    logger.debug('Card number validated', {
      isValid: validation.isValid,
      network: validation.cardType?.niceType,
    });

    sendSuccess(res, validation, req.requestId, req.rateLimit);
  }
);

/**
 * Real-time validation as user types
 */
export const validateRealTime = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { cardNumber } = req.body;

    if (cardNumber === undefined || cardNumber === null) {
      throw new ValidationError('cardNumber is required');
    }

    const validation = realTimeValidator.validateRealTime(String(cardNumber));

    sendSuccess(res, validation, req.requestId, req.rateLimit);
  }
);

/**
 * Format and validate card number
 */
export const formatAndValidate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { cardNumber } = req.body;

    if (!cardNumber) {
      throw new ValidationError('cardNumber is required');
    }

    const result = realTimeValidator.validateAndFormat(String(cardNumber));

    sendSuccess(res, result, req.requestId, req.rateLimit);
  }
);
