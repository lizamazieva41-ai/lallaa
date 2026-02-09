import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env' });

export interface CountryData {
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
}

export const DEFAULT_COUNTRIES: CountryData[] = [
  // SEPA Countries (Euro)
  {
    country_code: 'DE',
    country_name: 'Germany',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 22,
    bank_code_length: 8,
    account_number_length: 10,
    example_iban: 'DE89370400440532013000',
    iban_regex: '^DE[0-9]{2}[0-9]{8}[0-9]{10}$',
    is_sepa: true,
  },
  {
    country_code: 'FR',
    country_name: 'France',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 27,
    bank_code_length: 5,
    account_number_length: 11,
    example_iban: 'FR7630006000011234567890189',
    iban_regex: '^FR[0-9]{2}[0-9]{5}[0-9]{5}[0-9]{11}[0-9]{2}$',
    is_sepa: true,
  },
  {
    country_code: 'IT',
    country_name: 'Italy',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 27,
    bank_code_length: 5,
    account_number_length: 12,
    example_iban: 'IT60X0542811101000000123456',
    iban_regex: '^IT[0-9]{2}[A-Z][0-9]{5}[0-9]{5}[A-Z0-9]{12}$',
    is_sepa: true,
  },
  {
    country_code: 'ES',
    country_name: 'Spain',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 24,
    bank_code_length: 4,
    account_number_length: 14,
    example_iban: 'ES9121000418450200051332',
    iban_regex: '^ES[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{4}[0-9]{4}[0-9]{4}$',
    is_sepa: true,
  },
  {
    country_code: 'NL',
    country_name: 'Netherlands',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 18,
    bank_code_length: 4,
    account_number_length: 10,
    example_iban: 'NL91ABNA0417164300',
    iban_regex: '^NL[0-9]{2}[A-Z]{4}[0-9]{10}$',
    is_sepa: true,
  },
  {
    country_code: 'BE',
    country_name: 'Belgium',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 16,
    bank_code_length: 3,
    account_number_length: 9,
    example_iban: 'BE68539007547034',
    iban_regex: '^BE[0-9]{2}[0-9]{3}[0-9]{7}[0-9]{2}$',
    is_sepa: true,
  },
  {
    country_code: 'AT',
    country_name: 'Austria',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 20,
    bank_code_length: 5,
    account_number_length: 11,
    example_iban: 'AT611904300234573201',
    iban_regex: '^AT[0-9]{2}[0-9]{5}[0-9]{11}$',
    is_sepa: true,
  },
  {
    country_code: 'PT',
    country_name: 'Portugal',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 25,
    bank_code_length: 4,
    account_number_length: 17,
    example_iban: 'PT50000201231234567890154',
    iban_regex: '^PT[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{11}[0-9]{2}$',
    is_sepa: true,
  },
  {
    country_code: 'IE',
    country_name: 'Ireland',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 22,
    bank_code_length: 4,
    account_number_length: 14,
    example_iban: 'IE29AIBK93115212345678',
    iban_regex: '^IE[0-9]{2}[A-Z]{4}[0-9]{6}[0-9]{8}$',
    is_sepa: true,
  },
  {
    country_code: 'FI',
    country_name: 'Finland',
    continent: 'Europe',
    currency_code: 'EUR',
    currency_name: 'Euro',
    iban_length: 18,
    bank_code_length: 6,
    account_number_length: 8,
    example_iban: 'FI2112345698765432',
    iban_regex: '^FI[0-9]{2}[0-9]{6}[0-9]{8}$',
    is_sepa: true,
  },
  // Non-SEPA European countries
  {
    country_code: 'GB',
    country_name: 'United Kingdom',
    continent: 'Europe',
    currency_code: 'GBP',
    currency_name: 'British Pound',
    iban_length: 22,
    bank_code_length: 4,
    account_number_length: 8,
    example_iban: 'GB82WEST12345698765432',
    iban_regex: '^GB[0-9]{2}[A-Z]{4}[0-9]{6}[0-9]{8}$',
    is_sepa: false,
  },
  {
    country_code: 'CH',
    country_name: 'Switzerland',
    continent: 'Europe',
    currency_code: 'CHF',
    currency_name: 'Swiss Franc',
    iban_length: 21,
    bank_code_length: 5,
    account_number_length: 12,
    example_iban: 'CH9300762011623852957',
    iban_regex: '^CH[0-9]{2}[A-Z]{1}[0-9]{1}[0-9]{3}[A-Z0-9]{12}[A-Z0-9]{1}$',
    is_sepa: false,
  },
  {
    country_code: 'NO',
    country_name: 'Norway',
    continent: 'Europe',
    currency_code: 'NOK',
    currency_name: 'Norwegian Krone',
    iban_length: 15,
    bank_code_length: 4,
    account_number_length: 11,
    example_iban: 'NO9386011117947',
    iban_regex: '^NO[0-9]{2}[0-9]{4}[0-9]{11}$',
    is_sepa: false,
  },
  {
    country_code: 'SE',
    country_name: 'Sweden',
    continent: 'Europe',
    currency_code: 'SEK',
    currency_name: 'Swedish Krona',
    iban_length: 24,
    bank_code_length: 3,
    account_number_length: 17,
    example_iban: 'SE4550000000058398257496',
    iban_regex: '^SE[0-9]{2}[0-9]{3}[0-9]{17}$',
    is_sepa: false,
  },
  {
    country_code: 'DK',
    country_name: 'Denmark',
    continent: 'Europe',
    currency_code: 'DKK',
    currency_name: 'Danish Krone',
    iban_length: 18,
    bank_code_length: 4,
    account_number_length: 14,
    example_iban: 'DK5000400440116243',
    iban_regex: '^DK[0-9]{2}[0-9]{4}[0-9]{10}[0-9]{4}$',
    is_sepa: false,
  },
  // Americas
  {
    country_code: 'US',
    country_name: 'United States',
    continent: 'North America',
    currency_code: 'USD',
    currency_name: 'US Dollar',
    iban_length: 0,
    bank_code_length: 9,
    account_number_length: 0,
    example_iban: '',
    iban_regex: '',
    is_sepa: false,
  },
  {
    country_code: 'CA',
    country_name: 'Canada',
    continent: 'North America',
    currency_code: 'CAD',
    currency_name: 'Canadian Dollar',
    iban_length: 0,
    bank_code_length: 9,
    account_number_length: 0,
    example_iban: '',
    iban_regex: '',
    is_sepa: false,
  },
  {
    country_code: 'BR',
    country_name: 'Brazil',
    continent: 'South America',
    currency_code: 'BRL',
    currency_name: 'Brazilian Real',
    iban_length: 29,
    bank_code_length: 3,
    account_number_length: 14,
    example_iban: 'BR9700360305000010000000000P2',
    iban_regex: '^BR[0-9]{2}[0-9]{3}[0-9]{1}[A-Z]{1}[A-Z0-9]{1}[A-Z]{1}[0-9]{14}[A-Z]{1}[A-Z0-9]{1}$',
    is_sepa: false,
  },
  // Asia
  {
    country_code: 'JP',
    country_name: 'Japan',
    continent: 'Asia',
    currency_code: 'JPY',
    currency_name: 'Japanese Yen',
    iban_length: 0,
    bank_code_length: 7,
    account_number_length: 0,
    example_iban: '',
    iban_regex: '',
    is_sepa: false,
  },
  {
    country_code: 'CN',
    country_name: 'China',
    continent: 'Asia',
    currency_code: 'CNY',
    currency_name: 'Chinese Yuan',
    iban_length: 0,
    bank_code_length: 12,
    account_number_length: 0,
    example_iban: '',
    iban_regex: '',
    is_sepa: false,
  },
  {
    country_code: 'AU',
    country_name: 'Australia',
    continent: 'Oceania',
    currency_code: 'AUD',
    currency_name: 'Australian Dollar',
    iban_length: 0,
    bank_code_length: 6,
    account_number_length: 0,
    example_iban: '',
    iban_regex: '',
    is_sepa: false,
  },
  {
    country_code: 'NZ',
    country_name: 'New Zealand',
    continent: 'Oceania',
    currency_code: 'NZD',
    currency_name: 'New Zealand Dollar',
    iban_length: 0,
    bank_code_length: 6,
    account_number_length: 0,
    example_iban: '',
    iban_regex: '',
    is_sepa: false,
  },
];

interface ISO3166Country {
  iso2: string;
  iso3: string;
  name: string;
  commonNames: string[];
  currencyCode: string;
  currencyName: string;
  region: string;
  subregion: string;
}

function mapRegionToContinent(region: string): string {
  // Our DB schema uses "continent" but the ISO dataset uses "region".
  // Keep it human-friendly and stable.
  const r = (region || '').toLowerCase();
  if (r === 'americas') return 'North America';
  if (r === 'europe') return 'Europe';
  if (r === 'africa') return 'Africa';
  if (r === 'asia') return 'Asia';
  if (r === 'oceania') return 'Oceania';
  if (r === 'antarctic') return 'Antarctica';
  return region || 'Unknown';
}

function loadISO3166Countries(): ISO3166Country[] {
  const isoPath = path.join(process.cwd(), 'data', 'countries', 'iso3166-1.json');
  if (!fs.existsSync(isoPath)) {
    // Keep seed runnable even if the ISO file wasn't generated yet.
    // The Phase 1 import script should generate it.
    return [];
  }

  const raw = fs.readFileSync(isoPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed as ISO3166Country[];
}

function buildFullCountrySeedSet(): CountryData[] {
  const isoCountries = loadISO3166Countries();
  const existingByCode = new Map<string, CountryData>();
  for (const c of DEFAULT_COUNTRIES) {
    existingByCode.set(c.country_code.toUpperCase(), c);
  }

  // Start with the existing set (IBAN-rich countries)
  const merged: CountryData[] = [...DEFAULT_COUNTRIES];

  // Add all remaining ISO3166 entries with safe defaults for IBAN-related fields.
  for (const iso of isoCountries) {
    const code = iso.iso2.toUpperCase();
    if (existingByCode.has(code)) continue;

    merged.push({
      country_code: code,
      country_name: iso.name,
      continent: mapRegionToContinent(iso.region),
      currency_code: iso.currencyCode || '',
      currency_name: iso.currencyName || '',
      iban_length: 0,
      bank_code_length: 0,
      account_number_length: 0,
      example_iban: '',
      iban_regex: '',
      is_sepa: false,
    });
  }

  // De-dupe and sort
  const outByCode = new Map<string, CountryData>();
  for (const c of merged) outByCode.set(c.country_code.toUpperCase(), c);
  return Array.from(outByCode.values()).sort((a, b) => a.country_code.localeCompare(b.country_code));
}

async function seedCountries(pool: Pool): Promise<void> {
  console.log('Seeding countries...');

  const allCountries = buildFullCountrySeedSet();

  if (allCountries.length < 250) {
    console.warn(
      `Warning: country seed set is ${allCountries.length} (<250). Did you run scripts/countries/import-iso3166.ts to generate data/countries/iso3166-1.json?`
    );
  }

  for (const country of allCountries) {
    try {
      await pool.query(
        `
        INSERT INTO countries (
          country_code, country_name, continent, currency_code, currency_name,
          iban_length, bank_code_length, account_number_length, example_iban,
          iban_regex, is_sepa
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      `,
        [
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
          country.is_sepa,
        ]
      );
      console.log(`Seeded: ${country.country_name}`);
    } catch (error) {
      console.error(`Failed to seed ${country.country_name}:`, error);
    }
  }

  console.log(`Seeded ${allCountries.length} countries`);
}

// Main execution
async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'bincheck',
    password: process.env.POSTGRES_PASSWORD || 'bincheck_secret',
    database: process.env.POSTGRES_DB || 'bincheck',
  });

  try {
    await seedCountries(pool);
    console.log('Country seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedCountries };
