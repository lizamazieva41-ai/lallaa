# Database Migration Guide

## Overview

This guide covers database migration procedures for the BIN Check API v2.0.

## Migration Files

Migrations are located in `src/database/migrations/` and are executed in order:

1. `001_initial_schema.sql` - Initial schema
2. `010_performance_indexes.sql` - Performance indexes (Phase 3)

## Running Migrations

### Development

```bash
npm run migrate
```

### Production

```bash
npm run migrate:prod
```

## Migration Process

1. **Backup Database**
   ```bash
   pg_dump -U bincheck bincheck > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run Migrations**
   ```bash
   npm run migrate:prod
   ```

3. **Verify Migration**
   - Check migration status
   - Verify indexes created
   - Test queries

## Rollback

If migration fails:

1. Restore from backup
2. Investigate issue
3. Fix migration script
4. Re-run migration

## Performance Indexes

The `010_performance_indexes.sql` migration adds:

- Indexes on `bin` column (primary lookup)
- Indexes on `country_code`, `card_network`, `card_type`
- Composite indexes for common query patterns
- Partial indexes for active BINs

## Monitoring

After migration:

- Monitor query performance
- Check index usage: `scripts/database/analyzeQueries.ts`
- Review slow query logs
