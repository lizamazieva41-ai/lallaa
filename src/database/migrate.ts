import { database, initializeSchema } from './connection';
import { countryModel } from '../models/country';
import { logger } from '../utils/logger';

async function migrate(): Promise<void> {
  try {
    logger.info('Starting database migration...');
    
    // Connect and initialize schema using the unified master schema
    await database.connect();
    await initializeSchema();
    
    // Seed countries
    await countryModel.seedDefaultCountries();
    logger.info('Countries seeded');
    
    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Database migration failed', { error });
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

export { migrate };