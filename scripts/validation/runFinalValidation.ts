#!/usr/bin/env node
/**
 * Final Validation Script
 * Run comprehensive validation before production deployment
 */

import dotenv from 'dotenv';
import { binService } from '../../src/services/bin';
import { dataQualityMonitor } from '../../src/monitoring/dataQualityMonitor';
import { optimizedCacheManager } from '../../src/services/advancedCaching/optimizedCache';
import { logger } from '../../src/utils/logger';
import database from '../../src/database/connection';

dotenv.config({ path: '.env' });

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Run all validations
 */
async function runValidations(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. Database connectivity
  try {
    await database.connect();
    results.push({
      name: 'Database Connectivity',
      passed: true,
      message: 'Database connection successful',
    });
  } catch (error) {
    results.push({
      name: 'Database Connectivity',
      passed: false,
      message: `Database connection failed: ${error}`,
    });
  }

  // 2. BIN lookup functionality
  try {
    const result = await binService.lookup('400000');
    results.push({
      name: 'BIN Lookup',
      passed: result !== null,
      message: result ? 'BIN lookup working' : 'BIN lookup returned null',
    });
  } catch (error) {
    results.push({
      name: 'BIN Lookup',
      passed: false,
      message: `BIN lookup failed: ${error}`,
    });
  }

  // 3. Cache performance
  try {
    const testBINs = ['400000', '510000', '378282'];
    
    // Warm cache
    for (const bin of testBINs) {
      await binService.lookup(bin);
    }

    // Measure
    const responseTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const bin = testBINs[i % testBINs.length];
      const start = Date.now();
      await binService.lookup(bin);
      responseTimes.push(Date.now() - start);
    }

    responseTimes.sort((a, b) => a - b);
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const metrics = optimizedCacheManager.getMetrics();

    results.push({
      name: 'Cache Performance',
      passed: p95 < 50 && metrics.overall.overallHitRate > 95,
      message: `p95: ${p95}ms, Hit Rate: ${metrics.overall.overallHitRate.toFixed(2)}%`,
      details: { p95, hitRate: metrics.overall.overallHitRate },
    });
  } catch (error) {
    results.push({
      name: 'Cache Performance',
      passed: false,
      message: `Cache performance test failed: ${error}`,
    });
  }

  // 4. Quality monitoring
  try {
    const qualityResult = await dataQualityMonitor.collectMetrics();
    const passed = qualityResult.currentMetrics.overall.overallScore > 0.80;
    
    results.push({
      name: 'Quality Monitoring',
      passed,
      message: `Overall quality score: ${(qualityResult.currentMetrics.overall.overallScore * 100).toFixed(2)}%`,
      details: {
        overallScore: qualityResult.currentMetrics.overall.overallScore,
        anomalies: qualityResult.anomalies.summary.total,
      },
    });
  } catch (error) {
    results.push({
      name: 'Quality Monitoring',
      passed: false,
      message: `Quality monitoring failed: ${error}`,
    });
  }

  return results;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  logger.info('Starting final validation...');

  try {
    const results = await runValidations();

    // Print results
    console.log('\n=== Validation Results ===\n');
    
    let allPassed = true;
    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.name}: ${result.message}`);
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
      if (!result.passed) {
        allPassed = false;
      }
    }

    console.log('\n=== Summary ===\n');
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`Passed: ${passedCount}/${totalCount}`);

    if (allPassed) {
      console.log('\n✅ All validations passed - System ready for production');
      process.exit(0);
    } else {
      console.log('\n❌ Some validations failed - Review issues before deployment');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Validation failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in validation', { error });
    process.exit(1);
  });
}

export { runValidations };
