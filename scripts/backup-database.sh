#!/bin/bash
# Database backup script
# Usage: ./scripts/backup-database.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
  export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

DB_NAME=${POSTGRES_DB:-payment_sandbox}
DB_USER=${POSTGRES_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Creating database backup"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_DIR/backup_$TIMESTAMP.sql"
echo "=========================================="

# Create backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  -f "$BACKUP_DIR/backup_$TIMESTAMP.dump"

# Also create SQL dump
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F p \
  -f "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Compress SQL dump
gzip "$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "✅ Backup created: $BACKUP_DIR/backup_$TIMESTAMP.dump"
echo "✅ SQL dump created: $BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "backup_*.dump" -mtime +30 -delete
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete

echo "✅ Old backups cleaned up"
