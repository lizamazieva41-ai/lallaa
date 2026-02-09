# Payment Sandbox API Specification

This document provides a comprehensive OpenAPI 3.0 specification for the Payment Instrument Sandbox Platform.

## Base Information

- **Base URL**: `http://localhost:8080/api/v1`
- **API Version**: v1
- **Content Type**: `application/json`
- **Authentication**: JWT Bearer Token or API Key

## Authentication

### Bearer Token Authentication

```http
Authorization: Bearer <access_token>
```

### API Key Authentication

```http
X-API-Key: <api_key>
```

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "meta": {
    "timestamp": "2026-01-23T10:30:00.000Z",
    "requestId": "req-abc123",
    "rateLimit": {
      "limit": 1000,
      "remaining": 999,
      "resetAt": "2026-01-23T10:31:00.000Z"
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error context (optional)
    }
  },
  "meta": {
    "timestamp": "2026-01-23T10:30:00.000Z",
    "requestId": "req-abc123"
  }
}
```

## Endpoints

### Authentication Endpoints

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "tier": "free",
      "emailVerified": false,
      "createdAt": "2026-01-23T10:30:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": 900
    }
  }
}
```

#### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <access_token>
```

#### Change Password
```http
POST /auth/change-password
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

#### Request Password Reset
```http
POST /auth/reset-password/request
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### Create API Key
```http
POST /auth/api-keys
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Production API Key",
  "permissions": {
    "endpoints": ["bin", "iban"],
    "methods": ["GET", "POST"]
  },
  "rateLimit": 1000,
  "ipWhitelist": ["192.168.1.100", "10.0.0.50"]
}
```

#### List API Keys
```http
GET /auth/api-keys
Authorization: Bearer <access_token>
```

#### Revoke API Key
```http
DELETE /auth/api-keys/{keyId}
Authorization: Bearer <access_token>
```

#### Rotate API Key
```http
POST /auth/api-keys/{keyId}/rotate
Authorization: Bearer <access_token>
```

### BIN Endpoints

#### Lookup BIN
```http
GET /bin/{bin}
Authorization: Bearer <access_token>
```

**Path Parameters:**
- `bin` (string, required): 6-8 digit BIN number

**Response:**
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
      "name": "United States",
      "emoji": "🇺🇸"
    },
    "card": {
      "type": "debit",
      "network": "visa",
      "brand": "Visa Classic"
    },
    "metadata": {
      "binRange": "453201-453209"
    }
  }
}
```

#### Search BINs
```http
GET /bin?country=US&network=visa&type=debit&limit=10&page=1
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `country` (string, optional): Filter by country code
- `network` (string, optional): Filter by card network
- `type` (string, optional): Filter by card type
- `limit` (number, optional): Maximum results per page (default: 50, max: 100)
- `page` (number, optional): Page number (default: 1)

#### Get BINs by Country
```http
GET /bin/country/{countryCode}
Authorization: Bearer <access_token>
```

#### Get BIN Statistics
```http
GET /bin/stats
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBINs": 150000,
    "activeBINs": 142000,
    "coverage": {
      "countries": 195,
      "networks": 8,
      "types": 4
    },
    "lastUpdated": "2026-01-23T00:00:00.000Z"
  }
}
```

#### Validate BIN Format
```http
POST /bin/validate
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "bin": "453201"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "bin": "453201",
    "length": 6,
    "format": "numeric"
  }
}
```

### IBAN Endpoints

#### Validate IBAN
```http
POST /iban/validate
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "iban": "DE89370400440532013000"
}
```

**Response:**
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
  }
}
```

#### Generate IBAN
```http
POST /iban/generate
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "countryCode": "DE",
  "bankCode": "37040044",
  "accountNumber": "0532013000",
  "format": true
}
```

#### Parse IBAN
```http
POST /iban/parse
Authorization: Bearer <access_token>
```

#### Batch Validate IBANs
```http
POST /iban/batch-validate
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "ibans": [
    "DE89370400440532013000",
    "FR7630006000011234567890189",
    "GB82WEST12345698765432"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "iban": "DE89370400440532013000",
        "isValid": true,
        "countryCode": "DE"
      }
    ],
    "summary": {
      "total": 3,
      "valid": 2,
      "invalid": 1,
      "validPercentage": "66.67"
    }
  }
}
```

#### Convert IBAN Format
```http
POST /iban/convert
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "iban": "DE89370400440532013000",
  "format": "human"
}
```

#### Generate Test IBAN
```http
GET /iban/test/{countryCode}
Authorization: Bearer <access_token>
```

### Country Endpoints

#### List All Countries
```http
GET /countries
Authorization: Bearer <access_token>
```

#### Get Country by Code
```http
GET /countries/{code}
Authorization: Bearer <access_token>
```

#### Get Continent List
```http
GET /countries/continent/list
Authorization: Bearer <access_token>
```

#### Get Countries by Continent
```http
GET /countries/continent/{continent}
Authorization: Bearer <access_token>
```

#### Get SEPA Countries
```http
GET /countries/sepa
Authorization: Bearer <access_token>
```

#### Get Currency List
```http
GET /countries/currencies
Authorization: Bearer <access_token>
```

#### Search Countries
```http
GET /countries/search?q=germany&limit=10
Authorization: Bearer <access_token>
```

### Admin Endpoints

All admin endpoints require:
1. Authentication with JWT or API key
2. User role must be 'admin'

#### Get Full BIN with Provenance
```http
GET /admin/bin/{bin}
Authorization: Bearer <admin_token>
```

**Response includes additional fields:**
```json
{
  "success": true,
  "data": {
    "bin": "41111111",
    "provenance": {
      "source": "binlist/data",
      "sourceVersion": "abc123def456",
      "importDate": "2026-01-10T08:00:00Z",
      "raw": {
        "bank": {
          "name": "Example Bank",
          "city": "New York"
        }
      }
    },
    "isActive": true,
    "createdAt": "2026-01-10T08:00:00Z",
    "updatedAt": "2026-01-15T10:00:00Z"
  }
}
```

#### Get BINs by Source
```http
GET /admin/bins/source?source=binlist/data
Authorization: Bearer <admin_token>
```

#### Get Source Quality Report
```http
GET /admin/reports/source-quality
Authorization: Bearer <admin_token>
```

#### Get ETL History
```http
GET /admin/etl/history?limit=50
Authorization: Bearer <admin_token>
```

#### Clear Cache
```http
POST /admin/cache/clear
Authorization: Bearer <admin_token>
```

#### Get Cache Statistics
```http
GET /admin/cache/stats
Authorization: Bearer <admin_token>
```

#### Flush Cache (ETL)
```http
POST /admin/cache/flush
X-Admin-Secret: <admin_secret>
```

## Error Codes

| Code | HTTP Status | Description |
|-------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request format or parameters are invalid |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

Rate limits are applied per user tier:

| Tier | Requests/Minute | Requests/Hour |
|-------|-----------------|----------------|
| Free | 100 | 6,000 |
| Basic | 500 | 30,000 |
| Premium | 2,000 | 120,000 |
| Enterprise | 10,000 | 600,000 |

Rate limit headers are included in all responses:

- `X-RateLimit-Limit`: Maximum requests allowed in current window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds until client can make another request (429 responses)

## Health Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T10:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "cache": "healthy"
  }
}
```

#### Readiness Probe
```http
GET /ready
```

#### Metrics Endpoint
```http
GET /metrics
```

Prometheus-compatible metrics for monitoring integration.

### Cards Endpoints

#### Generate Credit Cards
```http
GET /cards/generate?vendor={vendor}&count={count}
```

Generates test credit card numbers for specified vendor.

**Query Parameters:**
- `vendor` (required): Card vendor (visa, mastercard, amex, diners, discover, enroute, jcb, voyager)
- `count` (optional): Number of cards to generate (1-100, default: 1)

**Response:**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "cardNumber": "4532015112830366",
        "vendor": "visa",
        "brand": "Visa"
      }
    ],
    "vendor": "visa",
    "count": 1
  },
  "meta": {
    "timestamp": "2026-01-23T10:30:00.000Z",
    "requestId": "req-abc123"
  }
}
```

#### Get Supported Vendors
```http
GET /cards/vendors
```

Returns list of supported credit card vendors.

#### Get Payment Gateways
```http
GET /cards/gateways
```

Returns list of available payment gateways with test cards.

**Response:**
```json
{
  "success": true,
  "data": {
    "gateways": [
      {
        "id": 1,
        "name": "Stripe",
        "slug": "stripe",
        "docsUrl": "https://stripe.com/docs/testing",
        "isActive": true,
        "createdAt": "2026-01-23T10:00:00.000Z",
        "updatedAt": "2026-01-23T10:00:00.000Z"
      }
    ],
    "count": 8
  }
}
```

#### Get Gateway by Slug
```http
GET /cards/gateways/{slug}
```

Returns specific payment gateway information.

#### Get Gateway Test Cards
```http
GET /cards/gateways/{slug}/cards
```

Returns test cards for a specific gateway.

**Query Parameters:**
- `limit` (optional): Maximum number of cards to return (default: 50, max: 100)
- `offset` (optional): Number of cards to skip (default: 0)

#### Search Test Cards
```http
GET /cards/search
```

Searches test cards across all gateways with filters.

**Query Parameters:**
- `gatewaySlug` (optional): Filter by gateway slug
- `brand` (optional): Filter by card brand
- `expectedResult` (optional): Filter by expected result
- `is3dsEnrolled` (optional): Filter by 3DS enrollment (true/false)
- `cardType` (optional): Filter by card type (credit, debit, prepaid)
- `region` (optional): Filter by region
- `limit` (optional): Maximum number of cards to return (default: 50, max: 100)
- `offset` (optional): Number of cards to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "id": 1,
        "gatewayId": 1,
        "brand": "Visa",
        "pan": "453201******0366",
        "cvc": "123",
        "expiryHint": "any future date",
        "expectedResult": "success",
        "testScenario": "Standard successful charge",
        "is3dsEnrolled": false,
        "cardType": "credit",
        "gateway": {
          "id": 1,
          "name": "Stripe",
          "slug": "stripe"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

#### Get Cards Statistics
```http
GET /cards/statistics
```

Returns statistics about card generation and test cards.

**Response:**
```json
{
  "success": true,
  "data": {
    "cardGeneration": {
      "supportedVendors": ["visa", "mastercard", "amex"],
      "vendorCount": 8
    },
    "testCards": {
      "totalCards": 1500,
      "totalGateways": 8,
      "cardsByGateway": {
        "Stripe": 250,
        "Braintree": 180
      },
      "cardsByBrand": {
        "Visa": 600,
        "MasterCard": 450
      }
    }
  }
}
```

## SDK and Libraries

### JavaScript/TypeScript

```bash
npm install @bincheck/api-client
```

```typescript
import { BINCheckAPI } from '@bincheck/api-client';

const client = new BINCheckAPI({
  baseURL: 'https://api.bincheck.com/v1',
  apiKey: 'your-api-key'
});

const binInfo = await client.bin.lookup('453201');
```