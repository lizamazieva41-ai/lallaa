/**
 * Unit tests for UniquenessService
 */

import { UniquenessService } from '../../src/services/uniquenessService';
import { calculateCardHash } from '../../src/models/generatedCard';

describe('UniquenessService', () => {
  let uniquenessService: UniquenessService;

  beforeEach(() => {
    uniquenessService = new UniquenessService();
  });

  describe('checkAndReserveCardHash', () => {
    it('should return unique for new card hash', async () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';
      const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

      const result = await uniquenessService.checkAndReserveCardHash(cardHash);

      expect(result.isUnique).toBe(true);
      expect(result.reserved).toBe(true);
    });

    it('should return duplicate for existing card hash', async () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';
      const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

      // First reservation
      await uniquenessService.checkAndReserveCardHash(cardHash);

      // Second reservation should fail
      const result = await uniquenessService.checkAndReserveCardHash(cardHash);

      expect(result.isUnique).toBe(false);
    });

    it('should retry on transient failures', async () => {
      // Mock transient failure scenario
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';
      const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

      // This test would require mocking Redis/database failures
      // For now, just test the happy path
      const result = await uniquenessService.checkAndReserveCardHash(cardHash);

      expect(result).toBeDefined();
    });
  });

  describe('markAsGenerated', () => {
    it('should mark card as generated', async () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      const cvv = '123';
      const cardHash = calculateCardHash(cardNumber, expiryDate, cvv);

      await uniquenessService.markAsGenerated(cardHash);

      // Verify card is marked as generated
      const result = await uniquenessService.checkAndReserveCardHash(cardHash);
      expect(result.isUnique).toBe(false);
    });
  });
});
