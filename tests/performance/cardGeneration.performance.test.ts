/**
 * Performance tests for card generation
 */

import { CardGenerationService } from '../../src/services/cardGeneration';

describe('Card Generation Performance Tests', () => {
  describe('Single Card Generation', () => {
    it('should generate single card in <100ms', async () => {
      const startTime = Date.now();

      await CardGenerationService.generateAndSaveFromBIN({
        bin: '411111',
        expiryMonths: 12,
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    }, 10000);
  });

  describe('Batch Generation', () => {
    it('should generate 1000 cards in <10s', async () => {
      const startTime = Date.now();

      await CardGenerationService.generateAndSaveMultipleFromBIN({
        bin: '411111',
        count: 1000,
        expiryMonths: 12,
        useParallelProcessing: true,
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
    }, 30000);
  });

  describe('Uniqueness Check Performance', () => {
    it('should check uniqueness in <10ms (cached)', async () => {
      const { uniquenessService } = await import('../../src/services/uniquenessService');
      const cardHash = 'test-hash-123';

      // First check (cache miss)
      const start1 = Date.now();
      await uniquenessService.checkAndReserveCardHash(cardHash);
      const duration1 = Date.now() - start1;

      // Second check (cache hit)
      const start2 = Date.now();
      await uniquenessService.checkAndReserveCardHash(cardHash);
      const duration2 = Date.now() - start2;

      // Cached check should be faster
      expect(duration2).toBeLessThan(duration1);
      expect(duration2).toBeLessThan(10);
    });
  });

  describe('Throughput', () => {
    it('should handle 100K+ cards/hour', async () => {
      const cardsPerBatch = 1000;
      const batches = 10; // 10K cards total
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < batches; i++) {
        promises.push(
          CardGenerationService.generateAndSaveMultipleFromBIN({
            bin: '411111',
            count: cardsPerBatch,
            expiryMonths: 12,
            useParallelProcessing: true,
          })
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      const totalCards = cardsPerBatch * batches;
      const cardsPerHour = (totalCards / duration) * 3600000;

      // Should achieve at least 100K cards/hour
      expect(cardsPerHour).toBeGreaterThan(100000);
    }, 60000);
  });
});
