#!/usr/bin/env node
"use strict";
/**
 * ISO 3166-1 Import Script
 * Purpose: Import complete ISO 3166-1 country database
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateISO3166Database = generateISO3166Database;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../src/utils/logger");
function loadWorldCountriesDataset() {
    // world-countries uses package exports which may block require.resolve() of deep paths.
    // This repo is a Node project with node_modules checked in, so we load the file by disk path.
    const pkgDir = path_1.default.join(process.cwd(), 'node_modules', 'world-countries');
    const candidatePaths = [path_1.default.join(pkgDir, 'dist', 'countries.json'), path_1.default.join(pkgDir, 'countries.json')];
    for (const p of candidatePaths) {
        if (fs_1.default.existsSync(p)) {
            const raw = fs_1.default.readFileSync(p, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed))
                return parsed;
        }
    }
    throw new Error(`Could not locate world-countries dataset. Tried: ${candidatePaths.join(', ')}`);
}
/**
 * Generate comprehensive ISO 3166-1 country database
 * This includes all 250+ countries with ISO2, ISO3, names, currency, region, subregion
 */
function generateISO3166Database() {
    const WORLD_COUNTRIES = loadWorldCountriesDataset();
    const countries = [];
    for (const c of WORLD_COUNTRIES) {
        const iso2 = c?.cca2;
        const iso3 = c?.cca3;
        const name = c?.name?.common || c?.name?.official;
        const region = c?.region || 'Unknown';
        const subregion = c?.subregion || 'Unknown';
        if (!iso2 || !iso3 || !name)
            continue;
        // currencies is an object like { "USD": { name: "United States dollar", symbol: "$" } }
        const currencyCodes = c?.currencies ? Object.keys(c.currencies) : [];
        const currencyCode = currencyCodes[0] || '';
        const currencyName = currencyCode && c?.currencies?.[currencyCode]?.name ? String(c.currencies[currencyCode].name) : '';
        const commonNames = [];
        if (c?.name?.official && c.name.official !== name)
            commonNames.push(String(c.name.official));
        if (c?.altSpellings && Array.isArray(c.altSpellings)) {
            for (const alt of c.altSpellings) {
                if (typeof alt === 'string' && alt.trim())
                    commonNames.push(alt.trim());
            }
        }
        // Always include iso2/iso3 as lookup aliases
        commonNames.push(iso2, iso3);
        const record = {
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
async function main() {
    const args = process.argv.slice(2);
    const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'iso3166-1.json';
    const outputPath = path_1.default.join('./data/countries', outputFile);
    try {
        logger_1.logger.info('Generating ISO 3166-1 country database...');
        // Ensure directory exists
        const outputDir = path_1.default.dirname(outputPath);
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        // Generate database
        const countries = generateISO3166Database();
        // Save to file
        fs_1.default.writeFileSync(outputPath, JSON.stringify(countries, null, 2), 'utf-8');
        logger_1.logger.info('ISO 3166-1 database generated', {
            outputPath,
            countryCount: countries.length,
        });
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Failed to generate ISO 3166-1 database', { error });
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main().catch(error => {
        logger_1.logger.error('Unhandled error in ISO 3166-1 import', { error });
        process.exit(1);
    });
}
//# sourceMappingURL=import-iso3166.js.map