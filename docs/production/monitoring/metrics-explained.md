# Metrics Explained

## Overview

This document explains the metrics exposed by the BIN Check API v2.0.

## Quality Metrics

### Accuracy

- **Definition**: Percentage of correct field values vs golden set
- **Target**: ≥95% (initial), ≥98% (final)
- **Calculation**: `correct / total * 100`

### Completeness

- **Definition**: Percentage of non-null required fields
- **Target**: ≥90%
- **Calculation**: `nonNullRecords / totalRecords * 100`

### Freshness

- **Definition**: Percentage of records updated within last 90 days
- **Target**: ≥80%
- **Calculation**: `freshRecords / totalRecords * 100`

### Consistency

- **Definition**: Average confidence score across sources
- **Target**: ≥85%
- **Calculation**: `averageConfidence / 100`

## Performance Metrics

### Response Time

- **p50**: Median response time
- **p95**: 95th percentile response time (target: <50ms)
- **p99**: 99th percentile response time

### Cache Metrics

- **Hit Rate**: Percentage of requests served from cache (target: >95%)
- **Miss Rate**: Percentage of requests requiring database lookup
- **Response Time by Tier**: Bloom, LRU, Redis, Database

## System Metrics

### Database

- **Connection Pool**: Total, idle, waiting connections
- **Query Performance**: Average query time, slow queries
- **Index Usage**: Index scan statistics

### Application

- **Request Rate**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Memory Usage**: Heap size, RSS

## Accessing Metrics

```bash
# Prometheus metrics
GET /metrics

# Quality metrics
GET /api/v1/monitoring/quality

# Cache metrics
GET /api/v1/admin/cache/stats
```
