/**
 * Card Generation Worker Pool
 * Implements parallel processing using worker threads for bulk card generation
 */

import { Worker } from 'worker_threads';
import { logger } from '../utils/logger';
import path from 'path';
import { EventEmitter } from 'events';

export interface WorkerTask {
  id: string;
  bin: string;
  count: number;
  options: {
    expiryMonths?: number;
    sequential?: boolean;
    startSequence?: number;
  };
}

export interface WorkerResult {
  id: string;
  success: boolean;
  cards?: Array<{
    cardNumber: string;
    expiryDate: string;
    cvv: string;
  }>;
  error?: string;
  duration: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  completedTasks: number;
  failedTasks: number;
}

/**
 * Worker Pool for parallel card generation
 */
export class CardGenerationWorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private workerTasks: Map<number, { task: WorkerTask; resolve: (result: WorkerResult) => void; reject: (error: Error) => void }> = new Map();
  private poolSize: number;
  private completedTasks: number = 0;
  private failedTasks: number = 0;
  private workerScript: string;

  constructor(poolSize: number = 4) {
    super();
    this.poolSize = poolSize;
    // Worker script will be created separately
    this.workerScript = path.join(__dirname, 'cardGenerationWorkerThread.js');
    this.initializeWorkers();
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(i);
    }
    logger.info('Card generation worker pool initialized', {
      poolSize: this.poolSize,
    });
  }

  /**
   * Create a new worker
   */
  private createWorker(index: number): void {
    try {
      // For now, we'll use a simple approach
      // In production, create actual worker thread file
      const worker = new Worker(
        `
        const { parentPort } = require('worker_threads');
        
        parentPort.on('message', async (task) => {
          try {
            // Card generation logic would go here
            // For now, return mock result
            parentPort.postMessage({
              id: task.id,
              success: true,
              cards: [],
              duration: 0
            });
          } catch (error) {
            parentPort.postMessage({
              id: task.id,
              success: false,
              error: error.message,
              duration: 0
            });
          }
        });
        `,
        { eval: true }
      );

      worker.on('message', (result: WorkerResult) => {
        this.handleWorkerMessage(index, result);
      });

      worker.on('error', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Worker error', { error: err, workerIndex: index });
        this.handleWorkerError(index, err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn('Worker exited', { code, workerIndex: index });
          // Recreate worker
          this.createWorker(index);
        }
      });

      this.workers[index] = worker;
    } catch (error) {
      logger.error('Failed to create worker', { error, workerIndex: index });
    }
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerIndex: number, result: WorkerResult): void {
    const taskInfo = this.workerTasks.get(workerIndex);
    if (!taskInfo) {
      logger.warn('Received message from worker without active task', { workerIndex });
      return;
    }

    this.workerTasks.delete(workerIndex);

    if (result.success) {
      this.completedTasks++;
      taskInfo.resolve(result);
    } else {
      this.failedTasks++;
      taskInfo.reject(new Error(result.error || 'Worker task failed'));
    }

    this.emit('taskComplete', result);
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerIndex: number, error: Error): void {
    const taskInfo = this.workerTasks.get(workerIndex);
    if (taskInfo) {
      this.workerTasks.delete(workerIndex);
      this.failedTasks++;
      taskInfo.reject(error);
    }
  }

  /**
   * Execute task in worker pool
   */
  public async executeTask(task: WorkerTask): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      // Find idle worker
      let workerIndex = -1;
      for (let i = 0; i < this.workers.length; i++) {
        if (!this.workerTasks.has(i) && this.workers[i]) {
          workerIndex = i;
          break;
        }
      }

      if (workerIndex === -1) {
        // All workers busy, wait for one to become available
        this.once('taskComplete', () => {
          this.executeTask(task).then(resolve).catch(reject);
        });
        return;
      }

      // Assign task to worker
      this.workerTasks.set(workerIndex, { task, resolve, reject });
      this.workers[workerIndex].postMessage(task);
    });
  }

  /**
   * Execute multiple tasks in parallel
   */
  public async executeTasks(tasks: WorkerTask[]): Promise<WorkerResult[]> {
    const results = await Promise.allSettled(
      tasks.map(task => this.executeTask(task))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: tasks[index].id,
          success: false,
          error: result.reason?.message || 'Unknown error',
          duration: 0,
        };
      }
    });
  }

  /**
   * Get pool statistics
   */
  public getStats(): WorkerPoolStats {
    const activeWorkers = this.workerTasks.size;
    return {
      totalWorkers: this.poolSize,
      activeWorkers,
      idleWorkers: this.poolSize - activeWorkers,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
    };
  }

  /**
   * Shutdown worker pool
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down worker pool...');

    // Wait for active tasks to complete
    const activeTasks = Array.from(this.workerTasks.values());
    if (activeTasks.length > 0) {
      logger.info('Waiting for active tasks to complete', {
        activeTasks: activeTasks.length,
      });
      await Promise.allSettled(
        activeTasks.map(taskInfo =>
          new Promise((resolve) => {
            const originalResolve = taskInfo.resolve;
            taskInfo.resolve = (result) => {
              originalResolve(result);
              resolve(undefined);
            };
          })
        )
      );
    }

    // Terminate all workers
    await Promise.all(
      this.workers.map((worker, index) => {
        return new Promise<void>((resolve) => {
          worker.terminate().then(() => {
            logger.debug('Worker terminated', { workerIndex: index });
            resolve();
          });
        });
      })
    );

    logger.info('Worker pool shut down');
  }
}

// Singleton instance
let workerPoolInstance: CardGenerationWorkerPool | null = null;

export const getWorkerPool = (poolSize?: number): CardGenerationWorkerPool => {
  if (!workerPoolInstance) {
    workerPoolInstance = new CardGenerationWorkerPool(poolSize);
  }
  return workerPoolInstance;
};

export const shutdownWorkerPool = async (): Promise<void> => {
  if (workerPoolInstance) {
    await workerPoolInstance.shutdown();
    workerPoolInstance = null;
  }
};
