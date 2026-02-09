# Operational Runbooks

## Overview

This document provides step-by-step procedures for common operational tasks and incident response.

## Table of Contents

1. [Uniqueness Check Failures](#uniqueness-check-failures)
2. [Redis Cluster Failures](#redis-cluster-failures)
3. [Job Queue Issues](#job-queue-issues)
4. [Performance Degradation](#performance-degradation)
5. [Database Migration Issues](#database-migration-issues)

## Uniqueness Check Failures

### Symptoms
- High rate of uniqueness check failures in logs
- Cards being rejected as duplicates incorrectly
- Uniqueness service errors in metrics

### Diagnosis

```bash
# Check uniqueness service logs
pm2 logs card-generation-worker | grep -i uniqueness

# Check uniqueness pool status
psql -U postgres -d payment_sandbox -c "SELECT COUNT(*) FROM card_uniqueness_pool;"

# Check bloom filter status
psql -U postgres -d payment_sandbox -c "SELECT * FROM bloom_filter_cards LIMIT 1;"
```

### Resolution Steps

1. **Check Redis connectivity**
   ```bash
   redis-cli ping
   # Or for cluster:
   redis-cli -c -h <node> ping
   ```

2. **Clean uniqueness pool**
   ```bash
   npm run uniqueness:cleanup
   ```

3. **Sync bloom filter**
   ```bash
   npm run bloom:sync
   ```

4. **Restart uniqueness service**
   ```bash
   pm2 restart card-generation-worker
   ```

5. **If issue persists, check database constraints**
   ```bash
   psql -U postgres -d payment_sandbox -c "\d generated_cards"
   ```

## Redis Cluster Failures

### Symptoms
- Cache operations failing
- Job queue not processing
- Rate limiting not working
- Connection errors in logs

### Diagnosis

```bash
# Check Redis cluster status
redis-cli -c cluster nodes

# Check Redis health
redis-cli ping

# Check application Redis connection
curl http://localhost:3000/health | jq '.redis'
```

### Resolution Steps

1. **Check Redis cluster nodes**
   ```bash
   redis-cli -c cluster info
   redis-cli -c cluster nodes
   ```

2. **If single node failure, failover**
   ```bash
   # Promote replica to master
   redis-cli -h <replica-node> cluster failover
   ```

3. **If complete cluster failure, restart**
   ```bash
   # Restart Redis nodes
   systemctl restart redis
   # Or Docker:
   docker-compose restart redis
   ```

4. **Restart application services**
   ```bash
   pm2 restart all
   ```

5. **Verify recovery**
   ```bash
   curl http://localhost:3000/health
   ```

## Job Queue Issues

### Symptoms
- Jobs stuck in queue
- Jobs not processing
- High job failure rate
- Worker process not running

### Diagnosis

```bash
# Check worker process
pm2 status card-generation-worker

# Check job queue status
curl http://localhost:3000/health | jq '.jobQueue'

# Check Redis for job queue
redis-cli keys "bull:*"
```

### Resolution Steps

1. **Check worker process**
   ```bash
   pm2 status
   pm2 logs card-generation-worker
   ```

2. **Restart worker if needed**
   ```bash
   pm2 restart card-generation-worker
   ```

3. **Check Redis connection**
   ```bash
   redis-cli ping
   ```

4. **Clear stuck jobs (if needed)**
   ```bash
   # Connect to Redis and clear stuck jobs
   redis-cli DEL "bull:card-generation:waiting"
   redis-cli DEL "bull:card-generation:active"
   ```

5. **Monitor job processing**
   ```bash
   pm2 logs card-generation-worker --lines 100
   ```

## Performance Degradation

### Symptoms
- Slow response times
- High database query times
- Low cache hit rates
- High connection pool usage

### Diagnosis

```bash
# Check metrics
curl http://localhost:3000/metrics | grep -E "(card_generation|cache|database)"

# Check database performance
psql -U postgres -d payment_sandbox -c "
  SELECT query, mean_exec_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;
"

# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hit_rate
```

### Resolution Steps

1. **Check cache performance**
   ```bash
   # Warm cache
   npm run cache:warm
   ```

2. **Check database connection pool**
   ```bash
   # Check pool stats in health endpoint
   curl http://localhost:3000/health | jq '.database.poolStats'
   ```

3. **Optimize slow queries**
   ```bash
   # Review slow query log
   tail -f /var/log/postgresql/postgresql.log | grep "duration:"
   ```

4. **Scale services if needed**
   ```bash
   # Increase PM2 instances
   pm2 scale payment-sandbox-api +2
   ```

5. **Monitor improvements**
   ```bash
   watch -n 5 'curl -s http://localhost:3000/metrics | grep -E "(duration|hit_rate)"'
   ```

## Database Migration Issues

### Symptoms
- Migration failures
- Database constraint errors
- Data integrity issues
- Application startup failures

### Diagnosis

```bash
# Check migration status
psql -U postgres -d payment_sandbox -c "
  SELECT * FROM schema_migrations 
  ORDER BY executed_at DESC 
  LIMIT 5;
"

# Check for constraint violations
psql -U postgres -d payment_sandbox -c "
  SELECT COUNT(*) FROM generated_cards 
  GROUP BY card_number, expiry_date, cvv 
  HAVING COUNT(*) > 1;
"
```

### Resolution Steps

1. **Check migration logs**
   ```bash
   tail -f logs/migration.log
   ```

2. **Verify database state**
   ```bash
   psql -U postgres -d payment_sandbox -c "\d generated_cards"
   psql -U postgres -d payment_sandbox -c "\d card_uniqueness_pool"
   ```

3. **Rollback if needed**
   ```bash
   npm run migrate:rollback
   ```

4. **Fix data issues**
   ```bash
   # Run data validation
   npm run validate:uniqueness
   ```

5. **Re-run migration**
   ```bash
   npm run migrate
   ```

## Emergency Contacts

- **On-Call Engineer**: [Contact Info]
- **Database Admin**: [Contact Info]
- **Infrastructure Team**: [Contact Info]

## Escalation Procedures

1. **Level 1**: Check logs and run diagnostics
2. **Level 2**: Apply standard resolution steps
3. **Level 3**: Escalate to on-call engineer
4. **Level 4**: Escalate to team lead/manager
