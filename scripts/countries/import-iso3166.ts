#!/usr/bin/env node
/**
 * ISO 3166-1 Import Script
 * Purpose: Import complete ISO 3166-1 country database
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../src/utils/logger';

function loadWorldCountriesDataset(): Array<any> {
  // world-countries uses package exports which may block require.resolve() of deep paths.
  // This repo is a Node project with node_modules checked in, so we load the file by disk path.
  const pkgDir = path.join(process.cwd(), 'node_modules', 'world-countries');
  const candidatePaths = [path.join(pkgDir, 'dist', 'countries.json'), path.join(pkgDir, 'countries.json')];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  }

  throw new Error(
    `Could not locate world-countries dataset. Tried: ${candidatePaths.join(', ')}`
  );
}

/**
 * ISO 3166-1 Country data structure
 */
export interface ISO3166Country {
  iso2: string;
  iso3: string;
  name: string;
  commonNames: string[];
  currencyCode: string;
  currencyName: string;
  region: string;
  subregion: string;
  validationRules?: {
    binPrefixes?: string[];
    cardNetworks?: string[];
  };
}

/**
 * Generate comprehensive ISO 3166-1 country database
 * This includes all 250+ countries with ISO2, ISO3, names, currency, region, subregion
 */
export function generateISO3166Database(): ISO3166Country[] {
  const WORLD_COUNTRIES: Array<any> = loadWorldCountriesDataset();
  const countries: ISO3166Country[] = [];

  for (const c of WORLD_COUNTRIES) {
    const iso2: string | undefined = c?.cca2;
    const iso3: string | undefined = c?.cca3;
    const name: string | undefined = c?.name?.common || c?.name?.official;
    const region: string = c?.region || 'Unknown';
    const subregion: string = c?.subregion || 'Unknown';

    if (!iso2 || !iso3 || !name) continue;

    // currencies is an object like { "USD": { name: "United States dollar", symbol: "$" } }
    const currencyCodes = c?.currencies ? Object.keys(c.currencies) : [];
    const currencyCode = currencyCodes[0] || '';
    const currencyName =
      currencyCode && c?.currencies?.[currencyCode]?.name ? String(c.currencies[currencyCode].name) : '';

    const commonNames: string[] = [];
    if (c?.name?.official && c.name.official !== name) commonNames.push(String(c.name.official));
    if (c?.altSpellings && Array.isArray(c.altSpellings)) {
      for (const alt of c.altSpellings) {
        if (typeof alt === 'string' && alt.trim()) commonNames.push(alt.trim());
      }
    }
    // Always include iso2/iso3 as lookup aliases
    commonNames.push(iso2, iso3);

    const record: ISO3166Country = {
      iso2,
      iso3,
      name,
      commonNames: Array.from(new Set(commonNames)).slice(0, 50),
      currencyCode,
      currencyName,
      region,
      subregion,
    };

    // A small example of country-specific validation rules; extend later.
    if (iso2 === 'US') {
      record.validationRules = {
        binPrefixes: ['4', '5', '34', '37', '6'],
        cardNetworks: ['visa', 'mastercard', 'amex', 'discover'],
      };
    }
    if (iso2 === 'VN') {
      record.validationRules = {
        cardNetworks: ['visa', 'mastercard', 'jcb', 'unionpay'],
      };
    }

    countries.push(record);
  }

  // Stable ordering
  countries.sort((a, b) => a.iso2.localeCompare(b.iso2));
  return countries;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputFile =
    args.find(a => a.startsWith('--output='))?.split('=')[1] || 'iso3166-1.json';
  const outputPath = path.join('./data/countries', outputFile);

  try {
    logger.info('Generating ISO 3166-1 country database...');

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate database
    const countries = generateISO3166Database();

    // Save to file
    fs.writeFileSync(outputPath, JSON.stringify(countries, null, 2), 'utf-8');

    logger.info('ISO 3166-1 database generated', {
      outputPath,
      countryCount: countries.length,
    });

    process.exit(0);
  } catch (error) {
    logger.error('Failed to generate ISO 3166-1 database', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in ISO 3166-1 import', { error });
    process.exit(1);
  });
}