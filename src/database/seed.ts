import dotenv from 'dotenv';
import { database, initializeSchema } from './connection';
import { countryModel } from '../models/country';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config({ path: require('path').join(process.cwd(), '.env') });

async function seed(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting database seeding...');
    
    // Connect to database
    await database.connect();
    logger.info('Database connected');
    
    // Initialize schema (only if needed)
    const forceSchema = process.argv.includes('--force-schema');
    if (forceSchema) {
      await initializeSchema();
      logger.info('Database schema initialized');
    }
    
    // Seed countries
    const forceSeed = process.argv.includes('--force-seed');
    await countryModel.seedDefaultCountries(forceSeed);
    logger.info('Countries seeding completed', { forceSeed });
    
    const duration = Date.now() - startTime;
    logger.info('Database seeding completed successfully', { 
      duration: `${duration}ms`,
      forceSchema,
      forceSeed 
    });
    
  } catch (error) {
    logger.error('Database seeding failed', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    await database.disconnect();
    logger.info('Database connection closed');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seed();
}

export { seed };