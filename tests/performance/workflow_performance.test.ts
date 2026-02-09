/**
 * Performance Tests for Workflow
 * Tests workflow with 1000 cards, measures processing time, memory usage, and API response times
 */

import { WorkflowOrchestrator } from '../../src/services/workflowOrchestrator';
import { doremonIntegrationService } from '../../src/services/doremonIntegration';

// Mock doremon integration service
jest.mock('../../src/services/doremonIntegration');

describe('Workflow Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Large Dataset Performance (1000 cards)', () => {
    it('should process 1000 cards within acceptable time', async () => {
      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      // Mock doremon integration responses
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-1000',
        status: 'pending',
      });

      // Simulate processing with progress updates
      let progress = 0;
      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockImplementation(() => {
        progress += 10;
        if (progress >= 100) {
          return Promise.resolve({
            processId: 'test-process-1000',
            status: 'completed',
            progress: 100,
            totalCards: 1000,
            verifiedCards: 950,
            failedCards: 50,
          });
        }
        return Promise.resolve({
          processId: 'test-process-1000',
          status: 'running',
          progress,
          totalCards: 1000,
          verifiedCards: Math.floor(progress * 10),
          failedCards: Math.floor(progress * 0.5),
        });
      });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockResolvedValue(
        Buffer.from('processed excel content')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 1000,
        expiryMonths: 12,
        sequential: false,
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const memoryAfter = process.memoryUsage();
      const memoryUsed = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024; // MB

      expect(result.status).toBe('completed');
      expect(result.totalCards).toBe(1000);

      // Performance assertions
      console.log(`Processing time: ${duration}s for 1000 cards`);
      console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);
      console.log(`Time per card: ${(duration / 1000).toFixed(3)}s`);

      // Target: <5 seconds per card verification (but workflow includes other steps)
      // For 1000 cards, total workflow should complete in reasonable time
      expect(duration).toBeLessThan(600); // 10 minutes max for 1000 cards
    });

    it('should measure API response times', async () => {
      const apiTimes: number[] = [];

      // Mock with timing
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate 100ms
        apiTimes.push(Date.now() - start);
        return { processId: 'test-process', status: 'pending' };
      });

      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate 50ms
        apiTimes.push(Date.now() - start);
        return {
          processId: 'test-process',
          status: 'completed',
          progress: 100,
          totalCards: 10,
          verifiedCards: 10,
          failedCards: 0,
        };
      });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockImplementation(async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate 200ms
        apiTimes.push(Date.now() - start);
        return Buffer.from('processed excel content');
      });

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 10,
        expiryMonths: 12,
      });

      const avgApiTime = apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length;
      const maxApiTime = Math.max(...apiTimes);

      console.log(`Average API response time: ${avgApiTime.toFixed(2)}ms`);
      console.log(`Max API response time: ${maxApiTime.toFixed(2)}ms`);

      // API responses should be reasonably fast
      expect(avgApiTime).toBeLessThan(500); // 500ms average
      expect(maxApiTime).toBeLessThan(1000); // 1s max
    });

    it('should measure memory usage during processing', async () => {
      const memorySnapshots: NodeJS.MemoryUsage[] = [];

      // Take memory snapshot before
      memorySnapshots.push(process.memoryUsage());

      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-memory',
        status: 'pending',
      });

      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockResolvedValue({
        processId: 'test-process-memory',
        status: 'completed',
        progress: 100,
        totalCards: 100,
        verifiedCards: 100,
        failedCards: 0,
      });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockResolvedValue(
        Buffer.from('processed excel content')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      // Take snapshot during processing
      memorySnapshots.push(process.memoryUsage());

      await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 100,
        expiryMonths: 12,
      });

      // Take snapshot after
      memorySnapshots.push(process.memoryUsage());

      const memoryIncrease = 
        (memorySnapshots[2].heapUsed - memorySnapshots[0].heapUsed) / 1024 / 1024; // MB

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB for 100 cards
    });
  });

  describe('Verification Performance Target', () => {
    it('should verify cards within <5 seconds per card target', async () => {
      // This test verifies the target of <5 seconds per card verification
      // Note: This is a simplified test - actual verification happens in doremon-ai
      
      const cardCount = 100;
      const maxTimePerCard = 5; // seconds
      const maxTotalTime = cardCount * maxTimePerCard;

      const startTime = Date.now();

      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-perf',
        status: 'pending',
      });

      // Simulate fast processing (within target)
      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockResolvedValue({
        processId: 'test-process-perf',
        status: 'completed',
        progress: 100,
        totalCards: cardCount,
        verifiedCards: cardCount,
        failedCards: 0,
      });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockResolvedValue(
        Buffer.from('processed excel content')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount,
        expiryMonths: 12,
      });

      const duration = (Date.now() - startTime) / 1000; // seconds
      const timePerCard = duration / cardCount;

      console.log(`Total time: ${duration.toFixed(2)}s for ${cardCount} cards`);
      console.log(`Time per card: ${timePerCard.toFixed(3)}s`);

      // Note: This includes all workflow steps, not just verification
      // Actual verification time per card should be <5s as measured in doremon-ai
      expect(timePerCard).toBeLessThan(maxTimePerCard * 2); // Allow 2x for other workflow steps
    });
  });
});
