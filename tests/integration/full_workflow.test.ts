/**
 * Integration Tests for Full Workflow
 * Tests complete workflow: BIN → Cards → Excel → Verify → Extract → Final Excel
 */

import { WorkflowOrchestrator } from '../../src/services/workflowOrchestrator';
import { CardGenerationService } from '../../src/services/cardGeneration';
import { ExcelExportService } from '../../src/services/excelExport';
import { doremonIntegrationService } from '../../src/services/doremonIntegration';

// Mock doremon integration service
jest.mock('../../src/services/doremonIntegration');

describe('Full Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Single Card Workflow', () => {
    it('should complete full workflow with single card', async () => {
      // Mock doremon integration responses
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-1',
        status: 'pending',
      });

      (doremonIntegrationService.getProcessingStatus as jest.Mock)
        .mockResolvedValueOnce({
          processId: 'test-process-1',
          status: 'running',
          progress: 50,
          currentStep: 'verifying_cards',
        })
        .mockResolvedValueOnce({
          processId: 'test-process-1',
          status: 'completed',
          progress: 100,
          totalCards: 1,
          verifiedCards: 1,
          failedCards: 0,
        });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockResolvedValue(
        Buffer.from('processed excel content')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 1,
        expiryMonths: 12,
        sequential: false,
      });

      expect(result.status).toBe('completed');
      expect(result.totalCards).toBe(1);
      expect(result.verifiedCards).toBe(1);
      expect(result.excelFileBuffer).toBeDefined();
    });
  });

  describe('Multiple Cards Workflow (10 cards)', () => {
    it('should complete full workflow with 10 cards', async () => {
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-10',
        status: 'pending',
      });

      (doremonIntegrationService.getProcessingStatus as jest.Mock)
        .mockResolvedValueOnce({
          processId: 'test-process-10',
          status: 'running',
          progress: 30,
        })
        .mockResolvedValueOnce({
          processId: 'test-process-10',
          status: 'running',
          progress: 60,
        })
        .mockResolvedValueOnce({
          processId: 'test-process-10',
          status: 'completed',
          progress: 100,
          totalCards: 10,
          verifiedCards: 9,
          failedCards: 1,
        });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockResolvedValue(
        Buffer.from('processed excel content')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 10,
        expiryMonths: 12,
        sequential: false,
      });

      expect(result.status).toBe('completed');
      expect(result.totalCards).toBe(10);
      expect(result.verifiedCards).toBe(9);
      expect(result.failedCards).toBe(1);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API failure during upload', async () => {
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockRejectedValue(
        new Error('API connection failed')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 1,
        expiryMonths: 12,
      });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('API connection failed');
    });

    it('should handle processing timeout', async () => {
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-timeout',
        status: 'pending',
      });

      // Mock status to always return running (simulating timeout)
      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockResolvedValue({
        processId: 'test-process-timeout',
        status: 'running',
        progress: 50,
      });

      // Set short timeout for testing
      process.env.WORKFLOW_MAX_WAIT_TIME = '1000'; // 1 second

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 1,
        expiryMonths: 12,
      });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('timeout');
    });

    it('should handle processing failure', async () => {
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock).mockResolvedValue({
        processId: 'test-process-fail',
        status: 'pending',
      });

      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockResolvedValue({
        processId: 'test-process-fail',
        status: 'failed',
        errorMessage: 'Processing failed due to invalid data',
      });

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 1,
        expiryMonths: 12,
      });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Processing failed');
    });
  });

  describe('Recovery Scenarios', () => {
    it('should retry on transient API errors', async () => {
      // First attempt fails, second succeeds
      (doremonIntegrationService.uploadExcelToDoremon as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          processId: 'test-process-retry',
          status: 'pending',
        });

      (doremonIntegrationService.getProcessingStatus as jest.Mock).mockResolvedValue({
        processId: 'test-process-retry',
        status: 'completed',
        progress: 100,
        totalCards: 1,
        verifiedCards: 1,
        failedCards: 0,
      });

      (doremonIntegrationService.downloadProcessedExcel as jest.Mock).mockResolvedValue(
        Buffer.from('processed excel content')
      );

      const orchestrator = new (require('../../src/services/workflowOrchestrator').WorkflowOrchestrator)();

      const result = await orchestrator.executeFullWorkflow({
        bin: '411111',
        cardCount: 1,
        expiryMonths: 12,
      });

      expect(result.status).toBe('completed');
      // Should have retried upload
      expect(doremonIntegrationService.uploadExcelToDoremon).toHaveBeenCalledTimes(2);
    });
  });
});
