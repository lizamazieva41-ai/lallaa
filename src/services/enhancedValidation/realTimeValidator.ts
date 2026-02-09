/**
 * Real-Time Validator
 * Potential validity calculation as user types
 */

import { braintreeValidator } from './braintreeValidator';
import { RealTimeValidationResult, ValidationError, ValidationWarning } from './validationResult';
import { logger } from '../../utils/logger';

/**
 * Real-Time Validator - Calculate potential validity as user types
 */
export class RealTimeValidator {
  /**
   * Validate card number in real-time (as user types)
   */
  public validateRealTime(input: string): RealTimeValidationResult {
    const cleaned = input.replace(/\s+/g, '').replace(/-/g, '');
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Empty input
    if (!cleaned || cleaned.length === 0) {
      return {
        input,
        isValid: false,
        isPotentiallyValid: true, // Can still type
        currentLength: 0,
        errors: [],
        warnings: [],
        suggestions: ['Enter card number'],
      };
    }

    // Check for non-digit characters
    if (!/^\d+$/.test(cleaned)) {
      errors.push({
        field: 'cardNumber',
        code: 'INVALID_CHARACTERS',
        message: 'Card number must contain only digits',
      });
      return {
        input,
        isValid: false,
        isPotentiallyValid: false,
        currentLength: cleaned.length,
        errors,
        warnings,
        suggestions: ['Remove non-digit characters'],
      };
    }

    // Get validation result
    const validation = braintreeValidator.validateCardNumber(cleaned);

    // Detect network early
    const detectedNetwork = braintreeValidator.getCardNetwork(cleaned);

    // Determine expected length
    let expectedLength: number | undefined;
    if (validation.cardType) {
      expectedLength = Math.min(...validation.cardType.lengths);
    } else if (detectedNetwork) {
      // Common lengths by network
      const networkLengths: Record<string, number> = {
        visa: 16,
        mastercard: 16,
        amex: 15,
        discover: 16,
        jcb: 16,
        'diners-club': 14,
        unionpay: 16,
      };
      expectedLength = networkLengths[detectedNetwork.toLowerCase()] || 16;
    }

    // Generate suggestions
    if (cleaned.length < 13) {
      suggestions.push('Card number is too short');
    } else if (validation.isPotentiallyValid && !validation.isValid) {
      if (expectedLength) {
        suggestions.push(`Continue entering. Expected length: ${expectedLength}`);
      } else {
        suggestions.push('Continue entering card number');
      }
    } else if (validation.isValid) {
      suggestions.push('Card number is valid');
    }

    // Add warnings from validation
    warnings.push(...validation.warnings);

    return {
      input,
      isValid: validation.isValid,
      isPotentiallyValid: validation.isPotentiallyValid,
      currentLength: cleaned.length,
      expectedLength,
      detectedNetwork: detectedNetwork || undefined,
      errors: validation.errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Format card number as user types (add spaces)
   */
  public formatCardNumber(input: string, detectedNetwork?: string): string {
    const cleaned = input.replace(/\s+/g, '').replace(/-/g, '');

    // Format based on network
    if (detectedNetwork === 'amex' || detectedNetwork === 'american-express') {
      // Amex: 4-6-5 format (e.g., 3782 822463 10005)
      return cleaned.replace(/(\d{4})(\d{6})(\d{0,5})/, (match, p1, p2, p3) => {
        if (p3) return `${p1} ${p2} ${p3}`;
        if (p2) return `${p1} ${p2}`;
        return p1;
      });
    } else {
      // Most cards: 4-4-4-4 format
      return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    }
  }

  /**
   * Validate and format in one call
   */
  public validateAndFormat(input: string): {
    formatted: string;
    validation: RealTimeValidationResult;
  } {
    const validation = this.validateRealTime(input);
    const formatted = this.formatCardNumber(input, validation.detectedNetwork);

    return {
      formatted,
      validation,
    };
  }
}

export const realTimeValidator = new RealTimeValidator();
