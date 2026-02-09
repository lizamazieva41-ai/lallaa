/**
 * Unit tests for DataExtractor
 */

import { DataExtractor } from '../../../src/analysis/dataExtractor';
import { ParsedReport, Metric } from '../../../src/analysis/types';

describe('DataExtractor', () => {
  let extractor: DataExtractor;

  beforeEach(() => {
    extractor = new DataExtractor();
  });

  describe('extractCompletionStatus', () => {
    it('should extract completion status from reports', () => {
      const reports: ParsedReport[] = [
        {
          filename: 'test1.md',
          title: 'Test Report 1',
          sections: [],
          allCheckboxes: [],
          allTables: [],
          allMetrics: [
            {
              name: 'Test Coverage',
              current: 43.5,
              target: 80,
              unit: '%',
              status: 'below_target',
            },
          ],
          completedItems: [
            {
              id: '1',
              description: 'Task 1',
              category: 'Security',
            },
          ],
          pendingItems: [
            {
              id: '2',
              description: 'Task 2',
              category: 'Testing',
              priority: 'HIGH',
            },
          ],
        },
      ];

      const result = extractor.extractCompletionStatus(reports);

      expect(result.overall).toBeGreaterThan(0);
      expect(result.completedCount).toBe(1);
      expect(result.pendingCount).toBe(1);
      expect(result.metrics).toHaveLength(1);
    });

    it('should merge metrics from multiple reports', () => {
      const reports: ParsedReport[] = [
        {
          filename: 'test1.md',
          title: 'Test Report 1',
          sections: [],
          allCheckboxes: [],
          allTables: [],
          allMetrics: [
            {
              name: 'Test Coverage',
              current: 43.5,
              target: 80,
              status: 'below_target',
            },
          ],
          completedItems: [],
          pendingItems: [],
        },
        {
          filename: 'test2.md',
          title: 'Test Report 2',
          sections: [],
          allCheckboxes: [],
          allTables: [],
          allMetrics: [
            {
              name: 'OWASP Compliance',
              current: 42.5,
              target: 70,
              status: 'below_target',
            },
          ],
          completedItems: [],
          pendingItems: [],
        },
      ];

      const result = extractor.extractCompletionStatus(reports);

      expect(result.metrics).toHaveLength(2);
    });
  });

  describe('extractKeyMetrics', () => {
    it('should extract key metrics', () => {
      const reports: ParsedReport[] = [
        {
          filename: 'test.md',
          title: 'Test Report',
          sections: [],
          allCheckboxes: [],
          allTables: [],
          allMetrics: [
            {
              name: 'Test Coverage',
              current: 43.5,
              target: 80,
              status: 'below_target',
            },
            {
              name: 'OWASP Compliance',
              current: 42.5,
              target: 70,
              status: 'below_target',
            },
          ],
          completedItems: [],
          pendingItems: [],
        },
      ];

      const result = extractor.extractKeyMetrics(reports);

      expect(result.testCoverage).toBeDefined();
      expect(result.owaspCompliance).toBeDefined();
    });
  });
});
