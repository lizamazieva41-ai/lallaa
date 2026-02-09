/**
 * Braintree Validator Wrapper
 * Integrate Braintree validation with existing BIN service
 */

import creditCardType from 'credit-card-type';
import { ValidationResult, ValidationError, ValidationWarning } from './validationResult';
import { logger } from '../../utils/logger';

/**
 * Braintree Validator - Wrapper for credit-card-type library
 */
export class BraintreeValidator {
  /**
   * Validate card number using Braintree validation
   */
  public validateCardNumber(cardNumber: string): ValidationResult {
    const cleaned = this.cleanCardNumber(cardNumber);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let isValid = false;
    let isPotentiallyValid = false;

    // Check if empty
    if (!cleaned || cleaned.length === 0) {
      errors.push({
        field: 'cardNumber',
        code: 'EMPTY',
        message: 'Card number is required',
      });
      return this.createResult(cardNumber, false, false, errors, warnings);
    }

    // Check if contains only digits
    if (!/^\d+$/.test(cleaned)) {
      errors.push({
        field: 'cardNumber',
        code: 'INVALID_CHARACTERS',
        message: 'Card number must contain only digits',
      });
      return this.createResult(cardNumber, false, false, errors, warnings);
    }

    // Detect card type
    const cardTypes = creditCardType(cleaned);
    const detectedType = cardTypes.length > 0 ? cardTypes[0] : null;

    // Check Luhn algorithm
    const luhnValid = this.validateLuhn(cleaned);
    if (!luhnValid && cleaned.length >= 13) {
      errors.push({
        field: 'cardNumber',
        code: 'LUHN_CHECK_FAILED',
        message: 'Card number failed Luhn algorithm validation',
      });
    }

    // Check length
    let lengthValid = false;
    if (detectedType) {
      lengthValid = detectedType.lengths.includes(cleaned.length);
      if (!lengthValid && cleaned.length < Math.max(...detectedType.lengths)) {
        isPotentiallyValid = true; // Still typing
      }
    } else {
      // No type detected, check common lengths
      if (cleaned.length >= 13 && cleaned.length <= 19) {
        isPotentiallyValid = true;
      } else if (cleaned.length < 13) {
        isPotentiallyValid = true;
      } else {
        errors.push({
          field: 'cardNumber',
          code: 'INVALID_LENGTH',
          message: `Card number length ${cleaned.length} is invalid`,
        });
      }
    }

    // Final validation
    isValid = luhnValid && lengthValid && detectedType !== null;

    // Add warnings for potential issues
    if (detectedType && cleaned.length < Math.min(...detectedType.lengths)) {
      warnings.push({
        field: 'cardNumber',
        code: 'INCOMPLETE',
        message: `Card number appears incomplete. Expected length: ${detectedType.lengths.join(' or ')}`,
      });
    }

    if (detectedType && !detectedType.lengths.includes(cleaned.length) && cleaned.length > Math.max(...detectedType.lengths)) {
      warnings.push({
        field: 'cardNumber',
        code: 'TOO_LONG',
        message: `Card number may be too long for ${detectedType.niceType}`,
      });
    }

    return this.createResult(
      cardNumber,
      isValid,
      isPotentiallyValid,
      errors,
      warnings,
      detectedType ? {
        niceType: detectedType.niceType,
        type: detectedType.type,
        patterns: detectedType.patterns,
        gaps: detectedType.gaps,
        lengths: detectedType.lengths,
        code: detectedType.code,
      } : undefined,
      {
        luhnValid,
        lengthValid,
        formatValid: /^\d+$/.test(cleaned),
        networkDetected: detectedType?.niceType,
      }
    );
  }

  /**
   * Validate Luhn algorithm
   */
  private validateLuhn(cardNumber: string): boolean {
    const cleaned = this.cleanCardNumber(cardNumber);
    if (!/^\d+$/.test(cleaned) || cleaned.length < 13) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Clean card number (remove spaces, dashes, etc.)
   */
  private cleanCardNumber(cardNumber: string): string {
    return cardNumber.replace(/\s+/g, '').replace(/-/g, '');
  }

  /**
   * Create validation result
   */
  private createResult(
    cardNumber: string,
    isValid: boolean,
    isPotentiallyValid: boolean,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    cardType?: ValidationResult['cardType'],
    metadata?: ValidationResult['metadata']
  ): ValidationResult {
    return {
      isValid,
      isPotentiallyValid,
      cardNumber,
      cardType,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Get card network from card number
   */
  public getCardNetwork(cardNumber: string): string | null {
    const cleaned = this.cleanCardNumber(cardNumber);
    const cardTypes = creditCardType(cleaned);
    return cardTypes.length > 0 ? cardTypes[0].niceType : null;
  }

  /**
   * Get all supported card networks
   */
  public getSupportedNetworks(): string[] {
    // credit-card-type supports: visa, mastercard, amex, discover, jcb, diners-club, unionpay, maestro, mir, elo, hiper, hipercard
    return [
      'visa',
      'mastercard',
      'amex',
      'discover',
      'jcb',
      'diners-club',
      'unionpay',
      'maestro',
      'mir',
      'elo',
      'hiper',
      'hipercard',
    ];
  }
}

export const braintreeValidator = new BraintreeValidator();
