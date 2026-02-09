# GitHub Actions Setup Guide

**Ngày tạo**: 2026-01-26  
**Mục đích**: Hướng dẫn enable và configure GitHub Actions workflow

---

## ✅ Workflow File Created

**Location**: `.github/workflows/analysis.yml`

**Status**: ✅ File đã được tạo

---

## 🚀 Enable Workflow

### Step 1: Push to GitHub

```bash
# Add workflow file
git add .github/workflows/analysis.yml

# Commit
git commit -m "Add automated analysis workflow"

# Push to GitHub
git push origin main
```

### Step 2: Verify in GitHub

1. Go to GitHub repository
2. Click "Actions" tab
3. Verify workflow appears
4. Check workflow is enabled

---

## ⚙️ Workflow Configuration

### Triggers

1. **Scheduled**: Every Sunday at midnight UTC
   ```yaml
   schedule:
     - cron: '0 0 * * 0'
   ```

2. **Manual**: workflow_dispatch
   - Go to Actions tab
   - Select "Project Analysis"
   - Click "Run workflow"

3. **Auto-trigger**: On push to main
   - When reports change
   - When analysis code changes

### Artifacts

- **Name**: `analysis-reports`
- **Path**: `reports/analysis/`
- **Retention**: 30 days

### PR Comments

- Auto-comment on PRs
- Shows analysis summary
- Links to full reports

---

## 📊 Workflow Output

### Artifacts

After workflow runs, you can download:
- `PROJECT_COMPLETION_STATUS.md`
- `GAP_ANALYSIS_DETAILED.md`
- `WBS_COMPLETE.md`
- `ACTION_PLAN_100_PERCENT.md`

### Summary

Workflow creates a summary in Actions tab:
- ✅ Analysis completed
- 📄 Reports generated
- 📦 Artifacts available

---

## 🔧 Customization

### Change Schedule

Edit `.github/workflows/analysis.yml`:

```yaml
schedule:
  # Daily at 2 AM UTC
  - cron: '0 2 * * *'
  
  # Weekly on Monday
  - cron: '0 0 * * 1'
  
  # Monthly on 1st
  - cron: '0 0 1 * *'
```

### Add Notifications

Add Slack/Email notifications:

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Analysis completed!"
      }
```

### Add to Different Branch

```yaml
on:
  push:
    branches:
      - main
      - develop  # Add other branches
```

---

## 📋 Checklist

### Setup

- [ ] Workflow file exists (`.github/workflows/analysis.yml`)
- [ ] File pushed to GitHub
- [ ] Workflow appears in Actions tab
- [ ] Workflow is enabled

### Testing

- [ ] Manual trigger works
- [ ] Scheduled run works (wait for schedule)
- [ ] Auto-trigger works (push changes)
- [ ] Artifacts are created
- [ ] PR comments work (if applicable)

### Monitoring

- [ ] Check workflow runs regularly
- [ ] Review generated reports
- [ ] Monitor for failures
- [ ] Update as needed

---

## 🐛 Troubleshooting

### Workflow Not Running

**Issue**: Workflow doesn't appear in Actions tab

**Solution**:
1. Check file is in `.github/workflows/` directory
2. Verify YAML syntax is correct
3. Push to GitHub
4. Refresh Actions tab

### Workflow Fails

**Issue**: Workflow fails

**Solution**:
1. Check workflow logs
2. Verify Node.js version
3. Check dependencies
4. Review error messages

### Artifacts Not Created

**Issue**: No artifacts after run

**Solution**:
1. Check if reports directory exists
2. Verify file paths
3. Check workflow logs
4. Ensure reports are generated

---

## 📈 Monitoring

### Check Workflow Status

1. Go to Actions tab
2. Select "Project Analysis"
3. View recent runs
4. Check status (✅/❌)

### Download Reports

1. Go to workflow run
2. Scroll to "Artifacts"
3. Click "analysis-reports"
4. Download ZIP
5. Extract reports

### View Trends

1. Run tracking: `npm run track-completion`
2. Check `reports/completion-trend.md`
3. Compare với previous runs
4. Identify trends

---

## 🎯 Best Practices

### Do's ✅

- ✅ Run workflow regularly
- ✅ Review generated reports
- ✅ Track trends over time
- ✅ Update workflow as needed
- ✅ Monitor for failures

### Don'ts ❌

- ❌ Don't commit secrets
- ❌ Don't run too frequently (waste resources)
- ❌ Don't ignore failures
- ❌ Don't skip reviews

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Scheduled Events](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events)

---

*Created: 2026-01-26*
