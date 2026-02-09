/**
 * Load Testing Script
 * Validates performance targets:
 * - Single card: <100ms
 * - Batch 1000: <10s
 * - Throughput: 100K+ cards/hour
 * Run as: npm run load-test
 */

import axios from 'axios';
import { logger } from '../src/utils/logger';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  target: number;
  cardsGenerated?: number;
  error?: string;
}

interface LoadTestConfig {
  baseUrl: string;
  authToken: string;
  apiKey?: string;
}

/**
 * Test single card generation performance
 */
async function testSingleCardGeneration(config: LoadTestConfig): Promise<TestResult> {
  const startTime = Date.now();
  const target = 100; // 100ms target

  try {
    const response = await axios.post(
      `${config.baseUrl}/api/v1/cards/generate-from-bin`,
      {
        bin: '411111',
        expiryMonths: 12,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'X-API-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const duration = Date.now() - startTime;
    const success = duration < target && response.status === 200;

    return {
      name: 'Single Card Generation',
      success,
      duration,
      target,
      cardsGenerated: 1,
    };
  } catch (error: any) {
    return {
      name: 'Single Card Generation',
      success: false,
      duration: Date.now() - startTime,
      target,
      error: error.message,
    };
  }
}

/**
 * Test batch generation (1000 cards) performance
 */
async function testBatchGeneration(config: LoadTestConfig): Promise<TestResult> {
  const startTime = Date.now();
  const target = 10000; // 10s target
  const count = 1000;

  try {
    // Use async endpoint for large batches
    const jobResponse = await axios.post(
      `${config.baseUrl}/api/v1/cards/generate-async`,
      {
        bin: '411111',
        count,
        expiryMonths: 12,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'X-API-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const jobId = jobResponse.data.data.jobId;

    // Poll for job completion
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      const statusResponse = await axios.get(
        `${config.baseUrl}/api/v1/cards/jobs/${jobId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
            'X-API-Key': config.apiKey,
          },
        }
      );

      const status = statusResponse.data.data.status;
      if (status === 'completed') {
        completed = true;
      } else if (status === 'failed') {
        throw new Error('Job failed');
      }

      attempts++;
    }

    if (!completed) {
      throw new Error('Job timeout');
    }

    const duration = Date.now() - startTime;
    const success = duration < target;

    // Get result
    const resultResponse = await axios.get(
      `${config.baseUrl}/api/v1/cards/jobs/${jobId}/result`,
      {
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'X-API-Key': config.apiKey,
        },
      }
    );

    return {
      name: 'Batch Generation (1000 cards)',
      success,
      duration,
      target,
      cardsGenerated: resultResponse.data.data.result?.cardsGenerated || 0,
    };
  } catch (error: any) {
    return {
      name: 'Batch Generation (1000 cards)',
      success: false,
      duration: Date.now() - startTime,
      target,
      error: error.message,
    };
  }
}

/**
 * Test throughput (100K cards/hour)
 */
async function testThroughput(config: LoadTestConfig): Promise<TestResult> {
  const startTime = Date.now();
  const target = 3600000; // 1 hour
  const targetCards = 100000; // 100K cards
  const batchSize = 1000;
  const batches = Math.ceil(targetCards / batchSize);

  try {
    let totalCards = 0;
    const jobIds: string[] = [];

    // Create multiple async jobs
    for (let i = 0; i < batches; i++) {
      const jobResponse = await axios.post(
        `${config.baseUrl}/api/v1/cards/generate-async`,
        {
          bin: '411111',
          count: batchSize,
          expiryMonths: 12,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
            'X-API-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      jobIds.push(jobResponse.data.data.jobId);
    }

    // Wait for all jobs to complete
    const maxWaitTime = target;
    const checkInterval = 5000; // Check every 5 seconds
    let elapsed = 0;

    while (elapsed < maxWaitTime && jobIds.length > 0) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      // Check job statuses
      const statusChecks = await Promise.allSettled(
        jobIds.map(jobId =>
          axios.get(
            `${config.baseUrl}/api/v1/cards/jobs/${jobId}/status`,
            {
              headers: {
                'Authorization': `Bearer ${config.authToken}`,
                'X-API-Key': config.apiKey,
              },
            }
          )
        )
      );

      // Remove completed jobs
      for (let i = jobIds.length - 1; i >= 0; i--) {
        const check = statusChecks[i];
        if (check.status === 'fulfilled') {
          const status = check.value.data.data.status;
          if (status === 'completed') {
            // Get result
            try {
              const resultResponse = await axios.get(
                `${config.baseUrl}/api/v1/cards/jobs/${jobIds[i]}/result`,
                {
                  headers: {
                    'Authorization': `Bearer ${config.authToken}`,
                    'X-API-Key': config.apiKey,
                  },
                }
              );
              totalCards += resultResponse.data.data.result?.cardsGenerated || 0;
            } catch (error) {
              // Ignore errors getting results
            }
            jobIds.splice(i, 1);
          } else if (status === 'failed') {
            jobIds.splice(i, 1);
          }
        }
      }

      if (jobIds.length === 0) {
        break;
      }
    }

    const duration = Date.now() - startTime;
    const cardsPerHour = (totalCards / duration) * 3600000;
    const success = cardsPerHour >= targetCards;

    return {
      name: 'Throughput Test (100K cards/hour)',
      success,
      duration,
      target,
      cardsGenerated: totalCards,
    };
  } catch (error: any) {
    return {
      name: 'Throughput Test (100K cards/hour)',
      success: false,
      duration: Date.now() - startTime,
      target,
      error: error.message,
    };
  }
}

/**
 * Test concurrent generation uniqueness
 */
async function testConcurrentUniqueness(config: LoadTestConfig): Promise<TestResult> {
  const startTime = Date.now();
  const concurrentRequests = 50;
  const cardsPerRequest = 10;

  try {
    // Create concurrent requests
    const requests = Array.from({ length: concurrentRequests }, () =>
      axios.post(
        `${config.baseUrl}/api/v1/cards/generate-from-bin`,
        {
          bin: '411111',
          count: cardsPerRequest,
          expiryMonths: 12,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
            'X-API-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const responses = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;

    // Collect all generated cards
    const allCards: Set<string> = new Set();
    let totalCards = 0;

    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value.data.data) {
        const cards = response.value.data.data.cards || [];
        for (const card of cards) {
          const cardKey = `${card.cardNumber}-${card.expiryDate}-${card.cvv}`;
          if (allCards.has(cardKey)) {
            return {
              name: 'Concurrent Uniqueness Test',
              success: false,
              duration,
              target: 0,
              error: 'Duplicate card detected',
            };
          }
          allCards.add(cardKey);
          totalCards++;
        }
      }
    }

    return {
      name: 'Concurrent Uniqueness Test',
      success: true,
      duration,
      target: 0,
      cardsGenerated: totalCards,
    };
  } catch (error: any) {
    return {
      name: 'Concurrent Uniqueness Test',
      success: false,
      duration: Date.now() - startTime,
      target: 0,
      error: error.message,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const authToken = process.env.AUTH_TOKEN || '';
  const apiKey = process.env.API_KEY;

  if (!authToken) {
    console.error('Error: AUTH_TOKEN environment variable is required');
    process.exit(1);
  }

  const config: LoadTestConfig = {
    baseUrl,
    authToken,
    apiKey,
  };

  console.log('\n=== Load Testing Suite ===');
  console.log(`Base URL: ${baseUrl}`);
  console.log('==========================\n');

  const results: TestResult[] = [];

  // Test 1: Single card generation
  console.log('Running: Single Card Generation Test...');
  const singleResult = await testSingleCardGeneration(config);
  results.push(singleResult);
  console.log(`Result: ${singleResult.success ? '✅ PASS' : '❌ FAIL'} - ${singleResult.duration}ms (target: <${singleResult.target}ms)`);
  if (singleResult.error) {
    console.log(`Error: ${singleResult.error}`);
  }

  // Test 2: Batch generation
  console.log('\nRunning: Batch Generation Test (1000 cards)...');
  const batchResult = await testBatchGeneration(config);
  results.push(batchResult);
  console.log(`Result: ${batchResult.success ? '✅ PASS' : '❌ FAIL'} - ${batchResult.duration}ms (target: <${batchResult.target}ms)`);
  console.log(`Cards generated: ${batchResult.cardsGenerated || 0}`);
  if (batchResult.error) {
    console.log(`Error: ${batchResult.error}`);
  }

  // Test 3: Concurrent uniqueness
  console.log('\nRunning: Concurrent Uniqueness Test...');
  const uniquenessResult = await testConcurrentUniqueness(config);
  results.push(uniquenessResult);
  console.log(`Result: ${uniquenessResult.success ? '✅ PASS' : '❌ FAIL'} - ${uniquenessResult.duration}ms`);
  console.log(`Cards generated: ${uniquenessResult.cardsGenerated || 0}`);
  if (uniquenessResult.error) {
    console.log(`Error: ${uniquenessResult.error}`);
  }

  // Test 4: Throughput (optional - takes longer)
  if (process.env.RUN_THROUGHPUT_TEST === 'true') {
    console.log('\nRunning: Throughput Test (100K cards/hour)...');
    const throughputResult = await testThroughput(config);
    results.push(throughputResult);
    console.log(`Result: ${throughputResult.success ? '✅ PASS' : '❌ FAIL'} - ${throughputResult.duration}ms`);
    console.log(`Cards generated: ${throughputResult.cardsGenerated || 0}`);
    if (throughputResult.error) {
      console.log(`Error: ${throughputResult.error}`);
    }
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('===================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Load testing failed', { error });
    process.exit(1);
  });
}

export { testSingleCardGeneration, testBatchGeneration, testThroughput, testConcurrentUniqueness };
