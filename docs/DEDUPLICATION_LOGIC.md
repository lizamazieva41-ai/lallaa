# Card Generation Deduplication Logic

## Overview

The deduplication system ensures that no duplicate cards are generated, even under high concurrency. It uses a multi-level approach combining in-memory caching and database constraints.

## Architecture

### Multi-Level Deduplication

```
┌─────────────────┐
│  API Request    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Card   │
│ Number          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Level 1: Cache  │─────▶│ LRU Cache    │
│ Check           │      │ (10K entries)│
└────────┬────────┘      └──────────────┘
         │
         │ Cache Miss
         ▼
┌─────────────────┐      ┌──────────────┐
│ Level 2: DB     │─────▶│ Database     │
│ Check           │      │ (card_hash)  │
└────────┬────────┘      └──────────────┘
         │
         │ Unique
         ▼
┌─────────────────┐
│ Save Card       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Mark in Cache   │
└─────────────────┘
```

## Hash Calculation

### Algorithm

Cards are deduplicated using a SHA-256 hash of the card number, expiry date, and CVV:

```typescript
function calculateCardHash(
  cardNumber: string,
  expiryDate: string,  // MM/YY format
  cvv: string
): string {
  const data = `${cardNumber}|${expiryDate}|${cvv}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

### Example

```typescript
const cardNumber = '4532123456789012';
const expiryDate = '12/25';
const cvv = '123';

const hash = calculateCardHash(cardNumber, expiryDate, cvv);
// Result: 'a1b2c3d4e5f6...' (64-character hex string)
```

### Why This Approach?

1. **Deterministic**: Same card details always produce same hash
2. **Collision-resistant**: SHA-256 provides strong collision resistance
3. **Non-reversible**: Cannot derive card details from hash
4. **Fast**: Hash calculation is O(1) operation

## LRU Cache

### Configuration

- **Size**: 10,000 entries (configurable)
- **TTL**: 1 hour (configurable)
- **Eviction**: Least Recently Used (LRU)

### Cache Structure

```typescript
Map<string, {
  exists: boolean;      // Whether card exists in database
  timestamp: number;    // Cache entry creation time
}>
```

### Cache Operations

1. **Get**: Check if hash exists in cache
   - If found and not expired: return cached result
   - If expired: remove from cache, return undefined

2. **Set**: Add hash to cache
   - If cache full: evict least recently used entry
   - Store hash with current timestamp

3. **Delete**: Remove hash from cache
   - Used when cache entry expires

### Cache Hit Rate

Expected cache hit rate: **>80%** for high-volume scenarios

**Factors affecting hit rate:**
- Request patterns (sequential vs random)
- Cache size
- TTL duration
- Traffic volume

## Database Check

### Unique Constraint

```sql
CREATE TABLE generated_cards (
  ...
  card_hash VARCHAR(64) NOT NULL UNIQUE,
  ...
);
```

### Check Query

```sql
SELECT 1 FROM generated_cards
WHERE card_hash = $1
LIMIT 1;
```

### Race Condition Handling

The unique constraint on `card_hash` prevents duplicates even in race conditions:

1. **Scenario**: Two requests generate same card simultaneously
2. **Process**:
   - Both check cache (miss)
   - Both check database (not found)
   - Both try to insert
   - One succeeds, one gets unique constraint violation
   - Error is caught and handled gracefully

## Deduplication Flow

### Single Card Generation

```typescript
async function generateAndSaveFromBIN(options) {
  // 1. Generate card
  const card = await generateFromBIN(options);
  
  // 2. Check for duplicates
  const dupCheck = await cardDeduplicationService.checkDuplicate(
    card.cardNumber,
    card.expiryDate,
    card.cvv
  );
  
  // 3. If duplicate, regenerate (max 3 attempts)
  if (dupCheck.isDuplicate) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const newCard = await generateFromBIN({
        ...options,
        sequential: false, // Force random
      });
      const newDupCheck = await cardDeduplicationService.checkDuplicate(
        newCard.cardNumber,
        newCard.expiryDate,
        newCard.cvv
      );
      if (!newDupCheck.isDuplicate) {
        card = newCard;
        break;
      }
    }
  }
  
  // 4. Save to database
  await generatedCardModel.create(cardInput);
  
  // 5. Mark in cache
  cardDeduplicationService.markAsGenerated(
    card.cardNumber,
    card.expiryDate,
    card.cvv
  );
}
```

### Batch Generation (999 cards)

```typescript
async function generateAndSave999CardsWithCVV(options) {
  // 1. Generate all 999 cards
  const cards = await generate999CardsWithCVV(options);
  
  // 2. Batch check for duplicates
  const dupChecks = await cardDeduplicationService.checkBatch(
    cards.map(c => ({
      cardNumber: c.cardNumber,
      expiryDate: c.expiryDate,
      cvv: c.cvv,
    }))
  );
  
  // 3. Filter out duplicates
  const uniqueCards = cards.filter((card, i) => !dupChecks[i].isDuplicate);
  
  // 4. Batch insert
  await generatedCardModel.createBatch(uniqueCards);
  
  // 5. Mark all in cache
  for (const card of uniqueCards) {
    cardDeduplicationService.markAsGenerated(
      card.cardNumber,
      card.expiryDate,
      card.cvv
    );
  }
}
```

## Performance

### Latency Impact

- **Cache hit**: < 1ms (in-memory lookup)
- **Cache miss + DB check**: 5-20ms (database query)
- **Hash calculation**: < 0.1ms (SHA-256)

### Throughput

- **With cache**: 10,000+ checks/second
- **Without cache**: 1,000-2,000 checks/second (database-limited)

### Optimization Tips

1. **Increase cache size** for high-volume scenarios
2. **Adjust TTL** based on generation patterns
3. **Use batch operations** to reduce round trips
4. **Monitor cache hit rate** and adjust accordingly

## Monitoring

### Key Metrics

1. **Cache Hit Rate**
   ```typescript
   const stats = cardDeduplicationService.getCacheStats();
   // { enabled: true, size: 8500, ttl: 3600000 }
   ```

2. **Duplicate Detection Rate**
   - Tracked in `card_generation_statistics.total_duplicates`
   - Should be < 1% for random generation
   - Higher for sequential generation

3. **Cache Performance**
   - Cache size (current entries)
   - Eviction rate
   - TTL expiration rate

### Queries

```sql
-- Duplicate rate by day
SELECT 
  date,
  total_generated,
  total_duplicates,
  ROUND(total_duplicates::numeric / NULLIF(total_generated, 0) * 100, 2) as duplicate_rate_pct
FROM card_generation_statistics
ORDER BY date DESC
LIMIT 30;

-- Duplicate cards (if needed for investigation)
SELECT 
  card_hash,
  COUNT(*) as count,
  array_agg(DISTINCT user_id) as users,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM generated_cards
GROUP BY card_hash
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

## Troubleshooting

### High Duplicate Rate

**Symptoms:**
- Many "duplicate detected" log messages
- High `total_duplicates` in statistics

**Causes:**
1. Sequential generation with same `startSequence`
2. Cache not working (disabled or full)
3. High concurrency generating same cards

**Solutions:**
1. Use random generation for high concurrency
2. Check cache status: `getCacheStats()`
3. Increase cache size if needed
4. Verify cache TTL is appropriate

### Cache Not Working

**Symptoms:**
- Low cache hit rate
- All checks go to database

**Causes:**
1. Cache disabled
2. Cache size too small
3. TTL too short
4. Memory issues

**Solutions:**
1. Verify cache is enabled: `getCacheStats().enabled`
2. Increase cache size
3. Adjust TTL
4. Check memory usage

### Database Performance Issues

**Symptoms:**
- Slow duplicate checks
- High database load

**Causes:**
1. Missing index on `card_hash`
2. High query volume
3. Database connection pool exhausted

**Solutions:**
1. Verify index exists: `idx_generated_cards_card_hash`
2. Increase cache size to reduce DB queries
3. Scale database or connection pool

## Configuration

### Environment Variables

```typescript
// Card deduplication cache configuration
CARD_DEDUP_CACHE_ENABLED=true
CARD_DEDUP_CACHE_SIZE=10000
CARD_DEDUP_CACHE_TTL=3600000  // 1 hour in milliseconds
```

### Service Initialization

```typescript
const cardDeduplicationService = new CardDeduplicationService({
  useCache: true,
  cacheSize: 10000,
  cacheTTL: 3600000, // 1 hour
});
```

## Best Practices

1. **Always check before generating**
   - Prevents wasted computation
   - Reduces database load

2. **Use batch operations**
   - Check multiple cards at once
   - Reduces round trips

3. **Monitor cache performance**
   - Track hit rate
   - Adjust size/TTL as needed

4. **Handle duplicates gracefully**
   - Regenerate if duplicate found
   - Log for monitoring

5. **Cache after successful save**
   - Mark cards in cache after insert
   - Prevents immediate duplicates
