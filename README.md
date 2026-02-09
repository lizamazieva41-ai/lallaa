# BIN Check API

Backend API for BIN (Bank Identification Number) and IBAN (International Bank Account Number) validation and lookup services.

## Features

- **BIN Lookup**: Look up detailed information about bank identification numbers
- **IBAN Validation**: Validate IBANs using the MOD-97 algorithm and country-specific rules
- **IBAN Generation**: Generate valid IBANs for testing and development
- **Country Information**: Access country-specific banking information
- **User Authentication**: Secure JWT-based authentication with refresh tokens
- **API Key Management**: Create and manage API keys for programmatic access
- **Rate Limiting**: Configurable rate limits based on user tier
- **Comprehensive Logging**: Structured logging with request tracking
- **Observability**: Prometheus metrics endpoint (`/metrics`) for monitoring
- **Caching**: LRU in-memory cache with 24-hour TTL for fast lookups
- **ETL Pipeline**: Automated data import from multiple BIN data sources

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Caching**: Redis (optional), In-memory LRU
- **Testing**: Jest
- **Process Manager**: PM2
- **Monitoring**: Prometheus metrics

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 15+
- Redis 7+ (optional, for rate limiting)
- PM2

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Configure the environment variables in `.env`:

```env
# Application
NODE_ENV=development
API_PORT=8080
API_HOST=0.0.0.0

# Database
POSTGRES_USER=bincheck
POSTGRES_PASSWORD=bincheck_secret
POSTGRES_DB=bincheck
DB_PORT=5432
DB_HOST=localhost

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
SALT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_FREE=100
RATE_LIMIT_MAX_BASIC=500
RATE_LIMIT_MAX_PREMIUM=2000
RATE_LIMIT_MAX_ENTERPRISE=10000

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Session
SESSION_SECRET=your-session-secret-change-in-production

# API Keys
API_KEY_PREFIX=bincheck
API_KEY_BYTES=32

# Data
BIN_DATA_SOURCE=internal
IBAN_VALIDATION_STRICT=true

# ETL
ETL_DRY_RUN=false
ETL_SOURCES_DIR=./data/sources
API_URL=http://localhost:8080
ADMIN_SECRET=your-admin-secret-for-cache-flush
```

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run database migrations
npm run migrate

# Seed initial data
npm run seed

# Start development server
npm run dev
```

### Deployment

The application is managed in production using PM2. The `ecosystem.config.js` file contains the configuration for the application.

- **Start Application**:
  ```bash
  # Build the code first
  npm run build

  # Start the application in production mode
  npm start
  ```
  This command starts the application using the `ecosystem.config.js` configuration.

- **Managing the Application**:
  ```bash
  # Stop the application
  npm run stop

  # Restart the application
  npm run restart

  # Reload the application with 0-downtime
  npm run reload
  ```

- **Viewing Logs**:
  ```bash
  # View logs in real-time
  npm run logs
  ```

- **Startup on Server Boot**:
  To ensure the application automatically restarts when the server boots up, run the following commands:
  ```bash
  # Generate a startup script for the current platform
  pm2 startup

  # Save the current process list
  pm2 save
  ```
  The first command will provide you with a command that you need to run with superuser privileges.

## Observability

### Metrics Endpoint

The API exposes a Prometheus-compatible metrics endpoint at `/metrics`:

```bash
curl http://localhost:8080/metrics
```

#### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | method, route, status_code | HTTP request duration |
| `bin_lookup_total` | Counter | status | Total BIN lookups |
| `bin_lookup_duration_seconds` | Histogram | source | BIN lookup duration |
| `cache_operations_total` | Counter | operation, result | Cache hit/miss counts |
| `etl_job_total` | Counter | source, status | ETL job counts |
| `etl_job_duration_seconds` | Histogram | source | ETL job duration |
| `etl_records_processed_total` | Counter | source, stage | Records processed by ETL |
| `db_pool_active_connections` | Gauge | - | Database pool connections |
| `cache_size` | Gauge | - | Current cache size |

### Health Endpoints

- `GET /health` - Full health check with DB and Redis status
- `GET /ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

## ETL Pipeline

### Running ETL

```bash
# Production run (with cache flush)
npm run etl

# Dry run (no changes to database)
npm run etl -- --dry-run

# Process specific source only
npm run etl -- --source=binlist/data
```

### ETL Configuration

Environment variables for ETL:

```env
ETL_DRY_RUN=false          # Set to true for testing
ETL_SOURCES_DIR=./data/sources  # Directory containing source data
API_URL=http://localhost:8080   # API URL for cache flush
ADMIN_SECRET=your-secret         # Secret for cache flush endpoint
```

### Source Data Format

Expected directory structure:

```
data/sources/
├── binlist-data/
│   ├── data.json
│   └── LICENSE
├── bin-list-data/
│   └── data.csv
└── bin_list/
    └── data.yaml
```

### License Management

Before running ETL, ensure all data source licenses are collected:

```bash
# Collect licenses from data sources
./scripts/licenses/gather.sh

# Licenses will be saved to ./licenses/{source_name}.LICENSE
```

### Cache Invalidation

After successful ETL runs, the API cache is automatically flushed:

1. ETL completes data load
2. ETL calls `POST /api/v1/admin/cache/flush` with `X-Admin-Secret` header
3. Cache is cleared
4. Next lookup will fetch fresh data from database

Manual cache operations (admin only):

```bash
# Clear cache
curl -X POST http://localhost:8080/api/v1/admin/cache/clear \
  -H "Authorization: Bearer <admin_token>"

# Get cache stats
curl http://localhost:8080/api/v1/admin/cache/stats \
  -H "Authorization: Bearer <admin_token>"
```

## Backup and Restore

### Running Backups

```bash
# Interactive backup
./scripts/backup/daily_backup.sh

# Dry run (show what would be done)
./scripts/backup/daily_backup.sh --dry-run

# Keep last 14 backups and upload to S3
./scripts/backup/daily_backup.sh --keep 14 --upload

# With custom database credentials
DB_PASSWORD=secret ./scripts/backup/daily_backup.sh
```

### Scheduled Backups

Add to crontab for daily backups at 2 AM:

```bash
0 2 * * * /path/to/bin-check-pro-backend/scripts/backup/daily_backup.sh --keep 7 >> /var/log/backup.log 2>&1
```

### Restoring from Backup

```bash
# List available backups
ls -la backups/

# Restore specific backup
gunzip -c backups/bin_check_20240115_020000.sql.gz | PGPASSWORD=secret psql -U postgres -d bincheck
```

## API Documentation

### Base URL

```
http://localhost:8080/api/v1
```

### Authentication

All API endpoints require authentication via either:

1. **Bearer Token** (JWT):
   ```
   Authorization: Bearer <access_token>
   ```

2. **API Key**:
   ```
   X-API-Key: <api_key>
   ```

### Endpoints

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get current user |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/reset-password/request` | Request password reset email |
| POST | `/auth/api-keys` | Create a new API key |
| GET | `/auth/api-keys` | List all API keys for current user |
| DELETE | `/auth/api-keys/:keyId` | Revoke an API key |
| POST | `/auth/api-keys/:keyId/rotate` | Rotate (regenerate) an API key |

#### BIN Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bin/:bin` | Lookup BIN information |
| GET | `/bin` | Search BINs with filters |
| GET | `/bin/country/:countryCode` | Get BINs by country |
| GET | `/bin/stats` | Get BIN statistics |
| POST | `/bin/validate` | Validate BIN format |

**Note**: All BIN routes require authentication (no public access)

#### IBAN Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/iban/validate` | Validate IBAN |
| POST | `/iban/generate` | Generate valid IBAN |
| POST | `/iban/parse` | Parse IBAN components |
| POST | `/iban/batch-validate` | Batch validate IBANs |
| POST | `/iban/convert` | Convert IBAN between formats (human/machine readable) |
| GET | `/iban/test/:countryCode` | Generate test IBAN |

#### Country Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/countries` | List all countries |
| GET | `/countries/:code` | Get country details |
| GET | `/countries/continent/list` | Get list of continents |
| GET | `/countries/continent/:continent` | Get countries by continent |
| GET | `/countries/sepa` | List SEPA countries |
| GET | `/countries/currencies` | List currencies |
| GET | `/countries/search` | Search countries by name or code |

#### Admin Operations (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/bin/:bin` | Get full BIN with provenance |
| GET | `/admin/bins/source` | Get BINs by data source |
| GET | `/admin/reports/source-quality` | Data quality report |
| GET | `/admin/etl/history` | ETL run history |
| POST | `/admin/cache/clear` | Clear lookup cache (admin user action) |
| GET | `/admin/cache/stats` | Cache statistics |
| POST | `/admin/cache/flush` | Flush cache for ETL - requires X-Admin-Secret header |

### Example Requests

#### Lookup BIN

```bash
curl -X GET http://localhost:8080/api/v1/bin/453201 \
  -H "Authorization: Bearer <access_token>"
```

Response:
```json
{
  "success": true,
  "data": {
    "bin": "453201",
    "bank": {
      "name": "Example Bank",
      "nameLocal": "Example Bank Local",
      "code": "453201"
    },
    "country": {
      "code": "US",
      "name": "United States"
    },
    "card": {
      "type": "debit",
      "network": "visa"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid",
    "rateLimit": {
      "limit": 1000,
      "remaining": 999,
      "resetAt": "2024-01-01T00:01:00.000Z"
    }
  }
}
```

#### Validate IBAN

```bash
curl -X POST http://localhost:8080/api/v1/iban/validate \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"iban": "DE89370400440532013000"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "iban": "DE89370400440532013000",
    "countryCode": "DE",
    "checkDigits": "89",
    "bban": "370400440532013000",
    "bankCode": "37040044",
    "accountNumber": "0532013000",
    "formattedIban": "DE89 3704 0044 0532 0130 00"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

## Rate Limits

| Tier | Requests/minute |
|------|-----------------|
| Free | 100 |
| Basic | 500 |
| Premium | 2,000 |
| Enterprise | 10,000 |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Testing

```bash
# Run all tests with coverage
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

### Integration Tests

Integration tests require a running PostgreSQL database instance. Ensure your `.env` file is configured with correct database connection details.

```bash
# Run integration tests
npm run test:integration
```

### Test Structure

The test suite is organized as follows:

```
tests/
├── fixtures/           # Test data and mock files
│   └── etl/          # ETL-specific test data
├── integration/        # Integration tests
│   └── etl.test.ts   # ETL integration tests
├── setup.ts           # Test configuration and database setup
└── unit/             # Unit tests for individual components
    ├── bin.test.ts
    ├── iban.test.ts
    ├── etl-extract.test.ts
    └── etl-normalize.test.ts
```

### Current Test Status

The project includes comprehensive test coverage for:
- BIN service functionality and caching
- IBAN validation, generation, and parsing
- Database models and connections
- ETL pipeline components
- Authentication and authorization

**Note**: Some tests may require updates after recent TypeScript async/await changes in the IBAN service.

### Integration Tests

Integration tests require a running PostgreSQL database instance. Ensure your `.env` file is configured with the correct database connection details.

```bash
# Run integration tests
npm run test:integration
```

## CI/CD

The project is configured for CI/CD using GitHub Actions workflows. Currently, the project includes the infrastructure for automated testing and deployment but the actual workflow files need to be created.

### Planned CI/CD Pipeline

The intended pipeline includes:

- **CI Pipeline**: Lint → Test → Build → ETL Dry Run
- **Scheduled ETL**: Nightly ETL job for data updates
- **Automated Deployment**: Deploy to staging/production on merge to main

### Required GitHub Secrets

Configure these in GitHub repository secrets for full CI/CD functionality:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 backup |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `DATABASE_URL` | Production database connection string |
| `REDIS_URL` | Production Redis connection string |
| `JWT_SECRET` | Production JWT secret |
| `JWT_REFRESH_SECRET` | Production JWT refresh secret |

### Workflow Files

The following workflow files should be added to `.github/workflows/`:

- `ci.yml` - Continuous integration pipeline
- `deploy.yml` - Deployment automation
- `etl-schedule.yml` - Scheduled ETL jobs

## Project Structure

```
bin-check-api/
├── src/                    # Source code
│   ├── config/            # Configuration
│   ├── controllers/       # Request handlers
│   ├── database/          # Database connection, migrations, seeds
│   │   └── debug/        # SQL debug scripts (archived)
│   ├── middleware/        # Express middleware
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utilities
├── tests/                 # Test suite
│   ├── fixtures/          # Test data
│   ├── integration/       # Integration tests
│   └── unit/              # Unit tests
├── scripts/               # Essential scripts
│   ├── backup/            # Backup scripts
│   ├── etl/               # ETL pipeline
│   └── licenses/          # License collection
├── docs/                  # API documentation
├── data/                  # Seed data and test data
├── monitoring/            # Monitoring configuration
├── vault/                 # Vault configuration
├── archive/               # Archived files (old reports, configs)
│   ├── reports/           # Old analysis reports
│   ├── docker/            # Docker compose variants
│   ├── scripts/           # Framework scripts
│   ├── security-assessments/  # Security assessments
│   └── security-reports/  # Security reports
├── package.json
├── tsconfig.json
├── jest.config.js
├── ecosystem.config.js
├── Dockerfile
├── docker-compose.yml     # Main docker-compose file
├── openapi.yaml
├── README.md
├── CHANGELOG.md
├── LICENSE
├── CONTRIBUTING.md
└── AGENTS.md
```

### Archive Directory

The `archive/` directory contains old files that have been moved during project cleanup:
- **reports/**: Old analysis and project reports
- **docker/**: Docker compose configuration variants
- **scripts/**: Framework and deployment scripts
- **security-assessments/**: Security assessment documents
- **security-reports/**: Security scan reports

These files are kept for reference but are not part of the active project structure.

## License

MIT License
