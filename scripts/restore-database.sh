#!/bin/bash
# Database restore script
# Usage: ./scripts/restore-database.sh <backup_file>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 backups/backup_20240101_120000.dump"
  exit 1
fi

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
  export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

DB_NAME=${POSTGRES_DB:-payment_sandbox}
DB_USER=${POSTGRES_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "=========================================="
echo "Restoring database from backup"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"
echo "=========================================="

# Confirm restore
read -p "This will overwrite the current database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Stop application services
echo "Stopping application services..."
pm2 stop all || true

# Drop and recreate database
echo "Dropping existing database..."
PGPASSWORD=$POSTGRES_PASSWORD psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -c "DROP DATABASE IF EXISTS $DB_NAME;"

PGPASSWORD=$POSTGRES_PASSWORD psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
echo "Restoring from backup..."
if [[ "$BACKUP_FILE" == *.dump ]]; then
  # Custom format dump
  PGPASSWORD=$POSTGRES_PASSWORD pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v \
    "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *.sql.gz ]]; then
  # Compressed SQL dump
  gunzip -c "$BACKUP_FILE" | PGPASSWORD=$POSTGRES_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME"
elif [[ "$BACKUP_FILE" == *.sql ]]; then
  # SQL dump
  PGPASSWORD=$POSTGRES_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$BACKUP_FILE"
else
  echo "Error: Unsupported backup file format"
  exit 1
fi

# Start application services
echo "Starting application services..."
pm2 start ecosystem.config.js || true

echo "✅ Database restored successfully!"
