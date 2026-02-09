# Performance Problems Runbook

## Overview

This runbook covers procedures for addressing performance issues.

## Issue Types

### High Response Time

**Symptoms:**
- p95 response time > 50ms
- Slow API responses

**Actions:**
1. Check cache hit rate
2. Review database query performance
3. Check system load
4. Review slow query logs

### Low Cache Hit Rate

**Symptoms:**
- Cache hit rate < 95%
- High database load

**Actions:**
1. Warm cache: `npm run cache:warm`
2. Review cache TTL settings
3. Check cache size limits
4. Monitor access patterns

### Database Performance Issues

**Symptoms:**
- Slow queries
- Connection pool exhaustion

**Actions:**
1. Analyze queries: `scripts/database/analyzeQueries.ts`
2. Check index usage
3. Review connection pool settings
4. Optimize slow queries

### Memory Issues

**Symptoms:**
- High memory usage
- Out of memory errors

**Actions:**
1. Review cache sizes
2. Check for memory leaks
3. Adjust pool sizes
4. Monitor memory usage

## Diagnostic Tools

```bash
# Cache metrics
GET /api/v1/admin/cache/stats

# Database pool stats
GET /health

# Query analysis
npm run scripts/database/analyzeQueries.ts
```

## Optimization Checklist

- [ ] Cache hit rate > 95%
- [ ] p95 response time < 50ms
- [ ] Database queries optimized
- [ ] Indexes properly utilized
- [ ] Connection pool optimized
