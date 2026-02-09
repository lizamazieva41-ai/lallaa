/**
 * Integration tests for Analysis System
 */

import * as path from 'path';
import * as fs from 'fs';
import { ProjectAnalyzer } from '../../src/analysis/analyzer';

describe('Analysis System Integration', () => {
  let analyzer: ProjectAnalyzer;

  beforeEach(() => {
    analyzer = new ProjectAnalyzer();
  });

  it('should analyze reports and generate results', async () => {
    // Create a test report
    const testReportPath = path.join(__dirname, 'test-report.md');
    const testReportContent = `# Test Report

## Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Test Coverage | 43.5 | 80 | ⚠️ Below Target |
| OWASP Compliance | 42.5 | 70 | ⚠️ Below Target |

## Completed Items

✅ JWT authentication
✅ Password hashing

## Pending Items

⚠️ Fix JWT security issues
⚠️ Increase test coverage
`;

    await fs.promises.writeFile(testReportPath, testReportContent, 'utf-8');

    try {
      const result = await analyzer.analyze([testReportPath]);

      expect(result.completionStatus).toBeDefined();
      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.wbs).toBeDefined();
      expect(result.wbs.phases.length).toBeGreaterThan(0);
      expect(result.timeline).toBeDefined();
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.resourceRequirements).toBeDefined();

      // Generate reports
      const reports = analyzer.generateReports(result);

      expect(reports.completionStatus).toContain('Trạng Thái Hoàn Thành');
      expect(reports.gapAnalysis).toContain('Phân Tích Khoảng Trống');
      expect(reports.wbs).toContain('Work Breakdown Structure');
      expect(reports.actionPlan).toContain('Kế Hoạch Hành Động');
    } finally {
      // Cleanup
      if (fs.existsSync(testReportPath)) {
        await fs.promises.unlink(testReportPath);
      }
    }
  }, 30000);
});
