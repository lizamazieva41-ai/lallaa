# Deployment Guide: Credit Card Generation Architecture Upgrade

## Overview

This guide covers the deployment of the upgraded Credit Card Generation Service with 5-layer uniqueness architecture, async job processing, and multi-tier caching.

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ with `pg_bloom` extension
- Redis 7+ (single instance or cluster)
- PM2 (for process management)
- Docker & Docker Compose (optional)

## Pre-Deployment Checklist

- [ ] Database backup created
- [ ] Redis backup created (if applicable)
- [ ] Environment variables configured
- [ ] Dependencies installed (`npm install`)
- [ ] Database migrations tested on staging
- [ ] Rollback plan prepared

## Step 1: Database Migration

### 1.1 Run Database Migrations

```bash
# Run migrations in order
npm run migrate

# Or manually:
psql -U postgres -d payment_sandbox -f src/database/migrations/007_enhance_uniqueness_guarantee.sql
psql -U postgres -d payment_sandbox -f src/database/migrations/009_bloom_filter_integration.sql
```

### 1.2 Verify Migration

```bash
# Check uniqueness pool table exists
psql -U postgres -d payment_sandbox -c "\d card_uniqueness_pool"

# Check bloom filter extension
psql -U postgres -d payment_sandbox -c "SELECT * FROM pg_extension WHERE extname = 'pg_bloom';"
```

### 1.3 Populate Existing Data

```bash
# Populate uniqueness pool from existing cards
npm run migrate:data

# Sync bloom filter
npm run bloom:sync
```

## Step 2: Redis Setup

### 2.1 Single Redis Instance

```bash
# Start Redis
redis-server --port 6379

# Or using Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 2.2 Redis Cluster (Production)

```bash
# Create cluster configuration
# See Redis Cluster documentation for setup
# Configure in .env:
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

## Step 3: Application Deployment

### 3.1 Build Application

```bash
npm run build
```

### 3.2 Start Services with PM2

```bash
# Start API server and workers
npm run start:pm2

# Or manually:
pm2 start ecosystem.config.js --env production
```

### 3.3 Verify Services

```bash
# Check API health
curl http://localhost:3000/health

# Check PM2 status
pm2 status

# Check logs
pm2 logs payment-sandbox-api
pm2 logs card-generation-worker
```

## Step 4: Post-Deployment Validation

### 4.1 Health Checks

```bash
# Comprehensive health check
curl http://localhost:3000/health

# Readiness probe
curl http://localhost:3000/health/readiness

# Liveness probe
curl http://localhost:3000/health/liveness
```

### 4.2 Validate Uniqueness

```bash
# Run uniqueness validation
npm run validate:uniqueness
```

### 4.3 Performance Testing

```bash
# Run load tests
npm run load-test
```

## Step 5: Monitoring Setup

### 5.1 Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'payment-sandbox-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 5.2 Grafana Dashboards

Import dashboards for:
- Card generation performance
- Uniqueness metrics
- Cache performance
- Job queue status

## Rollback Procedure

### Emergency Rollback

```bash
# 1. Stop services
pm2 stop all

# 2. Rollback database migration
npm run migrate:rollback

# 3. Restore from backup if needed
# 4. Restart old version
```

## Configuration

### Environment Variables

Required new variables:

```env
# Redis Cluster
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=

# Bull Queue
BULL_QUEUE_CONCURRENCY=4
BULL_QUEUE_DEFAULT_ATTEMPTS=3
BULL_QUEUE_DEFAULT_TIMEOUT=30000

# Multi-tier Cache
MULTI_TIER_CACHE_LOCAL_SIZE=10000
MULTI_TIER_CACHE_LOCAL_TTL=3600000

# WebSocket
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=5000

# Uniqueness Service
UNIQUENESS_SERVICE_MAX_RETRIES=10
UNIQUENESS_SERVICE_RETRY_DELAY=100
```

## Maintenance

### Scheduled Tasks

```bash
# Add to crontab:
# Uniqueness pool cleanup (daily)
0 2 * * * cd /app && npm run uniqueness:cleanup

# Bloom filter sync (weekly)
0 3 * * 0 cd /app && npm run bloom:sync

# Cache warming (hourly)
0 * * * * cd /app && npm run cache:warm
```

## Troubleshooting

### Common Issues

1. **Uniqueness check failures**
   - Check Redis connectivity
   - Verify bloom filter extension
   - Check uniqueness pool cleanup

2. **Job queue not processing**
   - Verify worker process running
   - Check Redis connection
   - Review job queue logs

3. **Performance degradation**
   - Check cache hit rates
   - Monitor database query times
   - Review connection pool usage

## Support

For issues or questions, refer to:
- Architecture documentation: `docs/ARCHITECTURE_UNIQUENESS.md`
- API documentation: `docs/API_SPECIFICATION.md`
- Operational runbooks: `docs/OPERATIONAL_RUNBOOKS.md`
