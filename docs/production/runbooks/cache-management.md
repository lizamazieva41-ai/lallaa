# Cache Management Runbook

## Overview

This runbook covers cache management procedures.

## Cache Tiers

1. **Bloom Filter** - Negative cache
2. **LRU Cache** - In-memory (10,000 entries)
3. **Redis Cache** - Distributed cache
4. **Database** - Persistent storage

## Operations

### Clear All Caches

```bash
POST /api/v1/admin/cache/clear
```

### Warm Cache

```bash
npm run cache:warm -- --limit=1000
```

### Check Cache Stats

```bash
GET /api/v1/admin/cache/stats
```

## Maintenance

### Regular Tasks

1. **Daily**: Monitor cache hit rates
2. **Weekly**: Review cache metrics
3. **Monthly**: Analyze cache performance

### Cache Warming Schedule

- After ETL runs
- After deployments
- During off-peak hours

## Troubleshooting

### Low Hit Rate

1. Increase cache size
2. Adjust TTL settings
3. Warm cache more frequently

### High Memory Usage

1. Reduce cache sizes
2. Review TTL settings
3. Check for memory leaks
