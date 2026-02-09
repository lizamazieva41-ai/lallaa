# Cache Configuration Guide

## Overview

The BIN Check API v2.0 uses a multi-tier caching system:

1. **Bloom Filter** - Negative cache (O(1) non-existent check)
2. **LRU Cache** - In-memory cache (10,000 entries, 24h TTL)
3. **Redis Cache** - Distributed cache (24h TTL)
4. **Database** - Persistent storage

## Configuration

### Bloom Filter

```typescript
// src/services/advancedCaching/bloomFilterService.ts
capacity: 1,000,000
errorRate: 0.01 (1%)
```

### LRU Cache

```typescript
// src/services/bin.ts
maxSize: 10,000 entries
TTL: 24 hours
```

### Redis Cache

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>
REDIS_TTL=86400  # 24 hours
```

## Cache Warming

Pre-load frequently accessed BINs:

```bash
npm run cache:warm -- --limit=1000
```

## Monitoring

Check cache metrics:

```bash
GET /api/v1/admin/cache/stats
```

## Troubleshooting

### Low Cache Hit Rate

1. Check cache size limits
2. Review TTL settings
3. Run cache warming script
4. Monitor access patterns

### High Memory Usage

1. Reduce LRU cache size
2. Adjust Bloom filter capacity
3. Review Redis memory limits

### Cache Invalidation

Clear all caches:

```bash
POST /api/v1/admin/cache/clear
```
