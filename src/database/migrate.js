// Production migration script (JavaScript version)
// This allows running migrations without TypeScript dependencies

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'bincheck',
  password: process.env.POSTGRES_PASSWORD || 'bincheck_secret',
  database: process.env.POSTGRES_DB || 'bincheck',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Simple logger for production
const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, meta);
  },
  error: (message, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, meta);
  },
  debug: (message, meta = {}) => {
    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, meta);
    }
  }
};

// Default countries data (same as TypeScript version)
const defaultCountries = [
  { countryCode: 'DE', countryName: 'Germany', continent: 'Europe', currencyCode: 'EUR', currencyName: 'Euro', ibanLength: 22, bankCodeLength: 8, accountNumberLength: 10, exampleIban: 'DE89370400440532013000', ibanRegex: '^DE\\d{2}[ ]\\d{4}[ ]\\d{4}[ ]\\d{4}[ ]\\d{2}[ ]\\d{3}$', isSEPA: true },
  { countryCode: 'FR', countryName: 'France', continent: 'Europe', currencyCode: 'EUR', currencyName: 'Euro', ibanLength: 27, bankCodeLength: 5, accountNumberLength: 11, exampleIban: 'FR7630006000011234567890189', ibanRegex: '^FR\\d{2}[ ]\\d{4}[ ]\\d{4}[ ]\\d{4}[ ]\\d{4}[ ]\\d{3}$', isSEPA: true },
  { countryCode: 'GB', countryName: 'United Kingdom', continent: 'Europe', currencyCode: 'GBP', currencyName: 'British Pound', ibanLength: 22, bankCodeLength: 4, accountNumberLength: 8, exampleIban: 'GB82WEST12345698765432', ibanRegex: '^GB\\d{2}[A-Z]{4}\\d{6}\\d{8}$', isSEPA: false },
  { countryCode: 'US', countryName: 'United States', continent: 'North America', currencyCode: 'USD', currencyName: 'US Dollar', ibanLength: 0, bankCodeLength: 9, accountNumberLength: 0, exampleIban: '', ibanRegex: '', isSEPA: false },
  { countryCode: 'JP', countryName: 'Japan', continent: 'Asia', currencyCode: 'JPY', currencyName: 'Japanese Yen', ibanLength: 0, bankCodeLength: 7, accountNumberLength: 0, exampleIban: '', ibanRegex: '', isSEPA: false },
  { countryCode: 'AU', countryName: 'Australia', continent: 'Oceania', currencyCode: 'AUD', currencyName: 'Australian Dollar', ibanLength: 0, bankCodeLength: 6, accountNumberLength: 0, exampleIban: '', ibanRegex: '', isSEPA: false },
  { countryCode: 'CA', countryName: 'Canada', continent: 'North America', currencyCode: 'CAD', currencyName: 'Canadian Dollar', ibanLength: 0, bankCodeLength: 9, accountNumberLength: 0, exampleIban: '', ibanRegex: '', isSEPA: false },
  { countryCode: 'IT', countryName: 'Italy', continent: 'Europe', currencyCode: 'EUR', currencyName: 'Euro', ibanLength: 27, bankCodeLength: 5, accountNumberLength: 12, exampleIban: 'IT60X0542811101000000123456', ibanRegex: '^IT\\d{2}[A-Z]\\d{5}\\d{5}[A-Z0-9]{12}$', isSEPA: true },
  { countryCode: 'ES', countryName: 'Spain', continent: 'Europe', currencyCode: 'EUR', currencyName: 'Euro', ibanLength: 24, bankCodeLength: 4, accountNumberLength: 14, exampleIban: 'ES9121000418450200051332', ibanRegex: '^ES\\d{2}\\d{4}\\d{4}\\d{4}\\d{4}\\d{4}$', isSEPA: true },
  { countryCode: 'NL', countryName: 'Netherlands', continent: 'Europe', currencyCode: 'EUR', currencyName: 'Euro', ibanLength: 18, bankCodeLength: 4, accountNumberLength: 10, exampleIban: 'NL91ABNA0417164300', ibanRegex: '^NL\\d{2}[A-Z]{4}\\d{10}$', isSEPA: true },
];

// Initialize database schema using master schema
async function initializeSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema-master.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schemaSQL);
    logger.info('Database schema initialized');
  } catch (error) {
    logger.error('Failed to initialize database schema', { error: error.message });
    throw error;
  }
}

// Seed countries (idempotent)
async function seedDefaultCountries(force = false) {
  if (!force) {
    const existingCount = await pool.query(
      'SELECT COUNT(*) as count FROM countries'
    );
    const count = parseInt(existingCount.rows[0].count);
    
    if (count > 0) {
      logger.info('Countries already exist, skipping seed', { count });
      return;
    }
  }

  let seededCount = 0;
  for (const country of defaultCountries) {
    try {
      await pool.query(`
        INSERT INTO countries (
          country_code, country_name, continent, currency_code, currency_name,
          iban_length, bank_code_length, account_number_length, example_iban,
          iban_regex, is_sepa, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (country_code) DO UPDATE SET
          country_name = EXCLUDED.country_name,
          continent = EXCLUDED.continent,
          currency_code = EXCLUDED.currency_code,
          currency_name = EXCLUDED.currency_name,
          iban_length = EXCLUDED.iban_length,
          bank_code_length = EXCLUDED.bank_code_length,
          account_number_length = EXCLUDED.account_number_length,
          example_iban = EXCLUDED.example_iban,
          iban_regex = EXCLUDED.iban_regex,
          is_sepa = EXCLUDED.is_sepa,
          updated_at = CURRENT_TIMESTAMP
      `, [
        country.countryCode, country.countryName, country.continent, country.currencyCode, country.currencyName,
        country.ibanLength, country.bankCodeLength, country.accountNumberLength, country.exampleIban,
        country.ibanRegex, country.isSEPA
      ]);
      
      seededCount++;
      logger.debug('Country upserted', { countryCode: country.countryCode });
    } catch (error) {
      logger.error('Failed to seed country', { error, countryCode: country.countryCode });
      throw error;
    }
  }
  
  logger.info('Countries seeding completed', { 
    totalCountries: defaultCountries.length,
    seededCount,
    force 
  });
}

// Main migration function
async function migrate() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting production database migration...');
    
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connection successful');
    
    // Initialize schema
    await initializeSchema();
    
    // Seed default countries
    const forceSeed = process.argv.includes('--force-seed');
    await seedDefaultCountries(forceSeed);
    
    const duration = Date.now() - startTime;
    logger.info('Production database migration completed successfully', { 
      duration: `${duration}ms`,
      forceSeed 
    });
    
  } catch (error) {
    logger.error('Production database migration failed', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  } finally {
    await pool.end();
    logger.info('Database connection closed');
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception during migration', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection during migration', { reason });
  process.exit(1);
});

// Run migration
if (require.main === module) {
  migrate();
}

module.exports = { migrate };