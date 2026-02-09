import {
  createCardGenerationJob,
  getJobStatus,
  getJobResult,
  cancelJob,
  getQueueStats,
  CardGenerationJobData,
  JobStatus,
} from './jobQueue';
import { CardGenerationService } from './cardGeneration';
import { logger } from '../utils/logger';
import config from '../config';
import { emitJobProgress, emitJobCompleted, emitJobError } from './websocketService';

/**
 * Normalize JobId to string
 */
const normalizeJobId = (jobId: string | number | undefined): string => {
  if (jobId === undefined) {
    throw new Error('Job ID is required');
  }
  return String(jobId);
};

/**
 * Card Generation Queue Service
 * High-level abstraction for card generation job management
 */
export class CardGenerationQueueService {
  /**
   * Create async job for bulk card generation
   */
  public async createGenerationJob(
    options: CardGenerationJobData
  ): Promise<{ jobId: string; status: string }> {
    try {
      // Determine priority based on count
      let priority = config.jobQueue.priority.normal;
      if (options.count > 1000) {
        priority = config.jobQueue.priority.high;
      } else if (options.count < 10) {
        priority = config.jobQueue.priority.low;
      }

      const job = await createCardGenerationJob(options, { priority });
      
      return {
        jobId: normalizeJobId(job.id),
        status: 'created',
      };
    } catch (error) {
      logger.error('Failed to create generation job', { error, options });
      throw error;
    }
  }

  /**
   * Get job status
   */
  public async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      return await getJobStatus(jobId);
    } catch (error) {
      logger.error('Failed to get job status', { error, jobId });
      return null;
    }
  }

  /**
   * Get job result
   */
  public async getJobResult(jobId: string): Promise<any> {
    try {
      return await getJobResult(jobId);
    } catch (error) {
      logger.error('Failed to get job result', { error, jobId });
      throw error;
    }
  }

  /**
   * Cancel job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      return await cancelJob(jobId);
    } catch (error) {
      logger.error('Failed to cancel job', { error, jobId });
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  public async getQueueStatistics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return await getQueueStats();
  }
}

export const cardGenerationQueueService = new CardGenerationQueueService();

/**
 * Job processor function (to be used by worker)
 * This processes card generation jobs
 */
export const processCardGenerationJob = async (
  job: { id: string; data: CardGenerationJobData; progress: (progress: number) => Promise<void> }
): Promise<any> => {
  const { data } = job;
  logger.info('Processing card generation job', { jobId: job.id, bin: data.bin, count: data.count });

  try {
    // Update progress
    await job.progress(10);

    let cards: any[] = [];

    // Generate cards based on mode
    if (data.generationMode === 'batch_999') {
      // Generate 999 cards with CVV variants
      await job.progress(20);
      emitJobProgress(job.id, 20, { message: 'Generating 999 cards with CVV variants...' });
      cards = await CardGenerationService.generateAndSave999CardsWithCVV({
        bin: data.bin,
        expiryMonths: data.expiryMonths,
        userId: data.userId,
        apiKeyId: data.apiKeyId,
        requestId: data.requestId,
      });
    } else if (data.count > 1) {
      // Generate multiple cards
      await job.progress(30);
      emitJobProgress(job.id, 30, { message: `Generating ${data.count} cards...` });
      cards = await CardGenerationService.generateAndSaveMultipleFromBIN({
        bin: data.bin,
        count: data.count,
        expiryMonths: data.expiryMonths,
        sequential: data.sequential,
        startSequence: data.startSequence,
        userId: data.userId,
        apiKeyId: data.apiKeyId,
        requestId: data.requestId,
      });
    } else {
      // Generate single card
      await job.progress(40);
      emitJobProgress(job.id, 40, { message: 'Generating single card...' });
      const card = await CardGenerationService.generateAndSaveFromBIN({
        bin: data.bin,
        expiryMonths: data.expiryMonths,
        sequential: data.sequential,
        startSequence: data.startSequence,
        userId: data.userId,
        apiKeyId: data.apiKeyId,
        requestId: data.requestId,
        useUniquenessService: true, // Use new uniqueness service
      });
      cards = [card];
    }

    await job.progress(100);
    emitJobProgress(job.id, 100, { message: 'Generation completed' });

    logger.info('Card generation job completed', {
      jobId: job.id,
      cardsGenerated: cards.length,
    });

    const result = {
      success: true,
      cardsGenerated: cards.length,
      cards: cards.map(card => ({
        cardNumber: card.cardNumber,
        bin: card.bin,
        expiryDate: card.expiryDate,
        cvv: card.cvv,
      })),
    };

    // Emit WebSocket completion event
    emitJobCompleted(job.id, result);

    return result;
  } catch (error) {
    logger.error('Card generation job failed', {
      error,
      jobId: job.id,
      bin: data.bin,
    });

    // Emit WebSocket error event
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    emitJobError(job.id, errorMessage);

    throw error;
  }
};
