/**
 * Unit tests for ReportParser
 */

import { ReportParser } from '../../../src/analysis/reportParser';

describe('ReportParser', () => {
  let parser: ReportParser;

  beforeEach(() => {
    parser = new ReportParser();
  });

  describe('parseMarkdown', () => {
    it('should parse markdown with headers', () => {
      const content = `# Title
## Section 1
Content 1
### Subsection 1.1
Content 1.1
## Section 2
Content 2`;

      const result = parser.parseMarkdown(content, 'test.md');

      expect(result.title).toBe('Title');
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].title).toBe('Section 1');
      expect(result.sections[0].subsections).toHaveLength(1);
      expect(result.sections[0].subsections[0].title).toBe('Subsection 1.1');
    });

    it('should extract checkboxes', () => {
      const content = `# Test
- [x] Completed task
- [ ] Pending task
- [X] Another completed`;

      const result = parser.parseMarkdown(content, 'test.md');

      expect(result.allCheckboxes).toHaveLength(3);
      expect(result.allCheckboxes[0].checked).toBe(true);
      expect(result.allCheckboxes[1].checked).toBe(false);
      expect(result.allCheckboxes[2].checked).toBe(true);
    });

    it('should extract tables', () => {
      const content = `# Test
| Header 1 | Header 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |`;

      const result = parser.parseMarkdown(content, 'test.md');

      expect(result.allTables).toHaveLength(1);
      expect(result.allTables[0].headers).toEqual(['Header 1', 'Header 2']);
      expect(result.allTables[0].rows).toHaveLength(2);
    });

    it('should extract metrics from tables', () => {
      const content = `# Test
| Metric | Current | Target | Status |
|--------|--------|--------|--------|
| Test Coverage | 43.5 | 80 | ⚠️ Below Target |`;

      const result = parser.parseMarkdown(content, 'test.md');

      expect(result.allMetrics.length).toBeGreaterThan(0);
      const testCoverage = result.allMetrics.find((m) =>
        m.name.includes('Test Coverage')
      );
      expect(testCoverage).toBeDefined();
      if (testCoverage) {
        expect(testCoverage.current).toBe(43.5);
        expect(testCoverage.target).toBe(80);
      }
    });

    it('should extract completed items', () => {
      const content = `# Test
## Security
✅ JWT authentication implemented
✅ Password hashing with bcrypt`;

      const result = parser.parseMarkdown(content, 'test.md');

      expect(result.completedItems.length).toBeGreaterThan(0);
      expect(
        result.completedItems.some((item) =>
          item.description.includes('JWT')
        )
      ).toBe(true);
    });

    it('should extract pending items', () => {
      const content = `# Test
## Security
⚠️ Fix JWT security issues
⚠️ Upgrade bcrypt`;

      const result = parser.parseMarkdown(content, 'test.md');

      expect(result.pendingItems.length).toBeGreaterThan(0);
      expect(
        result.pendingItems.some((item) => item.description.includes('JWT'))
      ).toBe(true);
    });
  });
});
