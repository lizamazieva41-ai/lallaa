/**
 * Unit Tests for ETL Merge Module
 * Focus: priority-based conflict resolution
 */

import { mergeRecords } from '../../scripts/etl/merge';
import { NormalizedRecord } from '../../scripts/etl/normalize';
import { SourceInfo } from '../../scripts/etl/extract';

describe('ETL Merge Module', () => {
  it('should prefer higher-priority source over higher confidence', () => {
    const sourceA: SourceInfo = {
      name: 'binlist/data',
      version: 'v1',
      format: 'json',
      priority: 1,
    };

    const sourceB: SourceInfo = {
      name: 'aderyabin/bin_list',
      version: 'v1',
      format: 'yaml',
      priority: 3,
    };

    const recordA: NormalizedRecord = {
      bin: '411111',
      raw: { issuer: 'Bank A' },
      scheme: 'visa',
      brand: 'Visa',
      type: 'debit',
      issuer: 'Bank A',
      country: 'United States',
      countryCode: 'US',
      normalizedCountryCode: 'US',
      normalizedCountry: 'United States',
      normalizedIssuer: 'BANK A',
      normalizedScheme: 'visa',
      normalizedBrand: 'Visa',
      normalizedType: 'debit',
      confidence: 80,
    };

    const recordB: NormalizedRecord = {
      bin: '411111',
      raw: { issuer: 'Bank B' },
      scheme: 'visa',
      brand: 'Visa Classic',
      type: 'credit',
      issuer: 'Bank B',
      country: 'United States',
      countryCode: 'US',
      normalizedCountryCode: 'US',
      normalizedCountry: 'United States',
      normalizedIssuer: 'BANK B',
      normalizedScheme: 'visa',
      normalizedBrand: 'Visa Classic',
      normalizedType: 'credit',
      confidence: 95,
    };

    const result = mergeRecords([
      { info: sourceA, records: [recordA] },
      { info: sourceB, records: [recordB] },
    ]);

    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].source).toBe('binlist/data');
    expect(result.merged[0].issuer).toBe('BANK A');
    expect(result.merged[0].sources.map((s) => s.source)).toEqual([
      'binlist/data',
      'aderyabin/bin_list',
    ]);

    const rawSources = (result.merged[0].raw as { _sources?: string[] })._sources;
    expect(rawSources).toEqual(['binlist/data', 'aderyabin/bin_list']);
  });
});
