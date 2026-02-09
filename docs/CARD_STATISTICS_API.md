# Card Generation Statistics API

## Overview

The Statistics API provides comprehensive analytics and reporting for card generation activities. It includes real-time statistics, historical data, and aggregated metrics.

## Base URL

```
/api/v1/cards/statistics
```

All endpoints require authentication (JWT token or API key).

## Endpoints

### 1. Get Real-Time Statistics

Get today's real-time statistics for card generation.

**Endpoint:** `GET /api/v1/cards/statistics`

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "totalGenerated": 1250,
      "totalUnique": 1245,
      "totalDuplicates": 5,
      "byMode": {
        "random": 800,
        "sequential": 300,
        "batch999": 150
      }
    },
    "topBins": [
      {"bin": "453212", "count": 450},
      {"bin": "512345", "count": 320}
    ],
    "topCountries": [
      {"countryCode": "US", "count": 600},
      {"countryCode": "GB", "count": 400}
    ],
    "topUsers": [
      {"userId": "user-123", "count": 200},
      {"userId": "user-456", "count": 150}
    ],
    "performance": {
      "avgResponseTime": 45.2,
      "p95ResponseTime": 120.5,
      "p99ResponseTime": 250.8,
      "totalRequests": 1250,
      "successRate": 99.2
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

### 2. Get Statistics by Date

Get statistics for a specific date.

**Endpoint:** `GET /api/v1/cards/statistics/:date`

**Parameters:**
- `date` (path) - Date in YYYY-MM-DD format

**Example:**
```bash
GET /api/v1/cards/statistics/2024-01-15
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2024-01-15",
    "totalGenerated": 5000,
    "totalUnique": 4950,
    "totalDuplicates": 50,
    "randomCount": 3000,
    "sequentialCount": 1500,
    "batch999Count": 500,
    "binsUsed": 25,
    "topBins": {
      "453212": 1200,
      "512345": 800
    },
    "countriesUsed": 15,
    "topCountries": {
      "US": 2500,
      "GB": 1500
    },
    "usersActive": 50,
    "topUsers": {
      "user-123": 500,
      "user-456": 400
    },
    "avgGenerationTimeMs": 42.5,
    "p95GenerationTimeMs": 115.0,
    "p99GenerationTimeMs": 240.0,
    "createdAt": "2024-01-16T00:00:00.000Z",
    "updatedAt": "2024-01-16T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid date format
- `404` - Statistics not found for date

### 3. Get Statistics by Date Range

Get statistics for multiple dates within a range.

**Endpoint:** `GET /api/v1/cards/statistics/range`

**Query Parameters:**
- `start` (required) - Start date (YYYY-MM-DD)
- `end` (required) - End date (YYYY-MM-DD)

**Example:**
```bash
GET /api/v1/cards/statistics/range?start=2024-01-01&end=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": [
      {
        "date": "2024-01-31",
        "totalGenerated": 5000,
        ...
      },
      {
        "date": "2024-01-30",
        "totalGenerated": 4800,
        ...
      }
    ],
    "count": 31,
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }
}
```

### 4. Get Aggregated Statistics

Get aggregated statistics across a date range (summed totals).

**Endpoint:** `GET /api/v1/cards/statistics/aggregated`

**Query Parameters:**
- `start` (required) - Start date (YYYY-MM-DD)
- `end` (required) - End date (YYYY-MM-DD)

**Example:**
```bash
GET /api/v1/cards/statistics/aggregated?start=2024-01-01&end=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalGenerated": 150000,
    "totalUnique": 148500,
    "totalDuplicates": 1500,
    "randomCount": 90000,
    "sequentialCount": 45000,
    "batch999Count": 15000,
    "avgGenerationTimeMs": 45.2,
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }
}
```

### 5. Get Latest Statistics

Get statistics for the last N days.

**Endpoint:** `GET /api/v1/cards/statistics/latest`

**Query Parameters:**
- `days` (optional) - Number of days (default: 30, max: 365)

**Example:**
```bash
GET /api/v1/cards/statistics/latest?days=7
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": [
      {
        "date": "2024-01-15",
        "totalGenerated": 5000,
        ...
      }
    ],
    "count": 7,
    "days": 7
  }
}
```

### 6. Get Statistics by BIN

Get statistics for a specific BIN.

**Endpoint:** `GET /api/v1/cards/statistics/bin/:bin`

**Parameters:**
- `bin` (path) - BIN code (6-8 digits)

**Example:**
```bash
GET /api/v1/cards/statistics/bin/453212
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bin": "453212",
    "totalGenerated": 5000,
    "byMode": {
      "random": 3000,
      "sequential": 1500,
      "batch999": 500
    },
    "byCountry": {
      "US": 3000,
      "GB": 2000
    },
    "uniqueCards": 4950
  }
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

**Common Error Codes:**
- `MISSING_DATE` - Date parameter required
- `INVALID_DATE` - Invalid date format
- `INVALID_RANGE` - Start date after end date
- `INVALID_BIN` - Invalid BIN format
- `INVALID_DAYS` - Days parameter out of range
- `STATS_NOT_FOUND` - Statistics not found
- `STATS_FAILED` - Internal server error

## Rate Limiting

All endpoints are rate-limited based on user tier:
- Free: 100 requests/hour
- Basic: 500 requests/hour
- Premium: 2000 requests/hour
- Enterprise: 10000 requests/hour

Rate limit headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## Usage Examples

### JavaScript/TypeScript

```typescript
// Get today's statistics
const response = await fetch('/api/v1/cards/statistics', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const data = await response.json();

// Get statistics for date range
const response = await fetch(
  '/api/v1/cards/statistics/range?start=2024-01-01&end=2024-01-31',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);

// Get statistics for specific BIN
const response = await fetch('/api/v1/cards/statistics/bin/453212', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### cURL

```bash
# Get real-time statistics
curl -X GET \
  'https://api.example.com/api/v1/cards/statistics' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get statistics by date
curl -X GET \
  'https://api.example.com/api/v1/cards/statistics/2024-01-15' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get aggregated statistics
curl -X GET \
  'https://api.example.com/api/v1/cards/statistics/aggregated?start=2024-01-01&end=2024-01-31' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

## Data Freshness

- **Real-time statistics**: Calculated on-demand from current day's data
- **Daily statistics**: Aggregated at 00:00 UTC each day
- **Historical statistics**: Available after daily aggregation runs

## Performance

- Real-time queries: < 100ms (p95)
- Historical queries: < 500ms (p95)
- Aggregated queries: < 1s (p95)

Query performance depends on:
- Date range size
- Number of partitions
- Database load

## Best Practices

1. **Cache Results**
   - Real-time stats change frequently (cache for 1-5 minutes)
   - Historical stats are static (cache for hours/days)

2. **Use Aggregated Endpoints**
   - For dashboards, use aggregated endpoints
   - Reduces number of API calls

3. **Pagination**
   - Date range queries return all matching dates
   - For large ranges, consider splitting into smaller chunks

4. **Error Handling**
   - Check for `STATS_NOT_FOUND` when querying specific dates
   - Statistics may not exist for future dates or very old dates

## Integration with Monitoring

Statistics can be integrated with monitoring systems:

1. **Prometheus**
   - Export key metrics from statistics API
   - Track generation rates, duplicate rates, performance

2. **Grafana Dashboards**
   - Create dashboards using statistics endpoints
   - Visualize trends and patterns

3. **Alerting**
   - Set up alerts based on statistics
   - Example: Alert if duplicate rate > 5%
