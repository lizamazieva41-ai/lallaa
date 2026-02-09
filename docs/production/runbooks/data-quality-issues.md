# Data Quality Issues Runbook

## Overview

This runbook covers procedures for addressing data quality issues detected by the monitoring system.

## Issue Types

### Accuracy Drop

**Symptoms:**
- Accuracy below 95% threshold
- High mismatch rates in golden set validation

**Actions:**
1. Review conflict resolution decisions
2. Check data source quality
3. Run manual verification
4. Update conflict resolution rules if needed

### Completeness Drop

**Symptoms:**
- Completeness below 90% threshold
- Missing required fields

**Actions:**
1. Review data sources for missing fields
2. Check ETL pipeline for data loss
3. Add missing data sources if needed
4. Update normalization rules

### Freshness Degradation

**Symptoms:**
- Freshness below 80% threshold
- Old last_updated timestamps

**Actions:**
1. Run ETL pipeline
2. Check data source update frequency
3. Schedule more frequent ETL runs
4. Review last_updated timestamps

### Consistency Issues

**Symptoms:**
- Low confidence scores
- High conflict rates

**Actions:**
1. Review conflict resolution rules
2. Check source agreement rates
3. Improve confidence scoring
4. Manually resolve high-priority conflicts

## Escalation

- **Low/Medium**: Monitor and document
- **High**: Investigate within 24 hours
- **Critical**: Immediate investigation and resolution

## Prevention

1. Regular quality monitoring
2. Automated anomaly detection
3. Proactive conflict resolution
4. Regular ETL runs
