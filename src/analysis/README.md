# Hệ thống Phân tích Tự động Báo cáo Dự án

Hệ thống tự động đọc, phân tích và tạo kế hoạch hành động từ các báo cáo dự án để đạt mục tiêu hoàn thiện 100/100.

## Tổng Quan

Hệ thống này tự động:
- Đọc và parse các báo cáo markdown
- Trích xuất metrics, completed/pending items
- Phân tích khoảng trống (gaps)
- Tạo Work Breakdown Structure (WBS) chi tiết
- Tạo các báo cáo tổng hợp

## Cấu Trúc

```
src/analysis/
├── types.ts                 # Type definitions
├── interfaces.ts            # Interfaces
├── reportParser.ts          # Main parser
├── markdownParser.ts        # Markdown parsing utilities
├── dataExtractor.ts        # Data extraction
├── metricsExtractor.ts      # Metrics extraction
├── gapAnalyzer.ts          # Gap analysis
├── priorityCalculator.ts   # Priority calculation
├── wbsGenerator.ts         # WBS generation
├── taskBuilder.ts          # Task building utilities
├── timelineCalculator.ts   # Timeline calculation
├── reportGenerator.ts      # Report generation
├── templateEngine.ts       # Template engine
├── analyzer.ts             # Main analyzer orchestrator
└── cli.ts                  # CLI interface
```

## Sử Dụng

### Command Line

```bash
# Phân tích tất cả báo cáo trong thư mục hiện tại
npm run analyze-reports

# Chỉ định thư mục input và output
npm run analyze-reports -- --input ./docs --output ./reports/analysis

# Chỉ định các file báo cáo cụ thể
npm run analyze-reports -- --reports ANALYSIS_REPORT.md,SECURITY_ASSESSMENT.md

# Xem help
npm run analyze-reports:help
```

### Programmatic Usage

```typescript
import { ProjectAnalyzer } from './src/analysis/analyzer';

const analyzer = new ProjectAnalyzer();

// Analyze reports
const result = await analyzer.analyze([
  'ANALYSIS_REPORT.md',
  'SECURITY_ASSESSMENT.md',
  // ... other reports
]);

// Generate reports
const reports = analyzer.generateReports(result);

// Save reports
console.log(reports.completionStatus);
console.log(reports.gapAnalysis);
console.log(reports.wbs);
console.log(reports.actionPlan);
```

## Output Files

Hệ thống tạo ra 4 báo cáo chính:

1. **PROJECT_COMPLETION_STATUS.md** - Trạng thái hoàn thành hiện tại
2. **GAP_ANALYSIS_DETAILED.md** - Phân tích chi tiết các khoảng trống
3. **WBS_COMPLETE.md** - Work Breakdown Structure đầy đủ
4. **ACTION_PLAN_100_PERCENT.md** - Kế hoạch hành động để đạt 100/100

## Modules

### ReportParser

Đọc và parse các file markdown báo cáo:
- Parse headers, sections
- Extract checkboxes (✅, [x], [ ])
- Extract tables
- Extract metrics
- Extract completed/pending items

### DataExtractor

Trích xuất dữ liệu từ parsed reports:
- Completion status
- Metrics
- Completed items
- Pending items

### GapAnalyzer

Phân tích khoảng trống:
- So sánh current vs target
- Phân loại theo priority (CRITICAL, HIGH, MEDIUM, LOW)
- Ước lượng effort

### WBSGenerator

Tạo Work Breakdown Structure:
- Build tasks từ gaps
- Organize vào phases
- Calculate dependencies
- Estimate timelines

### ReportGenerator

Tạo các báo cáo markdown:
- Completion status report
- Gap analysis report
- WBS report
- Action plan report

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit -- --testPathPattern=analysis

# Run integration tests
npm run test:integration -- --testPathPattern=analysis
```

## Dependencies

Hệ thống chỉ sử dụng các dependencies có sẵn:
- TypeScript
- Node.js fs/path modules
- Jest (for testing)

Không cần thêm dependencies mới.

## Examples

### Example 1: Basic Usage

```bash
npm run analyze-reports
```

Sẽ tìm tất cả các file báo cáo trong thư mục hiện tại và tạo reports trong `reports/analysis/`.

### Example 2: Custom Input/Output

```bash
npm run analyze-reports -- --input ./docs --output ./output
```

### Example 3: Specific Reports

```bash
npm run analyze-reports -- --reports ANALYSIS_REPORT.md,SECURITY_ASSESSMENT.md
```

## Notes

- Hệ thống tự động nhận diện các file báo cáo dựa trên tên file hoặc nội dung
- Các báo cáo được parse và merge để tạo ra kết quả tổng hợp
- WBS được tự động tạo dựa trên gaps và priorities
- Timeline được tính toán dựa trên dependencies và effort estimates
