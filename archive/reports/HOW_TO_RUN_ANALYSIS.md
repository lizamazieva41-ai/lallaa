# Hướng Dẫn Chạy Hệ Thống Phân Tích

## Vấn Đề PowerShell Execution Policy

Nếu gặp lỗi PowerShell execution policy, có các cách sau:

### Cách 1: Fix Execution Policy (Recommended)

```powershell
# Mở PowerShell as Administrator và chạy:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Sau đó chạy:
npm run analyze-reports
```

### Cách 2: Chạy Trực Tiếp với Node

```bash
# Sử dụng node với ts-node register
node -r ts-node/register scripts/test-analysis.ts

# Hoặc nếu đã build:
npm run build
node dist/scripts/test-analysis.js
```

### Cách 3: Sử dụng Git Bash hoặc WSL

Nếu có Git Bash hoặc WSL:

```bash
npm run analyze-reports
```

### Cách 4: Chạy trong VS Code Terminal

Mở VS Code terminal (thường là cmd hoặc bash) và chạy:

```bash
npm run analyze-reports
```

## Các Lệnh Có Sẵn

```bash
# Chạy analysis với default settings
npm run analyze-reports

# Chạy test script (bypasses some issues)
npm run test-analysis

# Xem help
npm run analyze-reports:help

# Với options
npm run analyze-reports -- --input ./docs --output ./reports/analysis
```

## Manual Testing

Nếu không thể chạy script, bạn có thể test từng module:

### Test Report Parser

```typescript
import { ReportParser } from './src/analysis/reportParser';

const parser = new ReportParser();
const report = await parser.parseReport('ANALYSIS_REPORT.md');
console.log(report);
```

### Test Full Analysis

```typescript
import { ProjectAnalyzer } from './src/analysis/analyzer';

const analyzer = new ProjectAnalyzer();
const result = await analyzer.analyze([
  'ANALYSIS_REPORT.md',
  'SECURITY_ASSESSMENT.md',
  // ... other reports
]);

console.log('Completion:', result.completionStatus.overall);
console.log('Gaps:', result.gaps.length);
```

## Expected Output

Sau khi chạy thành công, bạn sẽ thấy:

1. **Console Output:**
   ```
   📖 Parsing reports...
   📊 Extracting completion status...
   🔍 Extracting metrics and pending items...
   🎯 Analyzing gaps...
   📋 Generating WBS...
   📅 Calculating timeline...
   ⚠️ Generating risk assessments...
   👥 Calculating resource requirements...
   📝 Generating reports...
   💾 Saving reports...
   ```

2. **Generated Files trong `reports/analysis/`:**
   - `PROJECT_COMPLETION_STATUS.md`
   - `GAP_ANALYSIS_DETAILED.md`
   - `WBS_COMPLETE.md`
   - `ACTION_PLAN_100_PERCENT.md`

## Troubleshooting

### Không Tìm Thấy Reports

Đảm bảo các file sau tồn tại trong thư mục root:
- `ANALYSIS_REPORT.md`
- `TECHNICAL_ANALYSIS.md`
- `SECURITY_ASSESSMENT.md`
- `DATA_QUALITY_REPORT.md`
- `PERFORMANCE_ANALYSIS.md`
- `RECOMMENDATIONS_ROADMAP.md`
- `PRODUCTION_COMPLETION_REPORT.md`
- `PRODUCTION_READY.md`

### TypeScript Compilation Errors

```bash
# Build project first
npm run build

# Check for errors
npm run lint
```

### Module Not Found Errors

```bash
# Reinstall dependencies
npm install
```

## Next Steps After Running

1. **Review Generated Reports:**
   - Mở `reports/analysis/PROJECT_COMPLETION_STATUS.md`
   - Kiểm tra tỷ lệ hoàn thành
   - Xem các metrics

2. **Check Gap Analysis:**
   - Mở `reports/analysis/GAP_ANALYSIS_DETAILED.md`
   - Review các gaps được identify
   - Verify priorities

3. **Review WBS:**
   - Mở `reports/analysis/WBS_COMPLETE.md`
   - Check task structure
   - Verify dependencies

4. **Action Plan:**
   - Mở `reports/analysis/ACTION_PLAN_100_PERCENT.md`
   - Review timeline
   - Check resource requirements
