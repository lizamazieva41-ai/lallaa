#!/usr/bin/env node
/**
 * ISO 3166-1 Import Script
 * Purpose: Import complete ISO 3166-1 country database
 */
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
export declare function generateISO3166Database(): ISO3166Country[];
//# sourceMappingURL=import-iso3166.d.ts.map