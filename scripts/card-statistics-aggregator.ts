import { cardStatisticsService } from '../src/services/cardStatistics';
import { logger } from '../src/utils/logger';
import { resetCardsGeneratedGauge } from '../src/services/metrics';

/**
 * Daily aggregation job for card generation statistics
 * This should be run daily (e.g., via cron at 00:00 UTC)
 * 
 * Usage:
 *   npm run stats:aggregate [YYYY-MM-DD]
 * 
 * If no date is provided, calculates for yesterday
 */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dateArg = args[0];

  let targetDate: Date;
  
  if (dateArg) {
    // Parse provided date
    targetDate = new Date(dateArg);
    if (isNaN(targetDate.getTime())) {
      console.error(`Invalid date format: ${dateArg}. Use YYYY-MM-DD`);
      process.exit(1);
    }
  } else {
    // Default to yesterday
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
  }

  targetDate.setHours(0, 0, 0, 0);

  try {
    logger.info('Starting daily statistics aggregation', {
      date: targetDate.toISOString().split('T')[0],
    });

    await cardStatisticsService.calculateDailyStatistics({
      date: targetDate,
      force: false, // Don't overwrite existing statistics
    });

    // Reset daily gauge metrics at start of new day
    if (targetDate.toDateString() === new Date().toDateString()) {
      resetCardsGeneratedGauge();
      logger.info('Reset daily card generation gauge metrics');
    }

    logger.info('Daily statistics aggregation completed', {
      date: targetDate.toISOString().split('T')[0],
    });

    process.exit(0);
  } catch (error) {
    logger.error('Failed to aggregate daily statistics', {
      error,
      date: targetDate.toISOString().split('T')[0],
    });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
