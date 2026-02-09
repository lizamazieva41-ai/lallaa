import CreditCardGenerator, { CreditCardVendor } from '../../src/lib/credit-card-generator/CreditCardGenerator';

describe('CreditCardGenerator', () => {
  describe('generateSingle', () => {
    it('should generate a valid Visa card number', () => {
      const cardNumber = CreditCardGenerator.generateSingle(CreditCardVendor.VISA);
      
      console.log('Generated Visa card in test:', cardNumber);
      console.log('Luhn valid:', CreditCardGenerator.validateCardNumber(cardNumber));
      console.log('Vendor detected:', CreditCardGenerator.getVendorByCardNumber(cardNumber));
      console.log('Valid for Visa:', CreditCardGenerator.isValidForVendor(cardNumber, CreditCardVendor.VISA));
      
      expect(cardNumber).toMatch(/^\d{16}$/);
      expect(CreditCardGenerator.validateCardNumber(cardNumber)).toBe(true);
      expect(CreditCardGenerator.isValidForVendor(cardNumber, CreditCardVendor.VISA)).toBe(true);
      expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBe(CreditCardVendor.VISA);
    });

    it('should generate a valid MasterCard card number', () => {
      const cardNumber = CreditCardGenerator.generateSingle(CreditCardVendor.MasterCard);
      
      expect(cardNumber).toMatch(/^\d{16}$/);
      expect(CreditCardGenerator.isValidForVendor(cardNumber, CreditCardVendor.MasterCard)).toBe(true);
      expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBe(CreditCardVendor.MasterCard);
    });

    it('should generate a valid Amex card number', () => {
      const cardNumber = CreditCardGenerator.generateSingle(CreditCardVendor.Amex);
      
      console.log('Generated Amex card in test:', cardNumber);
      console.log('Luhn valid:', CreditCardGenerator.validateCardNumber(cardNumber));
      console.log('Vendor detected:', CreditCardGenerator.getVendorByCardNumber(cardNumber));
      console.log('Valid for Amex:', CreditCardGenerator.isValidForVendor(cardNumber, CreditCardVendor.Amex));
      
      expect(cardNumber).toMatch(/^\d{15}$/);
      expect(CreditCardGenerator.validateCardNumber(cardNumber)).toBe(true);
      expect(CreditCardGenerator.isValidForVendor(cardNumber, CreditCardVendor.Amex)).toBe(true);
      expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBe(CreditCardVendor.Amex);
    });

    it('should throw error for invalid vendor', () => {
      expect(() => {
        CreditCardGenerator.generateSingle(999 as CreditCardVendor);
      }).toThrow('Unknown credit card vendor');
    });
  });

  describe('generateMultiple', () => {
    it('should generate multiple unique Visa card numbers', () => {
      const count = 10;
      const cardNumbers = CreditCardGenerator.generateMultiple(CreditCardVendor.VISA, count);
      
      expect(cardNumbers).toHaveLength(count);
      
      // Check all cards are valid
      cardNumbers.forEach(cardNumber => {
        expect(cardNumber).toMatch(/^\d{16}$/);
        expect(CreditCardGenerator.isValidForVendor(cardNumber, CreditCardVendor.VISA)).toBe(true);
      });

      // Check uniqueness (high probability of uniqueness)
      const uniqueCards = new Set(cardNumbers);
      expect(uniqueCards.size).toBe(count);
    });

    it('should throw error for invalid vendor', () => {
      expect(() => {
        CreditCardGenerator.generateMultiple(999 as CreditCardVendor, 5);
      }).toThrow('Unknown credit card vendor');
    });
  });

  describe('validateCardNumber', () => {
    it('should validate known valid card numbers', () => {
      // Known valid test card numbers
      const validCards = [
        '4532015112830366', // Visa
        '5555555555554444', // MasterCard
        '378282246310005',  // Amex
        '6011111111111117', // Discover
      ];

      validCards.forEach(cardNumber => {
        expect(CreditCardGenerator.validateCardNumber(cardNumber)).toBe(true);
      });
    });

    it('should reject invalid card numbers', () => {
      const invalidCards = [
        '1234567890123456', // Invalid Luhn
        '4532015112830367', // Valid format but invalid checksum
        '', // Empty
        'abc123', // Non-numeric
        '453201511283036', // Too short
        '45320151128303666', // Too long
      ];

      invalidCards.forEach(cardNumber => {
        expect(CreditCardGenerator.validateCardNumber(cardNumber)).toBe(false);
      });
    });
  });

  describe('getVendorByCardNumber', () => {
    it('should correctly identify Visa cards', () => {
      const visaCards = [
        '4532015112830366',
        '4916484603770548',
        '4485284748762831',
      ];

      visaCards.forEach(cardNumber => {
        expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBe(CreditCardVendor.VISA);
      });
    });

    it('should correctly identify MasterCard cards', () => {
      const mastercardCards = [
        '5555555555554444',
        '5105105105105100',
        '5512345678901234',
      ];

      mastercardCards.forEach(cardNumber => {
        expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBe(CreditCardVendor.MasterCard);
      });
    });

    it('should correctly identify Amex cards', () => {
      const amexCards = [
        '378282246310005',
        '371449635398431',
        '344565432123456',
      ];

      amexCards.forEach(cardNumber => {
        expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBe(CreditCardVendor.Amex);
      });
    });

    it('should return null for unknown or invalid cards', () => {
      const unknownCards = [
        '9999999999999999',
        '1234567890123456',
        '',
        'abc123',
      ];

      unknownCards.forEach(cardNumber => {
        expect(CreditCardGenerator.getVendorByCardNumber(cardNumber)).toBeNull();
      });
    });
  });

  describe('isValidForVendor', () => {
    it('should validate Visa format correctly', () => {
      const validVisa = '4532015112830366';
      const invalidVisaFormat = '5232015112830366'; // Wrong prefix
      const invalidVisaLength = '45320151128303666'; // Wrong length

      expect(CreditCardGenerator.isValidForVendor(validVisa, CreditCardVendor.VISA)).toBe(true);
      expect(CreditCardGenerator.isValidForVendor(invalidVisaFormat, CreditCardVendor.VISA)).toBe(false);
      expect(CreditCardGenerator.isValidForVendor(invalidVisaLength, CreditCardVendor.VISA)).toBe(false);
    });

    it('should validate Amex format correctly', () => {
      const validAmex = '378282246310005';
      const invalidAmexFormat = '348282246310005'; // Wrong prefix
      const invalidAmexLength = '3782822463100056'; // Wrong length

      expect(CreditCardGenerator.isValidForVendor(validAmex, CreditCardVendor.Amex)).toBe(true);
      expect(CreditCardGenerator.isValidForVendor(invalidAmexFormat, CreditCardVendor.Amex)).toBe(false);
      expect(CreditCardGenerator.isValidForVendor(invalidAmexLength, CreditCardVendor.Amex)).toBe(false);
    });
  });

  describe('performance', () => {
    it('should generate cards quickly', () => {
      const startTime = Date.now();
      const count = 1000;
      
      CreditCardGenerator.generateMultiple(CreditCardVendor.VISA, count);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should generate 1000 cards in less than 500ms
      expect(duration).toBeLessThan(500);
    });
  });
});