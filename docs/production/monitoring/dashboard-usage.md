# Dashboard Usage Guide

## Overview

This guide covers using the quality monitoring dashboard.

## Accessing Dashboard

```bash
GET /api/v1/monitoring/quality/dashboard
```

## Dashboard Components

### Current Metrics

- Overall quality score
- Field-specific metrics (country, network, issuer, type)
- Accuracy, completeness, freshness, consistency

### Trends

- 30-day trends
- 60-day trends
- 90-day trends
- Trend direction (improving/degrading/stable)

### Anomalies

- Detected anomalies
- Severity levels
- Recommendations

### Alerts

- Active alerts
- Severity filtering
- Alert history

## Using the Dashboard

1. **Monitor Overall Score**: Should be > 0.85
2. **Review Trends**: Identify degrading metrics
3. **Check Anomalies**: Address critical issues
4. **Review Alerts**: Take action on high-severity alerts

## Best Practices

- Check dashboard daily
- Review trends weekly
- Address critical anomalies immediately
- Document actions taken
