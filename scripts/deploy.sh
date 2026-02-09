#!/bin/bash
# Deployment script for Credit Card Generation Service
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Deploying to: $ENVIRONMENT"
echo "=========================================="

cd "$PROJECT_DIR"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
  export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Pre-deployment checks
echo "Running pre-deployment checks..."
npm run build || { echo "Build failed!"; exit 1; }

# Database migration
echo "Running database migrations..."
npm run migrate || { echo "Migration failed!"; exit 1; }

# Data migration (if needed)
if [ "$RUN_DATA_MIGRATION" = "true" ]; then
  echo "Running data migration..."
  npm run migrate:data || { echo "Data migration failed!"; exit 1; }
fi

# Stop existing services
echo "Stopping existing services..."
pm2 stop all || true

# Start services
echo "Starting services..."
pm2 start ecosystem.config.js --env $ENVIRONMENT || { echo "Failed to start services!"; exit 1; }

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Health check
echo "Running health checks..."
MAX_RETRIES=10
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f http://localhost:${API_PORT:-3000}/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Health check failed, retrying... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Health check failed after $MAX_RETRIES attempts!"
  exit 1
fi

# Post-deployment validation
echo "Running post-deployment validation..."
npm run validate:uniqueness || echo "⚠️  Uniqueness validation warning (non-fatal)"

echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
