# CI/CD Integration Guide - Analysis System

## Tổng Quan

Hướng dẫn tích hợp hệ thống phân tích tự động vào CI/CD pipeline để:
- Auto-generate reports sau mỗi sprint
- Track completion status over time
- Alert khi có gaps mới
- Share reports với team

---

## 1. GitHub Actions Integration

### File: `.github/workflows/analysis.yml`

```yaml
name: Project Analysis

on:
  schedule:
    # Run every Sunday at midnight
    - cron: '0 0 * * 0'
  workflow_dispatch:
    # Manual trigger
  push:
    branches:
      - main
    paths:
      - '**/*.md'
      - 'src/analysis/**'

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run analysis
        run: npm run test-analysis
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: analysis-reports
          path: reports/analysis/
          retention-days: 30
      
      - name: Comment on PR (if PR)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const completionStatus = fs.readFileSync(
              'reports/analysis/PROJECT_COMPLETION_STATUS.md',
              'utf-8'
            );
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📊 Project Analysis Results\n\n${completionStatus}`
            });
      
      - name: Create summary
        run: |
          echo "## Analysis Summary" >> $GITHUB_STEP_SUMMARY
          echo "- Reports generated successfully" >> $GITHUB_STEP_SUMMARY
          echo "- Check artifacts for full reports" >> $GITHUB_STEP_SUMMARY
```

---

*File này đã được di chuyển vào archive/reports/ trong quá trình dọn dẹp dự án. Xem file gốc để biết đầy đủ nội dung.*
