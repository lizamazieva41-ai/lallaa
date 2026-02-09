/**
 * Unit tests for GapAnalyzer
 */

import { GapAnalyzer } from '../../../src/analysis/gapAnalyzer';
import { CompletionStatus, Metric } from '../../../src/analysis/types';

describe('GapAnalyzer', () => {
  let analyzer: GapAnalyzer;

  beforeEach(() => {
    analyzer = new GapAnalyzer();
  });

  describe('analyzeGaps', () => {
    it('should identify gaps from metrics', () => {
      const completionStatus: CompletionStatus = {
        overall: 50,
        byCategory: {
          Testing: 50,
          Security: 60,
        },
        metrics: [
          {
            name: 'Test Coverage',
            current: 43.5,
            target: 80,
            status: 'below_target',
          },
        ],
        completedCount: 10,
        pendingCount: 10,
        totalCount: 20,
      };

      const metrics: Metric[] = [
        {
          name: 'Test Coverage',
          current: 43.5,
          target: 80,
          status: 'below_target',
        },
      ];

      const gaps = analyzer.analyzeGaps(completionStatus, metrics, []);

      expect(gaps.length).toBeGreaterThan(0);
      const testCoverageGap = gaps.find((g) =>
        g.title.includes('Test Coverage')
      );
      expect(testCoverageGap).toBeDefined();
      if (testCoverageGap) {
        expect(testCoverageGap.currentValue).toBe(43.5);
        expect(testCoverageGap.targetValue).toBe(80);
      }
    });

    it('should classify gaps by priority', () => {
      const completionStatus: CompletionStatus = {
        overall: 50,
        byCategory: {},
        metrics: [],
        completedCount: 0,
        pendingCount: 0,
        totalCount: 0,
      };

      const gaps = analyzer.analyzeGaps(completionStatus, [], [
        {
          id: '1',
          description: 'Security fix',
          category: 'Security',
          priority: 'CRITICAL',
        },
        {
          id: '2',
          description: 'Test coverage',
          category: 'Testing',
          priority: 'HIGH',
        },
      ]);

      const classified = analyzer.classifyByPriority(gaps);

      expect(classified.CRITICAL.length).toBeGreaterThan(0);
      expect(classified.HIGH.length).toBeGreaterThan(0);
    });
  });
});
