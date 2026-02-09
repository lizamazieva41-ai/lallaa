/**
 * Card Generation Worker
 * Processes card generation jobs from the queue
 * Run this as a separate process: npm run job:worker
 */

import { getJobQueue, initializeJobQueue } from '../services/jobQueue';
import { processCardGenerationJob } from '../services/cardGenerationQueue';
import { initializeRedis } from '../services/redisConnection';
import database from '../database/connection';
import { logger } from '../utils/logger';
import config from '../config';

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
 * Initialize and start worker
 */
const startWorker = async () => {
  try {
    logger.info('Starting card generation worker...');

    // Initialize Redis connection
    await initializeRedis();

    // Initialize job queue
    await initializeJobQueue();

    const queue = getJobQueue();
    if (!queue) {
      throw new Error('Job queue not initialized');
    }

    // Process jobs with concurrency
    queue.process(
      config.bullQueue.concurrency,
      async (job) => {
        const startTime = Date.now();
        try {
          const result = await processCardGenerationJob({
            id: normalizeJobId(job.id),
            data: job.data,
            progress: async (progress: number) => {
              await job.progress(progress);
            },
          });
          
          const duration = (Date.now() - startTime) / 1000;
          const { recordJobQueueOperation } = await import('../services/metrics');
          recordJobQueueOperation('process', 'success', duration);
          
          return result;
        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;
          const { recordJobQueueOperation } = await import('../services/metrics');
          recordJobQueueOperation('process', 'failed', duration);
          throw error;
        }
      }
    );

    logger.info('Card generation worker started', {
      concurrency: config.bullQueue.concurrency,
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down worker gracefully...');
      await queue.close();
      await database.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down worker gracefully...');
      await queue.close();
      await database.disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start worker', { error });
    process.exit(1);
  }
};

// Start worker if run directly
if (require.main === module) {
  startWorker().catch((error) => {
    logger.error('Worker startup failed', { error });
    process.exit(1);
  });
}

export { startWorker };
