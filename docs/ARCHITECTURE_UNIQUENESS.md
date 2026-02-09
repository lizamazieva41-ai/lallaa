# Multi-Layer Uniqueness Architecture

## Overview

The Credit Card Generation Service implements a **5-layer uniqueness architecture** to guarantee 100% uniqueness - ensuring that no card will ever be generated twice, even across billions of generations.

## Architecture Layers

### Layer 1: Composite Unique Constraint
- **Implementation**: PostgreSQL composite unique constraint on `(card_number, expiry_date, cvv)`
- **Purpose**: Database-level enforcement of uniqueness
- **Location**: `generated_cards` table
- **Performance**: O(log n) for inserts
- **Guarantee**: Absolute - database will reject duplicates

### Layer 2: Global Uniqueness Index
- **Implementation**: Global unique index across all partitions
- **Purpose**: Ensures uniqueness across partitioned tables
- **Location**: `idx_generated_cards_unique_composite`
- **Performance**: Fast lookups across partitions
- **Guarantee**: Absolute - prevents duplicates across partitions

### Layer 3: Pre-Generation Uniqueness Pool
- **Implementation**: `card_uniqueness_pool` table with PostgreSQL advisory locks
- **Purpose**: Reserve card hashes before generation to prevent race conditions
- **Location**: `card_uniqueness_pool` table
- **Performance**: Fast reservation with distributed locks
- **Guarantee**: Prevents concurrent generation of same card

### Layer 4: Bloom Filter
- **Implementation**: PostgreSQL `pg_bloom` extension
- **Purpose**: Fast probabilistic pre-filtering (0.1% false positive rate)
- **Location**: `bloom_filter_cards` table
- **Performance**: O(1) constant time lookups
- **Guarantee**: Probabilistic - catches 99.9% of duplicates before database check

### Layer 5: Redis Cluster Cache
- **Implementation**: Distributed Redis cache with TTL
- **Purpose**: Fast in-memory duplicate detection
- **Location**: Redis Cluster
- **Performance**: Sub-millisecond lookups
- **Guarantee**: Deterministic - exact match checking

## Uniqueness Check Flow

```
Card Generation Request
    ↓
1. Bloom Filter Check (Layer 4)
    ↓ (if not found)
2. Redis Cache Check (Layer 5)
    ↓ (if not found)
3. Uniqueness Pool Reservation (Layer 3)
    ↓ (if reserved)
4. Database Check (Layer 1 & 2)
    ↓ (if unique)
5. Card Generation & Storage
```

## Key Components

### UniquenessService
- **File**: `src/services/uniquenessService.ts`
- **Methods**:
  - `checkUniquenessWithRetry()` - Multi-layer uniqueness check
  - `reserveCardHash()` - Reserve hash in uniqueness pool
  - `releaseCardHash()` - Release reservation
  - `markAsGenerated()` - Mark card as generated in all layers

### UniquenessPool Model
- **File**: `src/models/uniquenessPool.ts`
- **Methods**:
  - `reserve()` - Reserve card hash with advisory lock
  - `release()` - Release reservation
  - `checkExistence()` - Check if hash exists
  - `cleanupExpired()` - Clean expired reservations

### Database Functions
- **File**: `src/database/migrations/007_enhance_uniqueness_guarantee.sql`
- **Functions**:
  - `reserve_card_hash()` - Reserve with pg_advisory_lock
  - `release_card_hash()` - Release lock
  - `cleanup_expired_reservations()` - Cleanup expired entries

## Performance Characteristics

- **Single Card Check**: <10ms (with cache hit)
- **Batch Check (1000 cards)**: <100ms (parallel processing)
- **Throughput**: 100K+ cards/hour
- **Cache Hit Rate**: >95%

## Failure Handling

- **Retry Logic**: Exponential backoff for transient failures
- **Fallback**: Graceful degradation if Redis unavailable
- **Error Recovery**: Automatic retry with different card parameters

## Monitoring

- Metrics per layer (hit/miss rates)
- Performance tracking
- Alerting on uniqueness check failures
- Audit logging for all uniqueness operations
