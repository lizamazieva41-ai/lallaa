import { QueryResult } from 'pg';
import database from '../database/connection';
import { DEFAULT_COUNTRIES } from '../database/seeds/001_seed_countries';
import { Country } from '../types';
import { logger } from '../utils/logger';

interface CountryRow {
  country_code: string;
  country_name: string;
  continent: string;
  currency_code: string;
  currency_name: string;
  iban_length: number;
  bank_code_length: number;
  account_number_length: number;
  example_iban: string;
  iban_regex: string;
  is_sepa: boolean;
  created_at: Date;
  updated_at: Date;
}

const mapRowToCountry = (row: CountryRow): Country => ({
  countryCode: row.country_code,
  countryName: row.country_name,
  continent: row.continent,
  currencyCode: row.currency_code,
  currencyName: row.currency_name,
  ibanLength: row.iban_length,
  bankCodeLength: row.bank_code_length,
  accountNumberLength: row.account_number_length,
  exampleIban: row.example_iban,
  ibanRegex: row.iban_regex,
  isSEPA: row.is_sepa,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class CountryModel {
  private tableName = 'countries';
  public pool = database.getPool();

  public async findByCode(countryCode: string): Promise<Country | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE country_code = $1`;

    try {
      const result: QueryResult<CountryRow> = await database.query(query, [
        countryCode.toUpperCase(),
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return mapRowToCountry(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find country', { countryCode, error });
      throw error;
    }
  }

  public async getAll(): Promise<Country[]> {
    const query = `SELECT * FROM ${this.tableName} ORDER BY country_name ASC`;

    try {
      const result: QueryResult<CountryRow> = await database.query(query);
      return result.rows.map(mapRowToCountry);
    } catch (error) {
      logger.error('Failed to get all countries', { error });
      throw error;
    }
  }

  public async getByContinent(continent: string): Promise<Country[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE continent = $1
      ORDER BY country_name ASC
    `;

    try {
      const result: QueryResult<CountryRow> = await database.query(query, [
        continent,
      ]);
      return result.rows.map(mapRowToCountry);
    } catch (error) {
      logger.error('Failed to get countries by continent', { continent, error });
      throw error;
    }
  }

  public async getSEPACountries(): Promise<Country[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE is_sepa = true
      ORDER BY country_name ASC
    `;

    try {
      const result: QueryResult<CountryRow> = await database.query(query);
      return result.rows.map(mapRowToCountry);
    } catch (error) {
      logger.error('Failed to get SEPA countries', { error });
      throw error;
    }
  }

  public async search(query: string, limit: number = 50): Promise<Country[]> {
    const searchQuery = `
      SELECT * FROM ${this.tableName}
      WHERE country_name ILIKE $1 OR country_code ILIKE $1
      ORDER BY country_name ASC
      LIMIT $2
    `;

    try {
      const result: QueryResult<CountryRow> = await database.query(searchQuery, [
        `%${query}%`,
        limit,
      ]);
      return result.rows.map(mapRowToCountry);
    } catch (error) {
      logger.error('Failed to search countries', { query, error });
      throw error;
    }
  }

  public async create(country: Omit<Country, 'createdAt' | 'updatedAt'>): Promise<Country> {
    const query = `
      INSERT INTO countries (
        country_code, country_name, continent, currency_code, currency_name,
        iban_length, bank_code_length, account_number_length, example_iban,
        iban_regex, is_sepa
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      country.countryCode.toUpperCase(),
      country.countryName,
      country.continent,
      country.currencyCode,
      country.currencyName,
      country.ibanLength,
      country.bankCodeLength,
      country.accountNumberLength,
      country.exampleIban,
      country.ibanRegex,
      country.isSEPA,
    ];

    try {
      const result: QueryResult<CountryRow> = await database.query(query, values);
      return mapRowToCountry(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create country', { countryCode: country.countryCode, error });
      throw error;
    }
  }

  public async update(
    countryCode: string,
    data: Partial<Omit<Country, 'countryCode' | 'createdAt' | 'updatedAt'>>
  ): Promise<Country | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      countryName: 'country_name',
      continent: 'continent',
      currencyCode: 'currency_code',
      currencyName: 'currency_name',
      ibanLength: 'iban_length',
      bankCodeLength: 'bank_code_length',
      accountNumberLength: 'account_number_length',
      exampleIban: 'example_iban',
      ibanRegex: 'iban_regex',
      isSEPA: 'is_sepa',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMapping[key] || key;
      updates.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findByCode(countryCode);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(countryCode.toUpperCase());

    const query = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}
      WHERE country_code = $${paramIndex}
      RETURNING *
    `;

    try {
      const result: QueryResult<CountryRow> = await database.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToCountry(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update country', { countryCode, error });
      throw error;
    }
  }

  public async getContinentList(): Promise<string[]> {
    const query = `SELECT DISTINCT continent FROM ${this.tableName} ORDER BY continent`;

    try {
      const result = await database.query<{ continent: string }>(query);
      return result.rows.map((row) => row.continent);
    } catch (error) {
      logger.error('Failed to get continent list', { error });
      throw error;
    }
  }

  public async getCurrencyList(): Promise<{ code: string; name: string }[]> {
    const query = `SELECT DISTINCT currency_code, currency_name FROM ${this.tableName} ORDER BY currency_name`;

    try {
      const result = await database.query<{ currency_code: string; currency_name: string }>(query);
      return result.rows.map((row) => ({
        code: row.currency_code,
        name: row.currency_name,
      }));
    } catch (error) {
      logger.error('Failed to get currency list', { error });
      throw error;
    }
  }

  public async seedDefaultCountries(force = false): Promise<void> {
    // Check if countries already exist (unless force is true)
    if (!force) {
      const existingCount = await this.pool.query(
        'SELECT COUNT(*) as count FROM countries'
      );
      const count = parseInt(existingCount.rows[0].count);
      
      if (count > 0) {
        logger.info('Countries already exist, skipping seed', { count });
        return;
      }
    }

    const defaultCountries = DEFAULT_COUNTRIES;

    let seededCount = 0;
    for (const country of defaultCountries) {
      try {
        // Use UPSERT for idempotent seeding
        await this.pool.query(`
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
          country.country_code,
          country.country_name,
          country.continent,
          country.currency_code,
          country.currency_name,
          country.iban_length,
          country.bank_code_length,
          country.account_number_length,
          country.example_iban,
          country.iban_regex,
          country.is_sepa
        ]);
        
        seededCount++;
        logger.debug('Country upserted', { countryCode: country.country_code });
      } catch (error: unknown) {
        logger.error('Failed to seed country', { error, countryCode: country.country_code });
        throw error;
      }
    }
    
    logger.info('Countries seeding completed', { 
      totalCountries: defaultCountries.length,
      seededCount,
      force 
    });
  }
}

export const countryModel = new CountryModel();
