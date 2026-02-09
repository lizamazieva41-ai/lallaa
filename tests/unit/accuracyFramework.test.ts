import { AccuracyFramework } from '../../src/services/accuracyMeasurement/accuracyFramework';
import { CardNetwork, CardType } from '../../src/types';
import { GoldenSetRecord } from '../../src/testing/goldenSet/goldenSetTypes';
import { BINLookupResult } from '../../src/types';

describe('AccuracyFramework.calculateAccuracyMetrics', () => {
  it('counts lookup failures as mismatches so totalComparisons is never zero', () => {
    const goldenSetRecords: GoldenSetRecord[] = [
      {
        bin: '457154',
        verifiedFields: {
          country: { value: 'US', sources: ['src1'], confidence: 1 },
          network: { value: CardNetwork.VISA, sources: ['src1'], confidence: 1 },
          issuer: { value: 'Bank A', sources: ['src1'], confidence: 1 },
          type: { value: CardType.DEBIT, sources: ['src1'], confidence: 1 },
        },
        verificationMethod: 'cross-source',
        lastVerified: new Date(),
      },
      {
        bin: '457155',
        verifiedFields: {
          country: { value: 'US', sources: ['src1'], confidence: 1 },
          network: { value: CardNetwork.VISA, sources: ['src1'], confidence: 1 },
          issuer: { value: 'Bank B', sources: ['src1'], confidence: 1 },
          type: { value: CardType.CREDIT, sources: ['src1'], confidence: 1 },
        },
        verificationMethod: 'cross-source',
        lastVerified: new Date(),
      },
    ];

    // Simulate lookupBatch where all lookups fail (null results).
    const lookupResults = new Map<string, BINLookupResult | null>([
      ['457154', null],
      ['457155', null],
    ]);

    const metrics = AccuracyFramework.calculateAccuracyMetrics(goldenSetRecords, lookupResults);

    expect(metrics.overall.totalComparisons).toBeGreaterThan(0);
    expect(metrics.fields.country.total).toBeGreaterThan(0);
    expect(metrics.fields.network.total).toBeGreaterThan(0);
    expect(metrics.fields.type.total).toBeGreaterThan(0);
  });
});

