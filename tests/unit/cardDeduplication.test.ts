/**
 * Unit tests for card deduplication service
 */

import { CardDeduplicationService } from '../../src/services/cardDeduplication';
import { calculateCardHash } from '../../src/models/generatedCard';

describe('CardDeduplicationService', () => {
  let deduplicationService: CardDeduplicationService;

  beforeEach(() => {
    deduplicationService = new CardDeduplicationService();
  });

  describe('checkDuplicate', () => {
    it('should return false for new card', async () => {
      const result = await deduplicationService.checkDuplicate(
        '4111111111111111',
        '12/25',
        '123'
      );

      expect(result.isDuplicate).toBe(false);
    });

    it('should return true for duplicate card', async () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';

      // Mark as generated
      await deduplicationService.markAsGenerated(cardNumber, expiryDate, cvv);

      // Check for duplicate
      const result = await deduplicationService.checkDuplicate(
        cardNumber,
        expiryDate,
        cvv
      );

      expect(result.isDuplicate).toBe(true);
    });

    it('should use cache for repeated checks', async () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';

      // First check
      const result1 = await deduplicationService.checkDuplicate(
        cardNumber,
        expiryDate,
        cvv
      );

      // Second check (should use cache)
      const start = Date.now();
      const result2 = await deduplicationService.checkDuplicate(
        cardNumber,
        expiryDate,
        cvv
      );
      const duration = Date.now() - start;

      expect(result2.fromCache).toBe(true);
      expect(duration).toBeLessThan(10); // Cache should be very fast
    });
  });

  describe('markAsGenerated', () => {
    it('should mark card as generated', async () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';

      await deduplicationService.markAsGenerated(cardNumber, expiryDate, cvv);

      const result = await deduplicationService.checkDuplicate(
        cardNumber,
        expiryDate,
        cvv
      );

      expect(result.isDuplicate).toBe(true);
    });
  });
});
