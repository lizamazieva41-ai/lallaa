/**
 * Data Masking Verification Tests
 * Tests to ensure sensitive data is properly masked in logs and responses
 */

jest.unmock('../../src/utils/logger');

const loggerModule = jest.requireActual('../../src/utils/logger') as typeof import('../../src/utils/logger');
const { logger, logSecurity, logError, logAudit } = loggerModule;

const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => logger);
const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);

afterAll(() => {
  warnSpy.mockRestore();
  infoSpy.mockRestore();
  errorSpy.mockRestore();
});

beforeEach(() => {
  warnSpy.mockClear();
  infoSpy.mockClear();
  errorSpy.mockClear();
});

describe('Data Masking', () => {
  describe('Credit Card Masking', () => {
    it('should mask credit card numbers in logs', () => {
      const creditCard = '4111111111111111';
      
      logSecurity('Credit card processed', {
        creditCard,
        userId: 'user-123'
      });

      expect(warnSpy).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          creditCard: '41***11',
          userId: 'user-123'
        })
      );
    });

    it('should handle short credit card numbers', () => {
      const shortCard = '1234';
      
      logSecurity('Short card processed', {
        creditCard: shortCard
      });

      expect(warnSpy).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          creditCard: '***'
        })
      );
    });
  });

  describe('IBAN Masking', () => {
    it('should mask IBANs in logs', () => {
      const iban = 'DE89370400440532013000';
      
      logAudit('user-123', 'iban_validation', 'iban', 'SUCCESS', {
        iban: iban
      });

      expect(infoSpy).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          iban: 'DE***00'
        })
      );
    });

    it('should handle short IBANs', () => {
      const shortIban = 'DE12';
      
      logAudit('user-123', 'iban_validation', 'iban', 'SUCCESS', {
        iban: shortIban
      });

      expect(infoSpy).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          iban: '***'
        })
      );
    });
  });

  describe('Token/Key Masking', () => {
    it('should mask tokens in logs', () => {
      const secretToken = 'sk_test_4111111111111111111111111111111';
      const apiKey = 'ak_live_12345678901234567890';
      
      logSecurity('Token used', {
        token: secretToken,
        apiKey: apiKey,
        password: 'SuperSecretPassword123!'
      });

      expect(warnSpy).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          token: 'sk***11',
          apiKey: 'ak***90',
          password: 'Su***3!'
        })
      );
    });
  });

  describe('Error Message Sanitization', () => {
    it('should remove sensitive data from error messages', () => {
      const errorWithSensitiveData = new Error('Login failed for user@example.com with password=secret123');
      
      logError(errorWithSensitiveData);

      expect(errorSpy).toHaveBeenCalledWith(
        'Application Error',
        expect.objectContaining({
          message: expect.stringContaining('password=***')
        })
      );
    });

    it('should handle complex error objects', () => {
      const complexError = new Error('Database error');
      const context = {
        token: 'secret123',
        apiKey: 'ak_live_12345678901234567890'
      };
      
      logError(complexError, context);

      expect(errorSpy).toHaveBeenCalledWith(
        'Application Error',
        expect.objectContaining({
          token: 'se***23',
          apiKey: 'ak***90'
        })
      );
    });
  });

  describe('Request Body Masking', () => {
    it('should mask sensitive data in audit logs', () => {
      const sensitiveData = {
        creditCard: '5555555555554444',
        iban: 'FR7630006000011234567890189',
        apiKey: 'sk_live_12345678901234567890',
        password: 'SuperSecretPassword123!'
      };
      
      logAudit('user-123', 'sensitive_operation', 'payment_process', 'SUCCESS', sensitiveData);

      expect(infoSpy).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          creditCard: '55***44',
          iban: 'FR***89',
          apiKey: 'sk***90',
          password: 'Su***3!'
        })
      );
    });
  });
});
