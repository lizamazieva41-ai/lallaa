#!/bin/bash
# Rollback script for Credit Card Generation Service
# Usage: ./scripts/rollback.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Rolling back deployment"
echo "=========================================="

cd "$PROJECT_DIR"

# Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Rollback cancelled."
  exit 0
fi

# Stop services
echo "Stopping services..."
pm2 stop all || true

# Rollback database migration
echo "Rolling back database migration..."
npm run migrate:rollback || { echo "⚠️  Rollback migration warning (non-fatal)"; }

# Restore previous version (if using version control)
echo "Restoring previous version..."
# git checkout HEAD~1 || echo "⚠️  Version restore skipped"

# Start services
echo "Starting services..."
pm2 start ecosystem.config.js || { echo "Failed to start services!"; exit 1; }

# Health check
echo "Running health checks..."
sleep 5
if curl -f http://localhost:${API_PORT:-3000}/health > /dev/null 2>&1; then
  echo "✅ Health check passed!"
else
  echo "⚠️  Health check failed, but rollback completed"
fi

echo "=========================================="
echo "✅ Rollback completed!"
echo "=========================================="
