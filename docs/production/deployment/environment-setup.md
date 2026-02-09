# Environment Setup Guide

## Overview

This guide covers the environment setup for the BIN Check API v2.0 in production.

## Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL 15.0 or higher
- Redis 7.0 or higher
- PM2 (for process management)

## Environment Variables

### Required Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1

# Database
DB_HOST=localhost
DB_PORT=5432
POSTGRES_USER=bincheck
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=bincheck

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# JWT
JWT_SECRET=<secure-secret>
JWT_REFRESH_SECRET=<secure-refresh-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Optional Variables

```bash
# Feature Flags
FEATURE_CARD_GENERATION=true
FEATURE_TEST_CARDS_ACCESS=false
FEATURE_ADMIN_PANEL=true

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# ETL
ETL_SOURCES_DIR=./data/sources
ETL_ENRICH_LIMIT=100
ETL_ENRICH_DELAY_MS=1000
```

## Installation Steps

1. **Install Dependencies**
   ```bash
   npm ci
   ```

2. **Build TypeScript**
   ```bash
   npm run build
   ```

3. **Run Database Migrations**
   ```bash
   npm run migrate:prod
   ```

4. **Seed Initial Data**
   ```bash
   npm run seed
   ```

5. **Start Application**
   ```bash
   npm run start:pm2
   ```

## Verification

- Health check: `GET /health`
- Metrics: `GET /metrics`
- API documentation: `GET /api/docs`
