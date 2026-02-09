# API Policy for Source Version Exposure

## Overview

This document outlines the API policy regarding the exposure of `source_version` (provenance data) in API responses. The policy is designed to balance data transparency for internal operations with security and privacy considerations for external users.

## Policy Decision

**Decision:** `source_version` (and other provenance fields) will **NOT** be exposed in public API responses. These fields are only available through admin/audit endpoints.

### Rationale

1. **Security**: The `source_version` field typically contains commit SHAs or repository references that could reveal internal infrastructure details
2. **Privacy**: Some data sources may contain sensitive information that should not be traceable back to their origin in public responses
3. **API Stability**: Provenance fields are internal implementation details that may change without notice
4. **Reduced Payload**: Public responses are optimized for client consumption without internal metadata

## API Response Structure

### Public API (GET /api/v1/bin/:bin)

```json
{
  "success": true,
  "data": {
    "bin": "41111111",
    "bank": {
      "name": "Example Bank",
      "nameLocal": "Example Bank Local",
      "code": "BANK123"
    },
    "country": {
      "code": "US",
      "name": "United States",
      "emoji": "🇺🇸"
    },
    "card": {
      "type": "debit",
      "network": "visa",
      "brand": "Visa Classic"
    },
    "metadata": {
      "binRange": "411111-411119"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-abc123"
  }
}
```

### Admin API (GET /api/v1/admin/bin/:bin)

```json
{
  "success": true,
  "data": {
    "bin": "41111111",
    "bank": {
      "name": "Example Bank",
      "nameLocal": "Example Bank Local",
      "code": "BANK123"
    },
    "country": {
      "code": "US",
      "name": "United States"
    },
    "card": {
      "type": "debit",
      "network": "visa",
      "brand": "Visa Classic"
    },
    "metadata": {
      "binRange": "411111-411119"
    },
    "provenance": {
      "source": "binlist/data",
      "sourceVersion": "abc123def456",
      "importDate": "2024-01-10T08:00:00Z",
      "raw": {
        "bank": {
          "name": "Example Bank",
          "city": "New York"
        }
      }
    },
    "isActive": true,
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

## Available Endpoints

### Public Endpoints (No Provenance)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/bin/:bin` | Lookup BIN information |
| GET | `/api/v1/bin/search` | Search BINs with filters |
| GET | `/api/v1/bin/country/:countryCode` | Get BINs by country |
| GET | `/api/v1/bin/statistics` | Get BIN statistics |
| POST | `/api/v1/bin/validate` | Validate BIN format |

### Admin Endpoints (With Provenance)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/admin/bin/:bin` | Get full BIN with provenance | Admin |
| GET | `/api/v1/admin/bins/source` | Get BINs by source | Admin |
| GET | `/api/v1/admin/reports/source-quality` | Get data quality report | Admin |
| GET | `/api/v1/admin/etl/history` | Get ETL run history | Admin |
| POST | `/api/v1/admin/cache/clear` | Clear lookup cache | Admin |
| GET | `/api/v1/admin/cache/stats` | Get cache statistics | Admin |

## Provenance Fields

The following fields are stored in the database but only exposed via admin endpoints:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `source` | string | Data source identifier | `binlist/data` |
| `sourceVersion` | string | Source version/commit SHA | `abc123def456` |
| `importDate` | datetime | When the data was imported | `2024-01-10T08:00:00Z` |
| `raw` | JSON | Original raw data from source | `{...}` |

## Implementation

### Source Selection Priority

When multiple sources have data for the same BIN, the following priority order is used:

1. `binlist/data` (highest priority)
2. `venelinkochev/bin-list-data`
3. `aderyabin/bin_list`
4. `braintree/credit-card-type`
5. `others` (lowest priority)

This ensures that the most authoritative and up-to-date data is used for BIN lookups.

### Data Quality Tracking

The admin endpoint `/api/v1/admin/reports/source-quality` provides insights into:

- Total BINs per source
- Active BINs per source
- Last import date per source
- Data completeness percentage (presence of bank name, country, etc.)

## Access Control

Admin endpoints require:

1. **Authentication**: Valid JWT token or API key
2. **Authorization**: User role must be `admin`

Example of admin authentication:

```bash
curl -X GET /api/v1/admin/bin/41111111 \
  -H "Authorization: Bearer <admin_jwt_token>"
```

## Audit Logging

All admin endpoint access is logged for compliance and security purposes:

- Request timestamp
- Admin user ID
- BINs accessed
- Actions performed (cache clear, etc.)

## Migration Notes

When migrating from the previous version:

1. Existing `source`, `source_version`, and `import_date` columns were added to the `bins` table
2. The ETL pipeline now populates these fields during data import
3. Public API responses remain unchanged (no breaking changes)
4. New admin endpoints are available for provenance access

## Future Considerations

Potential future enhancements:

1. **Granular Permissions**: Allow specific users to access provenance for their own API keys
2. **Data Quality API**: Expose data quality metrics via public API for premium users
3. **Source Attribution**: Optional opt-in for clients to receive source information
4. **Audit Trail**: Enhanced audit logging for compliance requirements
