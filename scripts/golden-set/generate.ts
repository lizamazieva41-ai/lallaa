#!/usr/bin/env node
/**
 * Golden Set Generation Script
 * Purpose: Extract BINs with ≥2 source confirmation from existing data
 */

import dotenv from 'dotenv';
import { binModel } from '../../src/models/bin';
import { goldenSetManager } from '../../src/testing/goldenSet/goldenSetManager';
import { VerificationProtocol } from '../../src/testing/goldenSet/verificationProtocol';
import { GoldenSetRecord } from '../../src/testing/goldenSet/goldenSetTypes';
import { CardNetwork, CardType } from '../../src/types';
import { logger } from '../../src/utils/logger';
import database from '../../src/database/connection';

dotenv.config({ path: '.env' });

interface BINSourceData {
  bin: string;
  sources: Array<{
    source: string;
    country?: string;
    countryCode?: string;
    network?: CardNetwork;
    issuer?: string;
    type?: CardType;
  }>;
}

/**
 * Extract BINs with multiple source confirmations from database
 */
async function extractBINsWithMultipleSources(): Promise<BINSourceData[]> {
  logger.info('Extracting BINs with multiple sources from database...');

  // Query database for BINs with multiple sources
  const query = `
    SELECT 
      bin,
      source,
      country_code,
      country_name,
      card_network,
      bank_name as issuer,
      card_type
    FROM bins
    WHERE is_active = true
    ORDER BY bin, source
  `;

  try {
    const result = await database.query(query);
    const binMap = new Map<string, BINSourceData>();

    result.rows.forEach((row: any) => {
      const bin = row.bin;
      if (!binMap.has(bin)) {
        binMap.set(bin, {
          bin,
          sources: [],
        });
      }

      const binData = binMap.get(bin)!;
      binData.sources.push({
        source: row.source,
        country: row.country_name,
        countryCode: row.country_code,
        network: row.card_network as CardNetwork,
        issuer: row.issuer,
        type: row.card_type as CardType,
      });
    });

    // Filter to only BINs with ≥2 sources
    const binsWithMultipleSources = Array.from(binMap.values()).filter(
      binData => binData.sources.length >= 2
    );

    logger.info(`Found ${binsWithMultipleSources.length} BINs with ≥2 sources`);
    return binsWithMultipleSources;
  } catch (error) {
    logger.error('Failed to extract BINs from database', { error });
    throw error;
  }
}

/**
 * Generate golden set records from BIN source data
 */
function generateGoldenSetRecords(binSourceData: BINSourceData[]): GoldenSetRecord[] {
  logger.info('Generating golden set records...');
  const records: GoldenSetRecord[] = [];

  binSourceData.forEach(binData => {
    try {
      // Verify country field
      const countryValues = binData.sources.map(s => ({
        source: s.source,
        value: s.countryCode || s.country || '',
      }));

      const verifiedCountry = VerificationProtocol.verifyField('country', countryValues);
      if (!verifiedCountry || !verifiedCountry.value) {
        logger.debug(`Skipping BIN ${binData.bin}: no valid country`);
        return;
      }

      // Verify network field
      const networkValues = binData.sources
        .filter(s => s.network)
        .map(s => ({
          source: s.source,
          value: s.network!,
        }));

      const verifiedNetwork = VerificationProtocol.verifyField('network', networkValues);
      if (!verifiedNetwork || !verifiedNetwork.value) {
        logger.debug(`Skipping BIN ${binData.bin}: no valid network`);
        return;
      }

      // Verify issuer field
      const issuerValues = binData.sources
        .filter(s => s.issuer)
        .map(s => ({
          source: s.source,
          value: s.issuer!,
        }));

      const verifiedIssuer = VerificationProtocol.verifyField('issuer', issuerValues);
      if (!verifiedIssuer || !verifiedIssuer.value) {
        logger.debug(`Skipping BIN ${binData.bin}: no valid issuer`);
        return;
      }

      // Verify type field
      const typeValues = binData.sources
        .filter(s => s.type)
        .map(s => ({
          source: s.source,
          value: s.type!,
        }));

      const verifiedType = VerificationProtocol.verifyField('type', typeValues);
      if (!verifiedType || !verifiedType.value) {
        logger.debug(`Skipping BIN ${binData.bin}: no valid type`);
        return;
      }

      // Determine verification method
      const hasAuthoritative = binData.sources.some(s =>
        VerificationProtocol.isAuthoritativeSource(s.source)
      );

      const verificationMethod = VerificationProtocol.determineVerificationMethod(
        {
          country: verifiedCountry,
          network: verifiedNetwork,
          issuer: verifiedIssuer,
          type: verifiedType,
        },
        hasAuthoritative,
        false // Manual verification will be added later
      );

      const record: GoldenSetRecord = {
        bin: binData.bin,
        verifiedFields: {
          country: verifiedCountry,
          network: verifiedNetwork,
          issuer: verifiedIssuer,
          type: verifiedType,
        },
        verificationMethod,
        lastVerified: new Date(),
      };

      records.push(record);
    } catch (error) {
      logger.error(`Error generating golden set record for BIN ${binData.bin}`, { error });
    }
  });

  logger.info(`Generated ${records.length} golden set records`);
  return records;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const minRecords = parseInt(args.find(a => a.startsWith('--min='))?.split('=')[1] || '2000', 10);
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'golden-set.json';

  try {
    logger.info('Starting golden set generation...', { minRecords, outputFile });

    // Extract BINs with multiple sources
    const binSourceData = await extractBINsWithMultipleSources();

    if (binSourceData.length < minRecords) {
      logger.warn(
        `Only found ${binSourceData.length} BINs with ≥2 sources, target was ${minRecords}`
      );
    }

    // Generate golden set records
    const records = generateGoldenSetRecords(binSourceData);

    // Add records to manager
    records.forEach(record => {
      goldenSetManager.addRecord(record);
    });

    // Save to file
    await goldenSetManager.saveToFile(outputFile);

    // Print statistics
    const stats = goldenSetManager.getStatistics();
    logger.info('Golden set generation completed', {
      totalRecords: stats.totalRecords,
      byMethod: stats.byVerificationMethod,
      averageConfidence: stats.averageConfidence.toFixed(3),
      sourceAgreementRates: stats.sourceAgreementRates,
    });

    process.exit(0);
  } catch (error) {
    logger.error('Golden set generation failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in golden set generation', { error });
    process.exit(1);
  });
}

export { extractBINsWithMultipleSources, generateGoldenSetRecords };
