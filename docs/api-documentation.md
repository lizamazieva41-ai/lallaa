# 📚 API Documentation

The Payment Sandbox API provides comprehensive documentation through multiple formats:

## 🚀 Interactive Documentation

### Swagger UI
**URL**: `http://localhost:3000/api-docs`

- Interactive API exploration
- Test endpoints directly from browser
- Authentication support with JWT tokens
- Request/response examples
- Error documentation

### ReDoc (Alternative)
**URL**: `http://localhost:3000/redoc`

- Clean, modern interface
- Three-panel layout
- Mobile responsive
- Schema visualization

## 📄 Static Documentation

### OpenAPI Specification
**URL**: `http://localhost:3000/openapi.json`

- Raw OpenAPI 3.0 specification
- Compatible with API documentation tools
- Machine-readable format

### API Info Endpoint
**URL**: `http://localhost:3000/api/info`

- Basic API information
- Available endpoints
- Authentication details

## 🔐 Authentication Setup

### Getting API Access

1. **Register for an account**
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password": "securePassword123",
       "firstName": "John",
       "lastName": "Doe"
     }'
   ```

2. **Login to get JWT token**
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password": "securePassword123"
     }'
   ```

3. **Use the token in Swagger UI**
   - Click "Authorize" button in Swagger UI
   - Enter: `Bearer YOUR_JWT_TOKEN`
   - Click "Authorize"

### API Key Authentication

For production use, generate API keys:
```bash
curl -X POST http://localhost:3000/api/v1/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "tier": "premium"
  }'
```

## 🧪 Testing the API

### Using Swagger UI
1. Navigate to `/api-docs`
2. Expand any endpoint
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"

### Using cURL Examples
Each endpoint in the documentation includes cURL examples:
```bash
# BIN Lookup Example
curl -X GET "http://localhost:3000/api/v1/bin/457173" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payment_sandbox

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m

# Server
PORT=3000
NODE_ENV=development
```

## 📊 API Endpoints Overview

### Authentication
- `POST /api/v1/auth/register` - Create new user
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - User logout

### Two-Factor Authentication
- `POST /api/v1/auth/2fa/setup` - Setup 2FA
- `POST /api/v1/auth/2fa/enable` - Enable 2FA
- `POST /api/v1/auth/2fa/disable` - Disable 2FA

### BIN Services
- `GET /api/v1/bin/{bin}` - Basic BIN lookup
- `GET /api/v1/bins/search` - Advanced BIN search
- `GET /api/v1/bins/countries/{code}` - BINs by country

### Payment Instruments
- `GET /api/v1/cards/generate` - Generate test cards
- `GET /api/v1/cards/vendors` - Get supported card vendors
- `GET /api/v1/cards/gateways` - Get payment gateway list
- `GET /api/v1/cards/gateways/{slug}` - Get payment gateway by slug
- `GET /api/v1/cards/gateways/{slug}/cards` - Get test cards for gateway
- `GET /api/v1/cards/search` - Search test cards
- `GET /api/v1/cards/statistics` - Get card statistics
- `POST /api/v1/iban/validate` - Validate IBAN
- `POST /api/v1/iban/generate` - Generate IBAN

### Admin (Requires Admin Role)
- `GET /api/v1/admin/bin/{bin}` - Full BIN with provenance
- `GET /api/v1/admin/bins/source` - BINs by data source
- `POST /api/v1/admin/cache/clear` - Clear cache

## 🔒 Rate Limiting

### Tier-Based Limits
- **Free**: 100 requests/hour
- **Basic**: 1,000 requests/hour
- **Premium**: 5,000 requests/hour
- **Enterprise**: Unlimited

### Headers
Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## ❌ Error Handling

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid BIN format. BIN must be 6-8 digits.",
    "details": {
      "field": "bin",
      "expected": "6-8 digits",
      "received": "12345"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Invalid request parameters
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## 🚀 Production Deployment

### Linux + PM2 Setup

#### Prerequisites
- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- PM2 process manager

#### Installation
```bash
# 1. Clone and install
git clone <repository-url>
cd payment-sandbox-api
npm ci

# 2. Setup environment
cp .env.example .env
# Edit .env with your production values

# 3. Run database migrations
npm run migrate

# 4. Build and deploy
npm run deploy  # This runs: npm ci && npm run build && npm run start:pm2
```

#### PM2 Management
```bash
# Check status
npm run status:pm2

# View logs
npm run logs:pm2

# Restart application
npm run restart:pm2

# Stop application
npm run stop:pm2
```

#### Server Setup
```bash
# Setup PM2 to start on boot (run once)
pm2 startup
pm2 save

# This ensures the app starts automatically after server reboot
```

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "database": "healthy",
    "rateLimiter": "active"
  },
  "metrics": {
    "uptime": 3600,
    "memory": {...}
  }
}
```

### Ready Check
```bash
curl http://localhost:3000/ready
```

Response:
```json
{
  "ready": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔧 Development

### Running Locally
```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Coverage report
npm run test:coverage
```

### Code Quality
```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Build project
npm run build
```

## 🆘 Support

### Documentation Issues
- Check OpenAPI specification: `/openapi.json`
- Verify endpoint paths and parameters
- Test with real API responses

### Common Problems

**CORS Errors**
```javascript
// Ensure CORS is configured for your frontend
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

**Authentication Failures**
```javascript
// Check JWT token format and expiration
const token = authHeader.split(' ')[1];
// Verify token is not expired
```

**Database Connection**
```javascript
// Verify DATABASE_URL format
// Check PostgreSQL is running
// Test connection with: npm run db:test
```

### Getting Help
- **Documentation**: [API Docs](https://docs.payment-sandbox.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/payment-sandbox-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/payment-sandbox-api/discussions)

---

**🚀 Ready to explore the API? Start with the interactive documentation at `/api-docs`!**