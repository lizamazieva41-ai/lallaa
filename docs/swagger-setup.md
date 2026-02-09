# Swagger UI Setup for Payment Sandbox API

This directory contains the setup for interactive API documentation using Swagger UI.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install swagger-ui-express yamljs
```

### 2. Create Documentation Route

Add this to your main application file (`src/index.ts` or similar):

```typescript
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../openapi.yaml');
const openApiSpec = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

// Swagger UI route
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(openApiSpec));

// Raw OpenAPI spec
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});
```

### 3. Access Documentation

Once running, access the interactive documentation at:
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Raw Spec**: `http://localhost:3000/openapi.json`

## Production Deployment

### Linux + PM2 Setup

For production deployment on Linux with PM2, the Swagger documentation is automatically served by the application:

- **Swagger UI**: `http://your-domain.com/api-docs`  
- **Raw Spec**: `http://your-domain.com/openapi.json`

The documentation is built into the application and doesn't require separate deployment.

### Nginx Configuration

For production deployment behind Nginx:

```nginx
server {
    listen 80;
    server_name api.payment-sandbox.com;
    
    # Main API
    location /api/v1 {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API Documentation
    location /docs {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Raw OpenAPI spec
    location /openapi.json {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

## Customization

### Swagger UI Configuration

You can customize the Swagger UI appearance by adding configuration:

```typescript
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
  `,
  customSiteTitle: 'Payment Sandbox API Documentation',
  customfavIcon: '/favicon.ico'
};

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(openApiSpec, swaggerUiOptions));
```

### Authentication Examples

To include authentication examples in the documentation:

```yaml
# In openapi.yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Get a JWT token by logging in:
        ```
        POST /api/v1/auth/login
        {
          "email": "user@example.com",
          "password": "password"
        }
        ```
        
        Use the returned access token in the Authorization header:
        ```
        Authorization: Bearer <your-jwt-token>
        ```
```

## API Documentation Features

### Interactive Testing
- **Try it out**: Test endpoints directly from the documentation
- **Authentication**: Bearer token authentication support
- **Request/Response**: Full examples and schema validation

### Documentation Sections
1. **Authentication**: User login, registration, token management
2. **Two-Factor Auth**: 2FA setup and management
3. **BIN Services**: Bank identification number lookup
4. **Payment Instruments**: Card generation and IBAN validation
5. **Admin**: Administrative operations (requires admin role)

### Code Examples
The documentation includes code examples for:
- cURL commands
- JavaScript/Node.js
- Python
- PHP
- Ruby

### Rate Limiting Information
Each endpoint documents rate limiting behavior:
- Free tier: 100 requests/hour
- Basic tier: 1,000 requests/hour
- Premium tier: 5,000 requests/hour
- Enterprise: Unlimited

### Error Responses
Comprehensive error documentation includes:
- HTTP status codes
- Error response format
- Common error scenarios
- Troubleshooting guidance

## Monitoring and Analytics

### Usage Tracking
Track API documentation usage:

```typescript
// Middleware to track documentation access
app.use('/api-docs', (req, res, next) => {
  logger.info('API documentation accessed', {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });
  next();
});
```

### Feedback Collection
Add feedback mechanism:

```html
<!-- Custom HTML for feedback -->
<div id="api-feedback" style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
  <h4>API Documentation Feedback</h4>
  <p>Is this documentation helpful? <a href="#" onclick="sendFeedback('helpful')">👍</a> <a href="#" onclick="sendFeedback('not-helpful')">👎</a></p>
  <textarea id="feedback-text" placeholder="How can we improve this documentation?" style="width: 100%; height: 80px;"></textarea>
  <button onclick="submitFeedback()">Send Feedback</button>
</div>

<script>
function sendFeedback(type) {
  fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, page: window.location.pathname })
  });
}

function submitFeedback() {
  const text = document.getElementById('feedback-text').value;
  fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, page: window.location.pathname })
  });
  document.getElementById('api-feedback').innerHTML = '<p>Thank you for your feedback!</p>';
}
</script>
```

## Security Considerations

### Documentation Access
- Consider protecting sensitive endpoint documentation
- Implement authentication for admin-only endpoints documentation
- Rate limit documentation endpoints to prevent abuse

### CORS Configuration
```typescript
// Enable CORS for documentation in development
app.use('/api-docs', cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));
```

## Maintenance

### Keeping Documentation Updated
- Review OpenAPI spec after each API change
- Test all examples in Swagger UI
- Update custom branding and messaging
- Monitor documentation usage and feedback

### Versioning
For API versioning, maintain separate OpenAPI specs:
```
/api/v1/docs -> openapi-v1.yaml
/api/v2/docs -> openapi-v2.yaml
```

## Support

For issues with the API documentation:
- Check the OpenAPI specification for syntax errors
- Verify all endpoint paths and parameters
- Test with real API responses
- Review server logs for documentation errors