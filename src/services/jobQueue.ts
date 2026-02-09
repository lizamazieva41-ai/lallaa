import Queue from 'bull';
import { getRedisClient } from './redisConnection';
import config from '../config';
import { logger } from '../utils/logger';

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
 * Job Queue Service using Bull Queue
 * Handles async bulk card generation jobs
 */

export interface CardGenerationJobData {
  bin: string;
  count: number;
  expiryMonths?: number;
  sequential?: boolean;
  startSequence?: number;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
  generationMode: 'random' | 'sequential' | 'batch_999';
}

export interface JobStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

let cardGenerationQueue: Queue.Queue<CardGenerationJobData> | null = null;

/**
 * Initialize job queue
 */
export const initializeJobQueue = async (): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    if (!redisClient) {
      logger.warn('Redis client not available, job queue will be disabled');
      return;
    }

    // Create Bull Queue instance
    cardGenerationQueue = new Queue<CardGenerationJobData>('card-generation', {
      redis: {
        host: config.bullQueue.redis.host,
        port: config.bullQueue.redis.port,
        password: config.bullQueue.redis.password || undefined,
        db: config.bullQueue.redis.db,
      },
      defaultJobOptions: {
        attempts: config.bullQueue.defaultJobAttempts,
        backoff: {
          type: 'exponential',
          delay: config.bullQueue.defaultJobBackoffDelay,
        },
        timeout: config.bullQueue.defaultJobTimeout,
        removeOnComplete: config.jobQueue.removeOnComplete,
        removeOnFail: config.jobQueue.removeOnFail,
      },
      settings: {
        maxStalledCount: 1,
        retryProcessDelay: 5000,
      },
    });

    // Queue event handlers
    cardGenerationQueue.on('error', (error) => {
      logger.error('Job queue error', { error });
    });

    cardGenerationQueue.on('waiting', (jobId) => {
      logger.debug('Job waiting', { jobId });
    });

    cardGenerationQueue.on('active', (job) => {
      logger.debug('Job active', { jobId: job.id });
    });

    cardGenerationQueue.on('completed', (job) => {
      logger.info('Job completed', { jobId: job.id });
    });

    cardGenerationQueue.on('failed', (job, err) => {
      logger.error('Job failed', { jobId: job?.id, error: err.message });
    });

    cardGenerationQueue.on('stalled', (job) => {
      logger.warn('Job stalled', { jobId: job.id });
    });

    logger.info('Job queue initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job queue', { error });
    cardGenerationQueue = null;
  }
};

/**
 * Get job queue instance
 */
export const getJobQueue = (): Queue.Queue<CardGenerationJobData> | null => {
  return cardGenerationQueue;
};

/**
 * Create a new card generation job
 */
export const createCardGenerationJob = async (
  data: CardGenerationJobData,
  options?: {
    priority?: number;
    delay?: number;
  }
): Promise<Queue.Job<CardGenerationJobData>> => {
  if (!cardGenerationQueue) {
    throw new Error('Job queue not initialized');
  }

  const jobOptions: Queue.JobOptions = {
    priority: options?.priority || config.jobQueue.priority.normal,
    delay: options?.delay || 0,
  };

  const job = await cardGenerationQueue.add(data, jobOptions);
  logger.info('Card generation job created', {
    jobId: job.id,
    bin: data.bin,
    count: data.count,
  });

  return job;
};

/**
 * Get job status
 */
export const getJobStatus = async (jobId: string): Promise<JobStatus | null> => {
  if (!cardGenerationQueue) {
    return null;
  }

  try {
    const job = await cardGenerationQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      jobId: normalizeJobId(job.id),
      status: state as JobStatus['status'],
      progress: typeof progress === 'number' ? progress : 0,
      result: job.returnvalue || undefined,
      error: job.failedReason || undefined,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  } catch (error) {
    logger.error('Failed to get job status', { error, jobId });
    return null;
  }
};

/**
 * Get job result
 */
export const getJobResult = async (jobId: string): Promise<any> => {
  if (!cardGenerationQueue) {
    throw new Error('Job queue not initialized');
  }

  const job = await cardGenerationQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  const state = await job.getState();
  if (state === 'failed') {
    throw new Error(job.failedReason || 'Job failed');
  }

  if (state !== 'completed') {
    throw new Error(`Job not completed. Current state: ${state}`);
  }

  return job.returnvalue;
};

/**
 * Cancel a job
 */
export const cancelJob = async (jobId: string): Promise<boolean> => {
  if (!cardGenerationQueue) {
    return false;
  }

  try {
    const job = await cardGenerationQueue.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    logger.info('Job cancelled', { jobId });
    return true;
  } catch (error) {
    logger.error('Failed to cancel job', { error, jobId });
    return false;
  }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> => {
  if (!cardGenerationQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      cardGenerationQueue.getWaitingCount(),
      cardGenerationQueue.getActiveCount(),
      cardGenerationQueue.getCompletedCount(),
      cardGenerationQueue.getFailedCount(),
      cardGenerationQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { error });
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }
};

/**
 * Close job queue
 */
export const closeJobQueue = async (): Promise<void> => {
  if (cardGenerationQueue) {
    await cardGenerationQueue.close();
    cardGenerationQueue = null;
    logger.info('Job queue closed');
  }
};
