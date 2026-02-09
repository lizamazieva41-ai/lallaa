# Hướng Dẫn Iterate và Cải Thiện Hệ Thống

## Tổng Quan

Sau khi chạy analysis và review reports, bạn có thể cần điều chỉnh hệ thống để:
- Cải thiện accuracy của metrics extraction
- Refine priority calculations
- Adjust effort estimates
- Improve report templates
- Add new features

---

## 1. Điều Chỉnh Priority Calculations

### File: `src/analysis/priorityCalculator.ts`

### Method: `calculatePriority()`

**Ví dụ**: Nếu muốn test coverage luôn là HIGH priority:

```typescript
calculatePriority(
  category: string,
  riskLevel: RiskLevel,
  impact: string
): Priority {
  // Test coverage is always HIGH
  if (category.toLowerCase().includes('test') || 
      category.toLowerCase().includes('coverage')) {
    return 'HIGH';
  }
  
  // ... rest of logic
}
```

### Method: `estimateEffort()`

**Ví dụ**: Điều chỉnh effort estimates:

```typescript
estimateEffort(
  priority: Priority,
  category: string
): { days: number; weeks: number; description: string } {
  // Security fixes take longer
  if (category.toLowerCase().includes('security')) {
    if (priority === 'CRITICAL') {
      return { days: 10, weeks: 1.5, description: '1.5 weeks' };
    }
    return { days: 21, weeks: 3, description: '3 weeks' };
  }
  
  // ... rest of logic
}
```

---

## 2. Refine Effort Estimates

### File: `src/analysis/gapAnalyzer.ts`

### Method: `createGapFromMetric()`

**Ví dụ**: Tính effort dựa trên gap size:

```typescript
private createGapFromMetric(
  metric: Metric,
  current: number,
  target: number
): Gap {
  const gap = target - current;
  const gapPercent = (gap / target) * 100;
  
  // Larger gaps need more effort
  let estimatedDays = 7;
  if (gapPercent > 50) {
    estimatedDays = 21; // 3 weeks
  } else if (gapPercent > 25) {
    estimatedDays = 14; // 2 weeks
  }
  
  // ... rest of logic
}
```

---

## 3. Cải Thiện Report Templates

### File: `src/analysis/templateEngine.ts`

### Function: `generateCompletionStatusTemplate()`

**Ví dụ**: Thêm charts hoặc visualizations:

```typescript
export function generateCompletionStatusTemplate(
  completionStatus: CompletionStatus
): string {
  // Add ASCII chart
  const chart = generateASCIIChart(completionStatus.byCategory);
  
  let report = `# Trạng Thái Hoàn Thành Dự Án\n\n`;
  report += chart;
  report += `\n## Details...\n`;
  
  return report;
}
```

### Function: `generateGapAnalysisTemplate()`

**Ví dụ**: Thêm summary table:

```typescript
export function generateGapAnalysisTemplate(gaps: Gap[]): string {
  let report = `# Phân Tích Khoảng Trống Chi Tiết\n\n`;
  
  // Add summary table
  report += `## Summary\n\n`;
  report += `| Priority | Count | Total Effort |\n`;
  report += `|----------|-------|--------------|\n`;
  
  const byPriority = groupByPriority(gaps);
  for (const [priority, priorityGaps] of Object.entries(byPriority)) {
    const totalEffort = calculateTotalEffort(priorityGaps);
    report += `| ${priority} | ${priorityGaps.length} | ${totalEffort} |\n`;
  }
  
  // ... rest of template
}
```

---

## 4. Thêm Metrics Extraction Patterns

### File: `src/analysis/markdownParser.ts`

### Function: `extractMetrics()`

**Ví dụ**: Thêm pattern mới:

```typescript
export function extractMetrics(content: string): Metric[] {
  const metrics: Metric[] = [];
  
  // Existing patterns...
  
  // New pattern: "Coverage: X% (target: Y%)"
  const coveragePattern = /Coverage:\s*([\d.]+)%\s*\(target:\s*([\d.]+)%\)/gi;
  let match;
  while ((match = coveragePattern.exec(content)) !== null) {
    metrics.push({
      name: 'Coverage',
      current: parseFloat(match[1]),
      target: parseFloat(match[2]),
      unit: '%',
      status: parseFloat(match[1]) >= parseFloat(match[2]) 
        ? 'on_target' 
        : 'below_target',
    });
  }
  
  return metrics;
}
```

---

## 5. Cải Thiện WBS Generation

### File: `src/analysis/wbsGenerator.ts`

### Method: `buildPhases()`

**Ví dụ**: Điều chỉnh cách organize tasks vào phases:

```typescript
buildPhases(tasks: Task[]): PhasePlan[] {
  // Custom phase organization
  const phase1Tasks = tasks.filter(
    (t) => t.priority === 'CRITICAL' || 
           (t.category === 'Security' && t.priority === 'HIGH')
  );
  
  const phase2Tasks = tasks.filter(
    (t) => t.category === 'Testing' || 
           (t.priority === 'HIGH' && t.category !== 'Security')
  );
  
  // ... rest of logic
}
```

---

## 6. Thêm Custom Categories

### File: `src/analysis/gapAnalyzer.ts`

### Method: `determineCategory()`

**Ví dụ**: Thêm category mới:

```typescript
private determineCategory(name: string): string {
  const nameLower = name.toLowerCase();
  
  // Existing categories...
  
  // New category: Documentation
  if (nameLower.includes('documentation') || 
      nameLower.includes('docs') ||
      nameLower.includes('readme')) {
    return 'Documentation';
  }
  
  // New category: DevOps
  if (nameLower.includes('ci/cd') || 
      nameLower.includes('deployment') ||
      nameLower.includes('devops')) {
    return 'DevOps';
  }
  
  return 'General';
}
```

---

## 7. Cải Thiện Timeline Calculation

### File: `src/analysis/timelineCalculator.ts`

### Method: `calculateTimeline()`

**Ví dụ**: Thêm buffer time:

```typescript
calculateTimeline(wbs: WBS, startDate?: Date): Timeline {
  // Add 20% buffer to each phase
  const bufferMultiplier = 1.2;
  
  const phase1Duration = Math.ceil(
    this.calculatePhaseDuration(wbs.phases[0]) * bufferMultiplier
  );
  
  // ... rest of logic
}
```

---

## 8. Thêm Custom Report Sections

### File: `src/analysis/templateEngine.ts`

**Ví dụ**: Thêm section mới vào action plan:

```typescript
export function generateActionPlanTemplate(result: AnalysisResult): string {
  let report = `# Kế Hoạch Hành Động - Đạt 100/100\n\n`;
  
  // Existing sections...
  
  // New section: Quick Wins
  report += `## Quick Wins (0-2 weeks)\n\n`;
  const quickWins = result.gaps.filter(
    (g) => g.estimatedDays <= 14 && g.priority === 'HIGH'
  );
  for (const gap of quickWins) {
    report += `- ${gap.title} (${gap.effort})\n`;
  }
  
  // New section: Dependencies Graph
  report += `\n## Dependencies Graph\n\n`;
  report += generateDependenciesGraph(result.wbs);
  
  return report;
}
```

---

## 9. Testing Changes

Sau khi thay đổi, test lại:

```bash
# 1. Verify components still work
npm run verify-analysis

# 2. Run full analysis
npm run test-analysis

# 3. Review generated reports
# Check reports/analysis/ folder

# 4. Compare với previous results
# Ensure changes improve accuracy
```

---

## 10. Best Practices

### Do's ✅

- ✅ Test changes với real reports
- ✅ Keep changes backward compatible
- ✅ Document new features
- ✅ Update tests khi thêm features
- ✅ Review generated reports sau mỗi change

### Don'ts ❌

- ❌ Don't break existing functionality
- ❌ Don't hardcode values
- ❌ Don't skip testing
- ❌ Don't ignore edge cases
- ❌ Don't remove useful features

---

## 11. Common Adjustments

### Scenario 1: Priorities Too Aggressive

**Problem**: Too many CRITICAL items

**Solution**: Adjust `priorityCalculator.ts`:
```typescript
// Only security vulnerabilities are CRITICAL
if (category === 'Security' && riskLevel === 'CRITICAL') {
  return 'CRITICAL';
}
// Everything else is at most HIGH
```

### Scenario 2: Effort Estimates Too Low

**Problem**: Estimates seem unrealistic

**Solution**: Add multiplier:
```typescript
const effort = this.priorityCalculator.estimateEffort(priority, category);
// Add 30% buffer
effort.days = Math.ceil(effort.days * 1.3);
effort.weeks = effort.days / 7;
```

### Scenario 3: Missing Metrics

**Problem**: Some metrics not extracted

**Solution**: Add extraction patterns:
```typescript
// In markdownParser.ts
// Add more patterns to extractMetrics()
```

---

## 12. Version Control

Khi iterate:

1. **Create branch**: `git checkout -b improve-analysis`
2. **Make changes**: Edit files
3. **Test**: Run `npm run verify-analysis` và `npm run test-analysis`
4. **Commit**: `git commit -m "Improve priority calculations"`
5. **Review**: Check generated reports
6. **Merge**: If satisfied, merge to main

---

## 13. Getting Help

Nếu cần help:

1. Check `src/analysis/README.md` - Module documentation
2. Check `HOW_TO_RUN_ANALYSIS.md` - Running instructions
3. Review test files - `tests/unit/analysis/`
4. Check TypeScript types - `src/analysis/types.ts`

---

*Last Updated: 2026-01-25*
