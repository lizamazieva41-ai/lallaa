/**
 * Unit tests for WBSGenerator
 */

import { WBSGenerator } from '../../../src/analysis/wbsGenerator';
import { Gap } from '../../../src/analysis/types';

describe('WBSGenerator', () => {
  let generator: WBSGenerator;

  beforeEach(() => {
    generator = new WBSGenerator();
  });

  describe('generateWBS', () => {
    it('should generate WBS from gaps', () => {
      const gaps: Gap[] = [
        {
          id: 'gap-1',
          title: 'Fix JWT Security',
          description: 'Fix JWT security issues',
          category: 'Security',
          currentValue: 0,
          targetValue: 100,
          priority: 'CRITICAL',
          effort: '1 week',
          dependencies: [],
          riskLevel: 'CRITICAL',
          estimatedDays: 7,
          estimatedWeeks: 1,
        },
        {
          id: 'gap-2',
          title: 'Increase Test Coverage',
          description: 'Increase test coverage to 80%',
          category: 'Testing',
          currentValue: 43.5,
          targetValue: 80,
          priority: 'HIGH',
          effort: '2 weeks',
          dependencies: [],
          riskLevel: 'HIGH',
          estimatedDays: 14,
          estimatedWeeks: 2,
        },
      ];

      const wbs = generator.generateWBS(gaps);

      expect(wbs.projectName).toBe('BIN Check API - 100/100 Completion');
      expect(wbs.phases.length).toBeGreaterThan(0);
      expect(wbs.totalDuration).toBeGreaterThan(0);
    });

    it('should organize tasks into phases', () => {
      const gaps: Gap[] = [
        {
          id: 'gap-1',
          title: 'Security Fix',
          description: 'Fix security',
          category: 'Security',
          currentValue: 0,
          targetValue: 100,
          priority: 'CRITICAL',
          effort: '1 week',
          dependencies: [],
          riskLevel: 'CRITICAL',
          estimatedDays: 7,
          estimatedWeeks: 1,
        },
      ];

      const wbs = generator.generateWBS(gaps);

      expect(wbs.phases[0].name).toContain('Phase 1');
      expect(wbs.phases[0].tasks.length).toBeGreaterThan(0);
    });
  });

  describe('buildTasks', () => {
    it('should build tasks from gaps', () => {
      const gaps: Gap[] = [
        {
          id: 'gap-1',
          title: 'Test Task',
          description: 'Test description',
          category: 'Testing',
          currentValue: 0,
          targetValue: 100,
          priority: 'HIGH',
          effort: '1 week',
          dependencies: [],
          riskLevel: 'HIGH',
          estimatedDays: 7,
          estimatedWeeks: 1,
        },
      ];

      const tasks = generator.buildTasks(gaps);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Test Task');
      expect(tasks[0].definitionOfDone.length).toBeGreaterThan(0);
    });
  });
});
