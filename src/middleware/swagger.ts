import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export function setupSwaggerDocumentation(app: express.Application): void {
  try {
    // Load OpenAPI specification
    const openApiPath = path.join(__dirname, '../../openapi.yaml');
    const openApiSpec = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

    // Swagger UI configuration
    const swaggerUiOptions = {
      customCss: `
        .swagger-ui .topbar { 
          display: none; 
          background: linear-gradient(to right, #2c3e50, #3498db);
        }
        .swagger-ui .info { 
          margin: 20px 0; 
          color: #2c3e50;
        }
        .swagger-ui .info .title {
          color: #3498db;
          font-size: 32px;
          font-weight: bold;
        }
        .swagger-ui .scheme-container {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 5px;
          margin: 10px 0;
        }
        .swagger-ui .opblock.opblock-post {
          border-color: #28a745;
          background: rgba(40, 167, 69, 0.1);
        }
        .swagger-ui .opblock.opblock-get {
          border-color: #007bff;
          background: rgba(0, 123, 255, 0.1);
        }
        .swagger-ui .opblock.opblock-delete {
          border-color: #dc3545;
          background: rgba(220, 53, 69, 0.1);
        }
        .swagger-ui .btn.authorize {
          background: #3498db;
          border-color: #2980b9;
        }
      `,
      customSiteTitle: 'Payment Sandbox API Documentation',
      customfavIcon: '/favicon.ico'
    };

    // Setup Swagger UI route
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(openApiSpec as any, swaggerUiOptions));

    // Raw OpenAPI spec endpoint
    app.get('/openapi.json', (req, res) => {
      try {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(openApiSpec);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'OPENAPI_LOAD_ERROR',
            message: 'Failed to load OpenAPI specification'
          }
        });
      }
    });

    // API info endpoint
    app.get('/api/info', (req, res) => {
      res.json({
        success: true,
        data: {
          name: 'Payment Sandbox API',
          version: '1.1.0',
          description: 'Comprehensive payment instrument testing API',
          endpoints: {
            documentation: '/api-docs',
            openapi: '/openapi.json',
            health: '/health',
            ready: '/ready',
            api: '/api'
          },
          authentication: {
            type: 'Bearer Token',
            description: 'JWT token obtained from /api/v1/auth/login'
          }
        }
      });
    });

    // Redoc documentation (alternative to Swagger UI)
    app.get('/redoc', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payment Sandbox API - ReDoc</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
            <style>
              body { margin: 0; padding: 0; }
              .redoc-container { height: 100vh; }
            </style>
          </head>
          <body>
            <redoc spec-url="/openapi.json" 
                   theme="{ 
                     colors: { primary: { main: '#3498db' } },
                     typography: { fontFamily: 'Montserrat, sans-serif' }
                   }"
                   expand-responses="200,201"
                   hide-hostname="true"
                   hide-download-button="false"
                   class="redoc-container">
            </redoc>
            <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
          </body>
        </html>
      `);
    });

    console.log('✅ Swagger UI documentation available at /api-docs');
    console.log('✅ ReDoc documentation available at /redoc');
    console.log('✅ OpenAPI specification available at /openapi.json');

  } catch (error) {
    console.error('❌ Failed to setup Swagger documentation:', error);
  }
}