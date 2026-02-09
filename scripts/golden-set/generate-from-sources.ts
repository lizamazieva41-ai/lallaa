#!/usr/bin/env node
/**
 * Golden Set Generation (Source Files)
 * Purpose: Build a golden set directly from checked-in source datasets under data/sources/
 * without requiring a database.
 *
 * This is useful in CI/dev environments where Postgres isn't available.
 *
 * Usage:
 *   npx ts-node scripts/golden-set/generate-from-sources.ts --min=2000 --output=golden-set.json
 */

import path from 'path';
import { extractFromCSV, extractFromYAML, SourceRecord } from '../etl/extract';
import { goldenSetManager } from '../../src/testing/goldenSet/goldenSetManager';
import { VerificationProtocol } from '../../src/testing/goldenSet/verificationProtocol';
import { GoldenSetRecord } from '../../src/testing/goldenSet/goldenSetTypes';
import { CardNetwork, CardType } from '../../src/types';

type SourceName =
  | 'binlist/data'
  | 'venelinkochev/bin-list-data'
  | 'aderyabin/bin_list';

type FieldBag = {
  countryCode?: string;
  network?: CardNetwork;
  issuer?: string;
  type?: CardType;
};

function normalizeBin(bin: string): string | null {
  const b = String(bin || '').replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(b)) return null;
  return b.substring(0, 8);
}

function recordToFieldBag(r: SourceRecord): FieldBag {
  const scheme = (r.scheme || '').toString().trim().toLowerCase();
  const type = (r.type || '').toString().trim().toLowerCase();

  const toNetwork = (s: string): CardNetwork | undefined => {
    if (!s) return undefined;
    if (s === 'visa') return CardNetwork.VISA;
    if (s === 'mastercard') return CardNetwork.MASTERCARD;
    if (s === 'amex' || s === 'american express' || s === 'american-express') return CardNetwork.AMEX;
    if (s === 'discover') return CardNetwork.DISCOVER;
    if (s === 'jcb') return CardNetwork.JCB;
    if (s === 'unionpay') return CardNetwork.UNIONPAY;
    if (s === 'diners' || s === 'diners-club' || s === 'diners club') return CardNetwork.DINERS;
    return undefined;
  };

  const toCardType = (t: string): CardType | undefined => {
    if (!t) return undefined;
    if (t === 'debit') return CardType.DEBIT;
    if (t === 'credit') return CardType.CREDIT;
    if (t === 'prepaid') return CardType.PREPAID;
    if (t === 'corporate') return CardType.CORPORATE;
    return undefined;
  };

  return {
    countryCode: (r.countryCode || r.country || '').toString().trim().toUpperCase() || undefined,
    network: toNetwork(scheme),
    issuer: (r.issuer || '').toString().trim() || undefined,
    type: toCardType(type),
  };
}

async function loadSources(): Promise<Array<{ source: SourceName; records: SourceRecord[] }>> {
  const root = process.cwd();
  const sources: Array<{ source: SourceName; records: SourceRecord[] }> = [];

  const binlistRanges = path.join(root, 'data', 'sources', 'binlist-data', 'ranges.csv');
  const venelinkCsv = path.join(root, 'data', 'sources', 'bin-list-data', 'bin-list-data.csv');
  const aderyabinYaml = path.join(root, 'data', 'sources', 'bin_list', 'bin_list.yml');

  const r1 = await extractFromCSV(binlistRanges, 'binlist/data', 'latest', {
    bin: 'iin_start',
    scheme: 'scheme',
    type: 'type',
    issuer: 'bank_name',
    country: 'country',
    countryCode: 'country',
  });
  sources.push({ source: 'binlist/data', records: r1.records });

  const r2 = await extractFromCSV(venelinkCsv, 'venelinkochev/bin-list-data', 'latest', {
    bin: 'BIN',
    scheme: 'Brand',
    type: 'Type',
    issuer: 'Issuer',
    country: 'CountryName',
    countryCode: 'isoCode2',
  });
  sources.push({ source: 'venelinkochev/bin-list-data', records: r2.records });

  const r3 = await extractFromYAML(aderyabinYaml, 'aderyabin/bin_list', 'latest');
  sources.push({ source: 'aderyabin/bin_list', records: r3.records });

  return sources;
}

function parseArgs(argv: string[]): { min: number; output: string } {
  const min = parseInt(argv.find(a => a.startsWith('--min='))?.split('=')[1] || '2000', 10);
  const output = argv.find(a => a.startsWith('--output='))?.split('=')[1] || 'golden-set.json';
  return { min, output };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { min, output } = parseArgs(args);
  const mode = (args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'core').toLowerCase();
  const fillStrategy = (args.find(a => a.startsWith('--fill='))?.split('=')[1] || '').toLowerCase();

  const sources = await loadSources();

  // Group by BIN -> list of source values
  const binMap = new Map<string, Array<{ source: SourceName; fields: FieldBag }>>();
  for (const s of sources) {
    for (const rec of s.records) {
      const bin = normalizeBin(rec.bin);
      if (!bin) continue;
      const fields = recordToFieldBag(rec);
      if (!binMap.has(bin)) binMap.set(bin, []);
      binMap.get(bin)!.push({ source: s.source, fields });
    }
  }

  for (const [bin, values] of binMap.entries()) {
    if (values.length < 2) continue;

    const countryValues = values
      .map(v => ({ source: v.source, value: v.fields.countryCode || '' }))
      .filter(v => v.value);
    const networkValues = values
      .filter(v => v.fields.network)
      .map(v => ({ source: v.source, value: v.fields.network! }));
    const issuerValues = values
      .map(v => ({ source: v.source, value: v.fields.issuer || '' }))
      .filter(v => v.value);
    const typeValues = values
      .filter(v => v.fields.type)
      .map(v => ({ source: v.source, value: v.fields.type! }));

    const verifiedCountry = VerificationProtocol.verifyField('country', countryValues);
    const verifiedNetwork = VerificationProtocol.verifyField('network', networkValues);
    const verifiedIssuer =
      issuerValues.length > 0 ? (VerificationProtocol.verifyField('issuer', issuerValues) ?? undefined) : undefined;
    const verifiedType =
      typeValues.length > 0 ? (VerificationProtocol.verifyField('type', typeValues) ?? undefined) : undefined;

    if (!verifiedCountry || !verifiedNetwork) continue;

    // Golden-set quality gate (configurable):
    // - "all": require ≥2 sources for ALL fields
    // - "core" (default): require ≥2 sources for country+network
    // - "loose": require ≥2 sources overall AND ≥2 sources on at least ONE field
    if (mode === 'all') {
      if (
        verifiedCountry.sources.length < 2 ||
        verifiedNetwork.sources.length < 2 ||
        (verifiedIssuer ? verifiedIssuer.sources.length < 2 : true) ||
        (verifiedType ? verifiedType.sources.length < 2 : true)
      ) continue;
    } else if (mode === 'core') {
      if (verifiedCountry.sources.length < 2 || verifiedNetwork.sources.length < 2) continue;
    } else if (mode === 'loose') {
      const anyTwo =
        verifiedCountry.sources.length >= 2 ||
        verifiedNetwork.sources.length >= 2 ||
        (verifiedIssuer ? verifiedIssuer.sources.length >= 2 : false) ||
        (verifiedType ? verifiedType.sources.length >= 2 : false);
      if (!anyTwo) continue;
    }

    const record: GoldenSetRecord = {
      bin,
      verifiedFields: {
        country: verifiedCountry,
        network: verifiedNetwork,
        issuer: verifiedIssuer,
        type: verifiedType,
      },
      verificationMethod: 'cross-source',
      lastVerified: new Date(),
    };

    goldenSetManager.addRecord(record);
  }

  const stats = goldenSetManager.getStatistics();
  // eslint-disable-next-line no-console
  console.log(`Golden set generated: ${stats.totalRecords} records`);

  // Optional fill to reach minimum using single-source candidates marked as manual (requires review)
  if (stats.totalRecords < min && fillStrategy === 'manual') {
    const needed = min - stats.totalRecords;
    let added = 0;

    for (const [bin, values] of binMap.entries()) {
      if (added >= needed) break;
      if (goldenSetManager.hasRecord(bin)) continue;
      if (values.length !== 1) continue;

      const v = values[0];
      const countryCode = v.fields.countryCode || 'XX';
      const network = v.fields.network ?? CardNetwork.OTHER;

      const record: GoldenSetRecord = {
        bin,
        verifiedFields: {
          country: { value: countryCode, sources: [v.source], confidence: 0.5 },
          network: { value: network, sources: [v.source], confidence: 0.5 },
          issuer: v.fields.issuer ? { value: v.fields.issuer, sources: [v.source], confidence: 0.5 } : undefined,
          type: v.fields.type ? { value: v.fields.type, sources: [v.source], confidence: 0.5 } : undefined,
        },
        verificationMethod: 'manual',
        lastVerified: new Date(),
        verificationNotes:
          'AUTO-FILL: Single-source candidate added to reach minimum size. Requires manual/authoritative verification.',
      };

      goldenSetManager.addRecord(record);
      added++;
    }

    const after = goldenSetManager.getStatistics();
    // eslint-disable-next-line no-console
    console.log(`Filled with manual candidates: +${added} (total: ${after.totalRecords})`);
  }

  if (goldenSetManager.getRecordCount() < min) {
    // eslint-disable-next-line no-console
    console.warn(
      `Warning: only ${goldenSetManager.getRecordCount()} records (min requested: ${min}). Consider adding more sources.`
    );
  }

  await goldenSetManager.saveToFile(output);
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

