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

## 2. GitLab CI Integration

### File: `.gitlab-ci.yml`

```yaml
stages:
  - analyze

analyze:
  stage: analyze
  image: node:18
  script:
    - npm ci
    - npm run test-analysis
  artifacts:
    paths:
      - reports/analysis/
    expire_in: 30 days
  only:
    - main
    - schedules
```

---

## 3. Jenkins Pipeline

### File: `Jenkinsfile`

```groovy
pipeline {
    agent any
    
    triggers {
        cron('H 0 * * 0') // Weekly
    }
    
    stages {
        stage('Analysis') {
            steps {
                sh 'npm ci'
                sh 'npm run test-analysis'
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'reports/analysis/**',
                             allowEmptyArchive: true
        }
        success {
            emailext (
                subject: "Project Analysis Complete",
                body: "Analysis reports generated successfully.",
                attachmentsPattern: 'reports/analysis/**'
            )
        }
    }
}
```

---

## 4. Track Completion Over Time

### File: `scripts/track-completion.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../src/analysis/analyzer';

interface CompletionHistory {
  date: string;
  overall: number;
  byCategory: { [category: string]: number };
  gaps: number;
}

async function trackCompletion(): Promise<void> {
  const analyzer = new ProjectAnalyzer();
  
  // Find reports
  const reportFiles = [
    'ANALYSIS_REPORT.md',
    'SECURITY_ASSESSMENT.md',
    // ... other reports
  ].map((f) => path.join(process.cwd(), f))
   .filter((f) => fs.existsSync(f));
  
  // Run analysis
  const result = await analyzer.analyze(reportFiles);
  
  // Load history
  const historyFile = path.join(process.cwd(), 'reports', 'completion-history.json');
  let history: CompletionHistory[] = [];
  
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
  }
  
  // Add current entry
  history.push({
    date: new Date().toISOString().split('T')[0],
    overall: result.completionStatus.overall,
    byCategory: result.completionStatus.byCategory,
    gaps: result.gaps.length,
  });
  
  // Keep last 52 weeks
  if (history.length > 52) {
    history = history.slice(-52);
  }
  
  // Save history
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  
  // Generate trend report
  generateTrendReport(history);
}

function generateTrendReport(history: CompletionHistory[]): void {
  let report = `# Completion Trend Report\n\n`;
  report += `**Generated**: ${new Date().toISOString().split('T')[0]}\n\n`;
  
  report += `## Overall Completion Trend\n\n`;
  report += `| Date | Overall | Gaps |\n`;
  report += `|------|---------|------|\n`;
  
  for (const entry of history) {
    report += `| ${entry.date} | ${entry.overall.toFixed(1)}% | ${entry.gaps} |\n`;
  }
  
  // Save trend report
  const trendFile = path.join(process.cwd(), 'reports', 'completion-trend.md');
  fs.writeFileSync(trendFile, report);
}

// Run if called directly
if (require.main === module) {
  trackCompletion().catch(console.error);
}
```

---

## 5. Slack Notifications

### File: `scripts/slack-notify.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { ProjectAnalyzer } from '../src/analysis/analyzer';

async function notifySlack(): Promise<void> {
  const analyzer = new ProjectAnalyzer();
  
  // Run analysis
  const reportFiles = [/* ... */];
  const result = await analyzer.analyze(reportFiles);
  
  // Prepare message
  const message = {
    text: '📊 Project Analysis Complete',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Project Analysis Results*\n\n` +
                `✅ Completion: ${result.completionStatus.overall.toFixed(1)}%\n` +
                `🎯 Gaps: ${result.gaps.length}\n` +
                `⏱️  Timeline: ${result.wbs.totalEffort}`
        }
      }
    ]
  };
  
  // Send to Slack (requires SLACK_WEBHOOK_URL)
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }
}
```

---

## 6. Automated Reports After Sprint

### File: `scripts/sprint-analysis.ts`

```typescript
import { ProjectAnalyzer } from '../src/analysis/analyzer';
import * as fs from 'fs';
import * as path from 'path';

async function sprintAnalysis(): Promise<void> {
  const analyzer = new ProjectAnalyzer();
  
  // Run analysis
  const result = await analyzer.analyze([/* reports */]);
  
  // Generate sprint report
  const sprintReport = generateSprintReport(result);
  
  // Save to sprint folder
  const sprintDir = path.join(
    process.cwd(),
    'reports',
    'sprints',
    `sprint-${getSprintNumber()}`
  );
  
  if (!fs.existsSync(sprintDir)) {
    fs.mkdirSync(sprintDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(sprintDir, 'analysis.md'),
    sprintReport
  );
  
  // Compare with previous sprint
  compareWithPreviousSprint(sprintDir);
}

function generateSprintReport(result: any): string {
  // Generate sprint-specific report
  return `# Sprint Analysis Report\n\n...`;
}
```

---

## 7. Docker Integration

### File: `Dockerfile.analysis`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Run analysis
CMD ["npm", "run", "test-analysis"]
```

### Usage

```bash
docker build -f Dockerfile.analysis -t analysis-system .
docker run -v $(pwd)/reports:/app/reports analysis-system
```

---

## 8. Scheduled Tasks (Cron)

### Linux/Mac

```bash
# Add to crontab
0 0 * * 0 cd /path/to/project && npm run test-analysis
```

### Windows Task Scheduler

1. Create task
2. Trigger: Weekly (Sunday)
3. Action: Run program
4. Program: `npm`
5. Arguments: `run test-analysis`
6. Start in: Project directory

---

## 9. Integration Checklist

- [ ] Set up CI/CD workflow
- [ ] Configure schedule (weekly/monthly)
- [ ] Set up artifact storage
- [ ] Configure notifications (Slack/Email)
- [ ] Set up completion tracking
- [ ] Test workflow
- [ ] Document process
- [ ] Share with team

---

## 10. Best Practices

### Do's ✅

- ✅ Run analysis regularly (weekly/monthly)
- ✅ Store reports as artifacts
- ✅ Track completion over time
- ✅ Notify team of results
- ✅ Compare với previous periods
- ✅ Archive old reports

### Don'ts ❌

- ❌ Don't run too frequently (waste resources)
- ❌ Don't store reports in git (use artifacts)
- ❌ Don't ignore trends
- ❌ Don't skip notifications
- ❌ Don't delete history

---

*Last Updated: 2026-01-25*
