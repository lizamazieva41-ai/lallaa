import { ISO3166Country } from '../types/iso3166';
import { logger } from '../utils/logger';

/**
 * Enhanced Country Mapping with ISO 3166-1 data
 * Supports 250+ countries with common name variations and validation rules
 */
export interface CountryMapping extends ISO3166Country {
  validationRules: {
    binPrefixes?: string[];
    cardNetworks?: string[];
  };
}

/**
 * Country name to ISO2 code mapping (including common variations)
 */
const COUNTRY_NAME_TO_ISO2: Map<string, string> = new Map();

/**
 * ISO2 to Country Mapping
 */
const ISO2_TO_COUNTRY: Map<string, CountryMapping> = new Map();

/**
 * Initialize country mappings
 * This should be called after loading ISO 3166-1 data
 */
export function initializeCountryMappings(countries: ISO3166Country[]): void {
  ISO2_TO_COUNTRY.clear();
  COUNTRY_NAME_TO_ISO2.clear();

  countries.forEach(country => {
    // Store by ISO2
    ISO2_TO_COUNTRY.set(country.iso2, {
      ...country,
      validationRules: country.validationRules || {},
    });

    // Map all name variations to ISO2
    COUNTRY_NAME_TO_ISO2.set(country.name.toLowerCase(), country.iso2);
    COUNTRY_NAME_TO_ISO2.set(country.iso2.toLowerCase(), country.iso2);
    COUNTRY_NAME_TO_ISO2.set(country.iso3.toLowerCase(), country.iso2);

    country.commonNames.forEach(commonName => {
      COUNTRY_NAME_TO_ISO2.set(commonName.toLowerCase(), country.iso2);
    });
  });

  logger.info('Country mappings initialized', { countryCount: countries.length });
}

/**
 * Get country mapping by ISO2 code
 */
export function getCountryByISO2(iso2: string): CountryMapping | undefined {
  return ISO2_TO_COUNTRY.get(iso2.toUpperCase());
}

/**
 * Get country mapping by name (supports common variations)
 */
export function getCountryByName(name: string): CountryMapping | undefined {
  const iso2 = COUNTRY_NAME_TO_ISO2.get(name.toLowerCase());
  if (!iso2) return undefined;
  return getCountryByISO2(iso2);
}

/**
 * Normalize country name to ISO2 code
 */
export function normalizeCountryToISO2(countryName: string): string | null {
  const normalized = countryName.trim().toLowerCase();
  const iso2 = COUNTRY_NAME_TO_ISO2.get(normalized);
  return iso2 || null;
}

/**
 * Get all country mappings
 */
export function getAllCountryMappings(): CountryMapping[] {
  return Array.from(ISO2_TO_COUNTRY.values());
}

/**
 * Get countries by region
 */
export function getCountriesByRegion(region: string): CountryMapping[] {
  return Array.from(ISO2_TO_COUNTRY.values()).filter(
    country => country.region.toLowerCase() === region.toLowerCase()
  );
}

/**
 * Get countries by subregion
 */
export function getCountriesBySubregion(subregion: string): CountryMapping[] {
  return Array.from(ISO2_TO_COUNTRY.values()).filter(
    country => country.subregion.toLowerCase() === subregion.toLowerCase()
  );
}

/**
 * Validate country code
 */
export function isValidCountryCode(iso2: string): boolean {
  return ISO2_TO_COUNTRY.has(iso2.toUpperCase());
}

/**
 * Get country validation rules
 */
export function getCountryValidationRules(iso2: string): CountryMapping['validationRules'] {
  const country = getCountryByISO2(iso2);
  return country?.validationRules || {};
}

/**
 * Check if BIN prefix is valid for country
 */
export function isValidBINPrefixForCountry(bin: string, countryCode: string): boolean {
  const rules = getCountryValidationRules(countryCode);
  if (!rules.binPrefixes || rules.binPrefixes.length === 0) {
    return true; // No restrictions
  }

  return rules.binPrefixes.some(prefix => bin.startsWith(prefix));
}

/**
 * Check if card network is valid for country
 */
export function isValidCardNetworkForCountry(
  network: string,
  countryCode: string
): boolean {
  const rules = getCountryValidationRules(countryCode);
  if (!rules.cardNetworks || rules.cardNetworks.length === 0) {
    return true; // No restrictions
  }

  return rules.cardNetworks.some(
    allowedNetwork => allowedNetwork.toLowerCase() === network.toLowerCase()
  );
}

/**
 * Validate geographic consistency (country vs region/subregion)
 */
export function validateGeographicConsistency(
  countryCode: string,
  region?: string,
  subregion?: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const country = getCountryByISO2(countryCode);

  if (!country) {
    errors.push(`Invalid country code: ${countryCode}`);
    return { isValid: false, errors };
  }

  if (region && country.region.toLowerCase() !== region.toLowerCase()) {
    errors.push(
      `Region mismatch: country ${countryCode} is in ${country.region}, not ${region}`
    );
  }

  if (subregion && country.subregion.toLowerCase() !== subregion.toLowerCase()) {
    errors.push(
      `Subregion mismatch: country ${countryCode} is in ${country.subregion}, not ${subregion}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
