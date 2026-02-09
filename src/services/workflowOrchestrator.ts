import { v4 as uuidv4 } from 'uuid';
import { CardGenerationService, BINCardGenerationOptions, GeneratedCardFromBIN } from './cardGeneration';
import { ExcelExportService } from './excelExport';
import { doremonIntegrationService, ProcessingStatusResponse } from './doremonIntegration';
import { logger } from '../utils/logger';
import { metricsService } from './metrics';

export interface WorkflowOptions extends BINCardGenerationOptions {
  cardCount: number;
  onProgress?: (progress: WorkflowProgress) => void;
}

export interface WorkflowProgress {
  workflowId: string;
  step: WorkflowStep;
  progress: number; // 0-100
  message?: string;
  data?: Record<string, unknown>;
}

export type WorkflowStep =
  | 'initializing'
  | 'generating_cards'
  | 'exporting_excel'
  | 'uploading_to_doremon'
  | 'processing'
  | 'downloading_results'
  | 'completed'
  | 'failed';

export interface WorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed';
  processId?: string;
  excelFileBuffer?: Buffer;
  totalCards: number;
  verifiedCards?: number;
  failedCards?: number;
  errorMessage?: string;
  completedAt: Date;
}

export class WorkflowOrchestrator {
  private workflows: Map<string, WorkflowProgress> = new Map();

  /**
   * Execute full workflow: BIN → Cards → Excel → Upload → Wait → Download
   */
  public async executeFullWorkflow(
    options: WorkflowOptions
  ): Promise<WorkflowResult> {
    const workflowId = uuidv4();
    const startTime = Date.now();
    
    // Record workflow start
    metricsService.recordWorkflowStart();

    try {
      this.updateProgress(workflowId, 'initializing', 0, 'Starting workflow...', options);

      // Step 1: Generate cards from BIN
      this.updateProgress(workflowId, 'generating_cards', 10, 'Generating cards from BIN...', options);
      logger.info('Generating cards from BIN', { workflowId, bin: options.bin, cardCount: options.cardCount });

      const cards = await CardGenerationService.generateMultipleFromBIN({
        bin: options.bin,
        count: options.cardCount,
        expiryMonths: options.expiryMonths,
        sequential: options.sequential,
      });

      logger.info('Cards generated', { workflowId, count: cards.length });

      // Step 2: Export to Excel
      this.updateProgress(workflowId, 'exporting_excel', 30, 'Exporting cards to Excel...', options);
      logger.info('Exporting cards to Excel', { workflowId, cardCount: cards.length });

      const excelBuffer = await ExcelExportService.exportCardsToExcel({ cards });

      logger.info('Excel export completed', { workflowId, bufferSize: Buffer.byteLength(excelBuffer) });

      // Step 3: Upload to doremon-ai
      this.updateProgress(workflowId, 'uploading_to_doremon', 50, 'Uploading Excel to doremon-ai...', options);
      logger.info('Uploading Excel to doremon-ai', { workflowId });

      const uploadResponse = await doremonIntegrationService.uploadExcelToDoremon(
        excelBuffer,
        `cards_${options.bin}_${Date.now()}.xlsx`
      );

      const processId = uploadResponse.processId;
      logger.info('Excel uploaded to doremon-ai', { workflowId, processId });

      // Step 4: Wait for processing (poll status)
      this.updateProgress(workflowId, 'processing', 60, 'Processing cards...', options);
      logger.info('Waiting for processing to complete', { workflowId, processId });

      const statusCheckInterval = parseInt(
        process.env.WORKFLOW_STATUS_CHECK_INTERVAL || '5000',
        10
      );
      const maxWaitTime = parseInt(process.env.WORKFLOW_MAX_WAIT_TIME || '3600000', 10); // 1 hour default
      const startWaitTime = Date.now();

      let status: ProcessingStatusResponse;
      do {
        await new Promise((resolve) => setTimeout(resolve, statusCheckInterval));

        status = await doremonIntegrationService.getProcessingStatus(processId);

        this.updateProgress(
          workflowId,
          'processing',
          60 + Math.floor(status.progress * 0.3), // 60-90% for processing
          `Processing: ${status.currentStep || 'In progress'} (${status.progress}%)`,
          { ...options, processId, status }
        );

        if (status.status === 'failed') {
          throw new Error(status.errorMessage || 'Processing failed');
        }

        // Check timeout
        if (Date.now() - startWaitTime > maxWaitTime) {
          throw new Error('Processing timeout exceeded');
        }
      } while (status.status !== 'completed');

      logger.info('Processing completed', { workflowId, processId, status: status.status });

      // Step 5: Download results
      this.updateProgress(workflowId, 'downloading_results', 90, 'Downloading processed Excel...', options);
      logger.info('Downloading processed Excel', { workflowId, processId });

      const resultBuffer = await doremonIntegrationService.downloadProcessedExcel(processId);

      logger.info('Results downloaded', { workflowId, processId, bufferSize: resultBuffer.length });

      // Step 6: Complete
      this.updateProgress(workflowId, 'completed', 100, 'Workflow completed successfully', options);

      const result: WorkflowResult = {
        workflowId,
        status: 'completed',
        processId,
        excelFileBuffer: resultBuffer,
        totalCards: cards.length,
        verifiedCards: status.verifiedCards,
        failedCards: status.failedCards,
        completedAt: new Date(),
      };

      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordWorkflowComplete(duration);
      
      logger.info('Workflow completed successfully', {
        workflowId,
        processId,
        totalCards: result.totalCards,
        verifiedCards: result.verifiedCards,
        failedCards: result.failedCards,
        duration,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordWorkflowFailure(duration);
      
      logger.error('Workflow failed', { workflowId, error: errorMessage });

      this.updateProgress(workflowId, 'failed', 0, `Workflow failed: ${errorMessage}`, options);

      return {
        workflowId,
        status: 'failed',
        totalCards: 0,
        errorMessage,
        completedAt: new Date(),
      };
    } finally {
      // Clean up after a delay (keep for status queries)
      setTimeout(() => {
        this.workflows.delete(workflowId);
      }, 3600000); // Keep for 1 hour
    }
  }

  /**
   * Get workflow progress
   */
  public getWorkflowProgress(workflowId: string): WorkflowProgress | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Update workflow progress
   */
  private updateProgress(
    workflowId: string,
    step: WorkflowStep,
    progress: number,
    message?: string,
    data?: WorkflowOptions | Record<string, unknown>
  ): void {
    const progressData: WorkflowProgress = {
      workflowId,
      step,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      data: data as Record<string, unknown> | undefined,
    };

    this.workflows.set(workflowId, progressData);

    logger.info('Workflow progress updated', progressData);
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator();
