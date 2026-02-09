# Prometheus Metrics & Alerting for Card Generation

## Overview

The card generation system exposes comprehensive Prometheus metrics for monitoring, alerting, and performance analysis. This document describes all available metrics and alert rules.

## Metrics Endpoint

All metrics are exposed at:
```
GET /metrics
```

## Card Generation Metrics

### 1. Card Generation Counter

**Metric:** `card_generation_total`

**Type:** Counter

**Labels:**
- `mode`: Generation mode (`random`, `sequential`, `batch_999`)
- `status`: Operation status (`success`, `failed`, `duplicate`)

**Description:** Total number of card generation operations

**Example:**
```
card_generation_total{mode="random",status="success"} 1250
card_generation_total{mode="sequential",status="success"} 300
card_generation_total{mode="batch_999",status="success"} 150
card_generation_total{mode="random",status="failed"} 5
card_generation_total{mode="random",status="duplicate"} 10
```

### 2. Card Generation Duration

**Metric:** `card_generation_duration_seconds`

**Type:** Histogram

**Labels:**
- `mode`: Generation mode (`random`, `sequential`, `batch_999`)

**Buckets:** `[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]`

**Description:** Duration of card generation operations in seconds

**Example:**
```
card_generation_duration_seconds_bucket{mode="random",le="0.05"} 1200
card_generation_duration_seconds_bucket{mode="random",le="0.1"} 1240
card_generation_duration_seconds_sum{mode="random"} 62.5
card_generation_duration_seconds_count{mode="random"} 1250
```

### 3. Cards Generated Gauge

**Metric:** `cards_generated_current`

**Type:** Gauge

**Labels:**
- `mode`: Generation mode (`random`, `sequential`, `batch_999`)

**Description:** Current number of cards generated (reset daily)

**Example:**
```
cards_generated_current{mode="random"} 1250
cards_generated_current{mode="sequential"} 300
cards_generated_current{mode="batch_999"} 150
```

### 4. Card Generation Duplicate Rate

**Metric:** `card_generation_duplicate_rate`

**Type:** Gauge

**Description:** Duplicate rate for card generation (0-1)

**Example:**
```
card_generation_duplicate_rate 0.008
```

### 5. Card Statistics Query Duration

**Metric:** `card_statistics_query_duration_seconds`

**Type:** Histogram

**Labels:**
- `query_type`: Query type (`realtime`, `by_date`, `by_bin`, `aggregated`)

**Buckets:** `[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2]`

**Description:** Duration of statistics queries in seconds

**Example:**
```
card_statistics_query_duration_seconds_bucket{query_type="realtime",le="0.1"} 950
card_statistics_query_duration_seconds_sum{query_type="realtime"} 45.2
card_statistics_query_duration_seconds_count{query_type="realtime"} 1000
```

### 6. Card Generation Cache Operations

**Metric:** `card_generation_cache_operations_total`

**Type:** Counter

**Labels:**
- `operation`: Operation type (`get`, `set`, `delete`)
- `result`: Operation result (`hit`, `miss`, `success`, `error`)

**Description:** Total cache operations for card generation

**Example:**
```
card_generation_cache_operations_total{operation="get",result="hit"} 8500
card_generation_cache_operations_total{operation="get",result="miss"} 1500
card_generation_cache_operations_total{operation="set",result="success"} 10000
```

### 7. Card Deduplication Operations

**Metric:** `card_deduplication_total`

**Type:** Counter

**Labels:**
- `result`: Deduplication result (`duplicate`, `unique`, `error`)

**Description:** Total deduplication checks

**Example:**
```
card_deduplication_total{result="unique"} 9950
card_deduplication_total{result="duplicate"} 50
card_deduplication_total{result="error"} 0
```

### 8. Card Deduplication Duration

**Metric:** `card_deduplication_duration_seconds`

**Type:** Histogram

**Labels:**
- `source`: Deduplication source (`cache`, `database`)

**Buckets:** `[0.001, 0.005, 0.01, 0.025, 0.05, 0.1]`

**Description:** Duration of deduplication checks in seconds

**Example:**
```
card_deduplication_duration_seconds_bucket{source="cache",le="0.001"} 8500
card_deduplication_duration_seconds_bucket{source="database",le="0.01"} 1500
```

### 9. Card Storage Operations

**Metric:** `card_storage_operations_total`

**Type:** Counter

**Labels:**
- `operation`: Operation type (`create`, `batch_create`)
- `result`: Operation result (`success`, `failed`, `duplicate`)

**Description:** Total card storage operations

**Example:**
```
card_storage_operations_total{operation="create",result="success"} 1000
card_storage_operations_total{operation="batch_create",result="success"} 50
card_storage_operations_total{operation="create",result="duplicate"} 5
```

### 10. Card Storage Duration

**Metric:** `card_storage_duration_seconds`

**Type:** Histogram

**Labels:**
- `operation`: Operation type (`create`, `batch_create`)

**Buckets:** `[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]`

**Description:** Duration of card storage operations in seconds

**Example:**
```
card_storage_duration_seconds_bucket{operation="create",le="0.05"} 950
card_storage_duration_seconds_sum{operation="create"} 45.2
card_storage_duration_seconds_count{operation="create"} 1000
```

### 11. Statistics Aggregation Duration

**Metric:** `statistics_aggregation_duration_seconds`

**Type:** Histogram

**Buckets:** `[1, 5, 10, 30, 60, 300, 600]`

**Description:** Duration of daily statistics aggregation in seconds

**Example:**
```
statistics_aggregation_duration_seconds_bucket{le="60"} 1
statistics_aggregation_duration_seconds_sum 45.2
statistics_aggregation_duration_seconds_count 1
```

### 12. Statistics Aggregation Status

**Metric:** `statistics_aggregation_status_total`

**Type:** Counter

**Labels:**
- `status`: Aggregation status (`started`, `completed`, `failed`)

**Description:** Statistics aggregation job status

**Example:**
```
statistics_aggregation_status_total{status="started"} 30
statistics_aggregation_status_total{status="completed"} 29
statistics_aggregation_status_total{status="failed"} 1
```

## PromQL Queries

### Generation Rate

```promql
# Cards generated per second
rate(card_generation_total{status="success"}[5m])

# Cards generated per minute by mode
rate(card_generation_total{status="success"}[1m]) * 60
```

### Success Rate

```promql
# Success rate
sum(rate(card_generation_total{status="success"}[5m])) / 
sum(rate(card_generation_total[5m]))
```

### Duplicate Rate

```promql
# Current duplicate rate
card_generation_duplicate_rate

# Duplicate rate from counter
sum(rate(card_generation_total{status="duplicate"}[5m])) / 
sum(rate(card_generation_total[5m]))
```

### Performance Metrics

```promql
# 95th percentile generation time
histogram_quantile(0.95, rate(card_generation_duration_seconds_bucket[5m]))

# Average generation time
rate(card_generation_duration_seconds_sum[5m]) / 
rate(card_generation_duration_seconds_count[5m])

# 99th percentile storage time
histogram_quantile(0.99, rate(card_storage_duration_seconds_bucket[5m]))
```

### Cache Performance

```promql
# Cache hit rate
sum(rate(card_generation_cache_operations_total{operation="get",result="hit"}[5m])) / 
sum(rate(card_generation_cache_operations_total{operation="get"}[5m]))

# Deduplication cache hit rate
sum(rate(card_deduplication_total{source="cache"}[5m])) / 
sum(rate(card_deduplication_total[5m]))
```

### Statistics Query Performance

```promql
# Average statistics query time
rate(card_statistics_query_duration_seconds_sum[5m]) / 
rate(card_statistics_query_duration_seconds_count[5m])

# 95th percentile by query type
histogram_quantile(0.95, rate(card_statistics_query_duration_seconds_bucket[5m]))
```

## Alert Rules

All alert rules are defined in `monitoring/alert_rules.yml`.

### Alert: HighCardGenerationFailureRate

**Severity:** Warning

**Condition:** Failure rate > 5% for 5 minutes

**Query:**
```promql
rate(card_generation_total{status="failed"}[5m]) / 
rate(card_generation_total[5m]) > 0.05
```

**Action:** Investigate generation failures, check logs

### Alert: HighCardGenerationDuplicateRate

**Severity:** Warning

**Condition:** Duplicate rate > 5% for 10 minutes

**Query:**
```promql
card_generation_duplicate_rate > 0.05
```

**Action:** Review deduplication logic, check cache performance

### Alert: VeryHighCardGenerationDuplicateRate

**Severity:** Critical

**Condition:** Duplicate rate > 10% for 5 minutes

**Query:**
```promql
card_generation_duplicate_rate > 0.10
```

**Action:** Immediate investigation required

### Alert: SlowCardGeneration

**Severity:** Warning

**Condition:** P95 generation time > 1s for 5 minutes

**Query:**
```promql
histogram_quantile(0.95, rate(card_generation_duration_seconds_bucket[5m])) > 1
```

**Action:** Check database performance, review generation logic

### Alert: VerySlowCardGeneration

**Severity:** Critical

**Condition:** P95 generation time > 2s for 3 minutes

**Query:**
```promql
histogram_quantile(0.95, rate(card_generation_duration_seconds_bucket[5m])) > 2
```

**Action:** Immediate performance investigation

### Alert: HighCardGenerationRate

**Severity:** Warning

**Condition:** Generation rate > 100 cards/second for 5 minutes

**Query:**
```promql
rate(card_generation_total[5m]) > 100
```

**Action:** Check for potential abuse, review rate limiting

### Alert: StatisticsAggregationFailed

**Severity:** Critical

**Condition:** Aggregation job failed

**Query:**
```promql
rate(statistics_aggregation_status_total{status="failed"}[1h]) > 0
```

**Action:** Check aggregation job logs, verify database connectivity

### Alert: StatisticsAggregationSlow

**Severity:** Warning

**Condition:** P95 aggregation time > 5 minutes

**Query:**
```promql
histogram_quantile(0.95, rate(statistics_aggregation_duration_seconds_bucket[1h])) > 300
```

**Action:** Optimize aggregation query, check database performance

### Alert: HighCardStorageFailureRate

**Severity:** Warning

**Condition:** Storage failure rate > 1% for 5 minutes

**Query:**
```promql
rate(card_storage_operations_total{result="failed"}[5m]) / 
rate(card_storage_operations_total[5m]) > 0.01
```

**Action:** Check database connectivity, review storage logic

### Alert: DeduplicationErrors

**Severity:** Warning

**Condition:** > 1 deduplication error/second for 5 minutes

**Query:**
```promql
rate(card_deduplication_total{result="error"}[5m]) > 1
```

**Action:** Check deduplication service, verify database connectivity

### Alert: SlowStatisticsQueries

**Severity:** Warning

**Condition:** P95 query time > 0.5s for 5 minutes

**Query:**
```promql
histogram_quantile(0.95, rate(card_statistics_query_duration_seconds_bucket[5m])) > 0.5
```

**Action:** Optimize statistics queries, check database indexes

## Grafana Dashboard Queries

### Generation Rate Panel

```promql
sum(rate(card_generation_total{status="success"}[5m])) by (mode)
```

### Success Rate Panel

```promql
sum(rate(card_generation_total{status="success"}[5m])) / 
sum(rate(card_generation_total[5m])) * 100
```

### Duplicate Rate Panel

```promql
card_generation_duplicate_rate * 100
```

### Generation Time Panel

```promql
histogram_quantile(0.95, rate(card_generation_duration_seconds_bucket[5m]))
```

### Cache Hit Rate Panel

```promql
sum(rate(card_generation_cache_operations_total{operation="get",result="hit"}[5m])) / 
sum(rate(card_generation_cache_operations_total{operation="get"}[5m])) * 100
```

## Integration with Alertmanager

Alerts are sent to Alertmanager configured in `monitoring/prometheus.yml`:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Alert Routing

Configure Alertmanager routes to send alerts to appropriate channels:
- **Critical**: PagerDuty, Slack #critical-alerts
- **Warning**: Slack #warnings, Email

## Daily Metrics Reset

The `cards_generated_current` gauge is reset daily at 00:00 UTC. This is handled by the daily aggregation job:

```typescript
// In card-statistics-aggregator.ts
import { resetCardsGeneratedGauge } from '../src/services/metrics';
resetCardsGeneratedGauge();
```

## Best Practices

1. **Monitor Key Metrics**
   - Generation rate
   - Success/failure rates
   - Duplicate rate
   - Performance (p95, p99)

2. **Set Up Dashboards**
   - Create Grafana dashboards for visual monitoring
   - Set up alerting rules
   - Track trends over time

3. **Review Alerts Regularly**
   - Tune alert thresholds based on actual usage
   - Review false positives
   - Update alert rules as system evolves

4. **Performance Optimization**
   - Use metrics to identify bottlenecks
   - Track improvements after optimizations
   - Monitor cache hit rates

## Troubleshooting

### Metrics Not Appearing

1. Check `/metrics` endpoint is accessible
2. Verify Prometheus is scraping the endpoint
3. Check metric names match alert rules
4. Verify labels are correct

### Alerts Not Firing

1. Check Prometheus is evaluating alert rules
2. Verify alert rule syntax is correct
3. Check Alertmanager is configured
4. Verify alert thresholds are appropriate

### High Cardinality

1. Limit label combinations
2. Use recording rules for complex queries
3. Aggregate metrics where possible
4. Monitor metric cardinality
