# ETL Pipeline Troubleshooting

## Common Issues

### Issue: ETL Fails to Start

**Symptoms:**
- ETL script exits immediately
- No error messages

**Solutions:**
1. Check database connection
2. Verify data source paths exist
3. Check file permissions
4. Review logs for errors

### Issue: Data Extraction Fails

**Symptoms:**
- "File not found" errors
- "Invalid format" errors

**Solutions:**
1. Verify source files exist
2. Check file format (CSV/JSON/YAML)
3. Validate file encoding (UTF-8)
4. Review extraction logs

### Issue: Normalization Errors

**Symptoms:**
- Country code mapping failures
- Issuer name normalization issues

**Solutions:**
1. Check country mapping file
2. Review normalization rules
3. Update country mapping if needed
4. Check for encoding issues

### Issue: Merge Conflicts

**Symptoms:**
- High number of conflicts
- Manual review queue growing

**Solutions:**
1. Review conflict resolution rules
2. Check source priority settings
3. Manually resolve high-priority conflicts
4. Adjust confidence thresholds

### Issue: Database Load Errors

**Symptoms:**
- "Connection pool exhausted"
- "Query timeout" errors

**Solutions:**
1. Increase connection pool size
2. Optimize queries
3. Run ETL during off-peak hours
4. Process in smaller batches

## Diagnostic Commands

```bash
# Check ETL history
GET /api/v1/admin/etl/history

# Check source quality
GET /api/v1/admin/reports/source-quality

# Analyze queries
npm run scripts/database/analyzeQueries.ts
```

## Recovery Procedures

1. **Partial Failure**: Re-run ETL for failed sources only
2. **Complete Failure**: Restore from backup, investigate, re-run
3. **Data Corruption**: Restore from backup, validate data integrity
