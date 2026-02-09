# Redis Caching Layer

## Overview

The system uses Redis as a distributed caching layer to improve performance for BIN lookups and statistics queries. This provides a two-level caching strategy: in-memory LRU cache + Redis distributed cache.

## Architecture

### Two-Level Caching Strategy

```
┌─────────────┐
│ API Request │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│ Level 1:        │─────▶│ In-Memory    │
│ In-Memory Cache │      │ LRU Cache    │
└────────┬────────┘      └──────────────┘
         │
         │ Cache Miss
         ▼
┌─────────────────┐      ┌──────────────┐
│ Level 2:        │─────▶│ Redis Cache  │
│ Redis Cache     │      │ (Distributed)│
└────────┬────────┘      └──────────────┘
         │
         │ Cache Miss
         ▼
┌─────────────────┐
│ Database Query  │
└─────────────────┘
```

## Redis Cache Service

### Service Classes

**RedisCacheService** (`src/services/redisCache.ts`)
- Generic Redis caching service
- Supports get, set, delete, pattern deletion
- Configurable TTL and key prefixes

**Specialized Instances:**
- `binCacheService` - BIN lookups (24h TTL)
- `statisticsCacheService` - Statistics queries (5min-1h TTL)
- `cardGenerationCacheService` - Card generation data (1h TTL)

### Key Structure

```
{prefix}:{type}:{identifier}

Examples:
- bincheck:bin:lookup:453212
- bincheck:stats:realtime:today
- bincheck:stats:date:2024-01-15
- bincheck:stats:bin:453212
```

## BIN Lookup Caching

### Implementation

**Cache Key:** `bin:lookup:{normalizedBin}`
**TTL:** 24 hours (86400 seconds)

**Flow:**
1. Check in-memory LRU cache (fastest)
2. If miss, check Redis cache
3. If miss, query database
4. Store in both caches

**Code Example:**
```typescript
// In BINService.lookup()
const redisCacheKey = `lookup:${normalizedBin}`;
const redisResult = await binCacheService.get<BINLookupResult>(redisCacheKey);
if (redisResult.hit && redisResult.data) {
  // Cache hit - return immediately
  lookupCache.set(normalizedBin, redisResult.data); // Also store in-memory
  return redisResult.data;
}

// Cache miss - query database
const result = await binModel.lookup(normalizedBin);

// Store in both caches
lookupCache.set(normalizedBin, result);
await binCacheService.set(redisCacheKey, result, 86400);
```

### Cache Invalidation

**When to invalidate:**
- After ETL runs (new BIN data imported)
- When BIN data is manually updated
- Admin cache clear operation

**Methods:**
```typescript
// Clear all BIN caches
await binService.clearCache(); // Clears both in-memory and Redis

// Clear specific BIN
await binCacheService.delete(`lookup:${bin}`);
```

## Statistics Query Caching

### Cache Keys and TTLs

| Query Type | Cache Key | TTL | Reason |
|------------|-----------|-----|--------|
| Real-time stats | `realtime:today` | 5 minutes | Changes frequently |
| Stats by date | `date:YYYY-MM-DD` | 1 hour | Historical data is static |
| Stats by BIN | `bin:{bin}` | 15 minutes | May change as cards are generated |

### Implementation

**Real-Time Statistics:**
```typescript
// Check cache first
const cacheKey = 'realtime:today';
const cached = await statisticsCacheService.get<RealTimeStatistics>(cacheKey);
if (cached.hit && cached.data) {
  return cached.data;
}

// Calculate statistics
const result = await calculateRealTimeStats();

// Cache for 5 minutes
await statisticsCacheService.set(cacheKey, result, 300);
return result;
```

**Statistics by Date:**
```typescript
const dateStr = date.toISOString().split('T')[0];
const cacheKey = `date:${dateStr}`;
const cached = await statisticsCacheService.get(cacheKey);
if (cached.hit && cached.data) {
  return cached.data;
}

const result = await cardStatisticsModel.findByDate(date);
if (result) {
  await statisticsCacheService.set(cacheKey, result, 3600); // 1 hour
}
return result;
```

### Cache Invalidation

**Automatic Invalidation:**
- When daily statistics are calculated (invalidates date cache)
- Real-time cache expires naturally (5min TTL)

**Manual Invalidation:**
```typescript
// Invalidate specific date
await statisticsCacheService.delete(`date:2024-01-15`);

// Invalidate real-time cache
await statisticsCacheService.delete('realtime:today');

// Invalidate all statistics caches
await statisticsCacheService.deletePattern('stats:*`);
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Redis key prefix
REDIS_KEY_PREFIX=bincheck:
```

### Service Initialization

```typescript
// BIN cache (24h TTL)
export const binCacheService = new RedisCacheService({
  prefix: `${config.redis.keyPrefix}bin:`,
  ttl: 86400, // 24 hours
});

// Statistics cache (5min-1h TTL)
export const statisticsCacheService = new RedisCacheService({
  prefix: `${config.redis.keyPrefix}stats:`,
  ttl: 300, // 5 minutes default
});
```

## Performance Benefits

### Expected Improvements

| Operation | Without Cache | With In-Memory | With Redis | Improvement |
|-----------|---------------|----------------|------------|-------------|
| BIN lookup (cache hit) | 20-50ms | <1ms | <5ms | 10-50x faster |
| Statistics query (cache hit) | 100-500ms | N/A | <10ms | 10-50x faster |
| Cache hit rate | 0% | 60-80% | 80-95% | Higher hit rate |

### Cache Hit Rates

**Target Hit Rates:**
- BIN lookups: >90% (BINs don't change frequently)
- Real-time statistics: 70-80% (5min TTL)
- Historical statistics: >95% (1h TTL, static data)

## Monitoring

### Key Metrics

1. **Cache Hit Rate**
   ```typescript
   // Track cache hits/misses
   const stats = await binCacheService.getStats();
   ```

2. **Redis Performance**
   - Response time: <5ms (p95)
   - Connection pool usage
   - Memory usage

3. **Cache Size**
   - Number of keys per prefix
   - Memory usage per cache type

### Redis Commands for Monitoring

```bash
# Check Redis connection
redis-cli ping

# Get all BIN cache keys
redis-cli KEYS "bincheck:bin:*"

# Get cache statistics
redis-cli INFO stats

# Monitor commands in real-time
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory
```

## Error Handling

### Graceful Degradation

The system gracefully handles Redis unavailability:

1. **Redis Connection Failure**
   - Falls back to in-memory cache only
   - Logs warning but continues operation
   - No impact on core functionality

2. **Cache Set Failure**
   - Logs error but doesn't throw
   - Operation continues normally
   - Next request will query database

**Code Pattern:**
```typescript
try {
  await cacheService.set(key, value);
} catch (error) {
  logger.error('Cache set failed', { error, key });
  // Continue without caching
}
```

## Best Practices

### 1. TTL Selection

- **Short TTL (5-15min)**: Frequently changing data (real-time stats)
- **Medium TTL (1-6h)**: Moderately changing data (BIN stats)
- **Long TTL (24h+)**: Rarely changing data (BIN lookups)

### 2. Cache Key Design

- Use consistent naming conventions
- Include all relevant identifiers
- Avoid special characters
- Keep keys concise but descriptive

### 3. Cache Invalidation

- Invalidate on data updates
- Use pattern deletion for bulk invalidation
- Set appropriate TTLs to auto-expire stale data

### 4. Memory Management

- Monitor Redis memory usage
- Set maxmemory policy (e.g., `allkeys-lru`)
- Use appropriate TTLs to prevent unbounded growth

## Troubleshooting

### High Cache Miss Rate

**Symptoms:** Low cache hit rate, frequent database queries

**Causes:**
1. TTL too short
2. Cache being cleared too frequently
3. Redis connection issues

**Solutions:**
1. Increase TTL for stable data
2. Review cache invalidation logic
3. Check Redis connection and performance

### Redis Memory Issues

**Symptoms:** Redis running out of memory, OOM errors

**Causes:**
1. Too many cached keys
2. Large cache values
3. No TTL on some keys

**Solutions:**
1. Review and optimize cache keys
2. Compress large values if needed
3. Ensure all keys have TTL
4. Set maxmemory policy

### Slow Cache Operations

**Symptoms:** Redis operations taking >10ms

**Causes:**
1. Network latency
2. Redis server overload
3. Large values being cached

**Solutions:**
1. Use Redis on same network/data center
2. Scale Redis (cluster/replica)
3. Optimize cached data size
4. Use pipelining for batch operations

## Migration from In-Memory Only

### Before (In-Memory Only)
- Single server cache
- Lost on restart
- Not shared across instances

### After (Redis + In-Memory)
- Distributed cache
- Persists across restarts (if Redis persists)
- Shared across multiple instances
- Better hit rates

### Rollout Strategy

1. **Phase 1**: Deploy Redis cache alongside in-memory (both active)
2. **Phase 2**: Monitor cache hit rates and performance
3. **Phase 3**: Optimize TTLs based on usage patterns
4. **Phase 4**: Consider reducing in-memory cache size if Redis hit rate is high

## Future Enhancements

1. **Cache Warming**
   - Pre-populate cache with frequently accessed data
   - Run on application startup or scheduled jobs

2. **Cache Compression**
   - Compress large values before storing
   - Reduce memory usage

3. **Cache Analytics**
   - Track hit/miss rates per key pattern
   - Identify optimization opportunities

4. **Multi-Region Caching**
   - Redis cluster for global distribution
   - Regional cache replication
