#!/bin/bash

#
# Daily Backup Script for BIN Check API
# Usage: ./scripts/backup/daily_backup.sh [options]
#
# Options:
#   --dry-run    Show what would be done without actually creating backups
#   --keep N     Keep only the last N backups (default: 7)
#   --upload     Upload backup to remote storage (S3 compatible)
#
# Environment Variables:
#   DB_HOST      Database host (default: localhost)
#   DB_PORT      Database port (default: 5432)
#   DB_USER      Database user (default: postgres)
#   DB_PASSWORD  Database password
#   DB_NAME      Database name (default: bin_check)
#   BACKUP_DIR   Local backup directory (default: ./backups)
#   S3_BUCKET    S3 bucket for remote backup storage
#   S3_PREFIX    S3 prefix/key prefix (default: backups/)
#   AWS_PROFILE  AWS CLI profile to use
#   GPG_RECIPIENT GPG recipient for encryption (optional)
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

# Default values
KEEP_BACKUPS=7
DRY_RUN=false
UPLOAD=false
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-bin_check}"
S3_PREFIX="${S3_PREFIX:-backups/}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

# Show usage information
usage() {
    cat << EOF
Daily Backup Script for BIN Check API

Usage: $0 [options]

Options:
    --dry-run       Show what would be done without actually creating backups
    --keep N        Keep only the last N backups (default: 7)
    --upload        Upload backup to remote storage (S3 compatible)
    --help          Show this help message

Environment Variables:
    DB_HOST         Database host (default: localhost)
    DB_PORT         Database port (default: 5432)
    DB_USER         Database user (default: postgres)
    DB_PASSWORD     Database password
    DB_NAME         Database name (default: bin_check)
    BACKUP_DIR      Local backup directory (default: ./backups)
    S3_BUCKET       S3 bucket for remote backup storage
    S3_PREFIX       S3 prefix/key prefix (default: backups/)
    AWS_PROFILE     AWS CLI profile to use
    GPG_RECIPIENT   GPG recipient for encryption (optional)

Examples:
    $0                          # Run backup locally
    $0 --dry-run                # Show what would be done
    $0 --keep 14 --upload       # Keep 14 days and upload to S3
    DB_PASSWORD=secret $0       # Use custom database password

EOF
    exit 0
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --keep)
                KEEP_BACKUPS="$2"
                shift 2
                ;;
            --upload)
                UPLOAD=true
                shift
                ;;
            --help|-h)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for required commands
    local missing_cmds=()

    if ! command -v pg_dump &> /dev/null; then
        missing_cmds+=("pg_dump")
    fi

    if ! command -v psql &> /dev/null; then
        missing_cmds+=("psql")
    fi

    if [ ${#missing_cmds[@]} -ne 0 ]; then
        log_error "Missing required commands: ${missing_cmds[*]}"
        log_info "Install PostgreSQL client tools to continue"
        exit 1
    fi

    # Check database connection
    if [ -z "${DB_PASSWORD:-}" ]; then
        log_warn "DB_PASSWORD not set, trying without password..."
    fi

    PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null || {
        log_error "Cannot connect to database. Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME."
        exit 1
    }

    log_success "Prerequisites check passed"
}

# Create backup directory
setup_backup_dir() {
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would create backup directory: $BACKUP_DIR"
        return
    fi

    mkdir -p "$BACKUP_DIR"
    log_info "Backup directory: $BACKUP_DIR"
}

# Create database backup
create_backup() {
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

    log_info "Creating database backup..."
    log_info "Backup file: $backup_file"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would create backup: $backup_file"
        return
    fi

    # Export schema and data with compression
    PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="${backup_file}.custom" \
        2>&1 | while read -r line; do
            echo -e "\r\033[K${BLUE}[pg_dump]${NC} $line"
        done

    # Also create a plain SQL backup for easy inspection
    PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --no-owner \
        --no-privileges \
        2>/dev/null | gzip > "$backup_file"

    # Create metadata file
    cat > "${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.meta.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "date": "$DATE_ONLY",
    "database": "$DB_NAME",
    "host": "$DB_HOST",
    "port": $DB_PORT,
    "backup_file": "${DB_NAME}_${TIMESTAMP}.sql.gz",
    "size_bytes": $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0"),
    "compression": "gzip",
    "version": "1.0"
}
EOF

    # Remove temporary custom format backup
    rm -f "${backup_file}.custom"

    local file_size=$(du -h "$backup_file" | cut -f1)
    log_success "Backup created successfully ($file_size)"
}

# Encrypt backup with GPG (optional)
encrypt_backup() {
    if [ -z "${GPG_RECIPIENT:-}" ]; then
        log_info "GPG_RECIPIENT not set, skipping encryption"
        return
    fi

    local backup_file="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
    local encrypted_file="${backup_file}.gpg"

    log_info "Encrypting backup with GPG..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would encrypt: $backup_file -> $encrypted_file"
        return
    fi

    gpg --batch --yes --recipient "$GPG_RECIPIENT" --encrypt "$backup_file"

    rm -f "$backup_file"
    log_success "Backup encrypted: $encrypted_file"
}

# Upload backup to S3
upload_to_s3() {
    if [ -z "${S3_BUCKET:-}" ]; then
        log_warn "S3_BUCKET not set, skipping upload"
        return
    fi

    log_info "Uploading backup to S3..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would upload to s3://${S3_BUCKET}/${S3_PREFIX}${DATE_ONLY}/"
        return
    fi

    # Create daily directory in S3
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}${DATE_ONLY}/"

    # Upload backup file
    aws s3 cp "${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz" "$s3_path" \
        --storage-class STANDARD_IA \
        || {
            log_error "Failed to upload backup to S3"
            return 1
        }

    # Upload metadata
    aws s3 cp "${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.meta.json" "$s3_path" \
        || {
            log_warn "Failed to upload metadata to S3"
        }

    log_success "Backup uploaded to $s3_path"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (keeping last $KEEP_BACKUPS)..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would remove old backup files from $BACKUP_DIR"
        return
    fi

    # Find and remove old backup files
    local count=0
    while IFS= read -r backup_file; do
        rm -f "$backup_file"
        ((count++))
    done < <(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | sort -r | tail -n +$((KEEP_BACKUPS + 1)))

    # Also clean up metadata files
    while IFS= read -r meta_file; do
        rm -f "$meta_file"
    done < <(find "$BACKUP_DIR" -name "${DB_NAME}_*.meta.json" -type f | sort -r | tail -n +$((KEEP_BACKUPS + 1)))

    # Clean up old S3 backups
    if [ -n "${S3_BUCKET:-}" ] && [ "$UPLOAD" = true ]; then
        local s3_prefix_path="s3://${S3_BUCKET}/${S3_PREFIX}"
        local old_backups=$(aws s3 ls "$s3_prefix_path" | grep '/' | head -n -$KEEP_BACKUPS | awk '{print $NF}' | sed 's/\/$//')

        for old_date in $old_backups; do
            log_info "Removing old S3 backup: $old_date"
            aws s3 rm "${s3_prefix_path}${old_date}/" --recursive
        done
    fi

    if [ $count -gt 0 ]; then
        log_success "Removed $count old backup(s)"
    else
        log_info "No old backups to remove"
    fi
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."

    local backup_file="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would verify: $backup_file"
        return
    fi

    # Check file exists and is readable
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    # Check gzip integrity
    if ! gzip -t "$backup_file" 2>/dev/null; then
        log_error "Backup file is corrupted: $backup_file"
        return 1
    fi

    # Check database restore (optional, can be slow)
    # gunzip -c "$backup_file" | PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d template1 &> /dev/null || {
    #     log_warn "Backup restore verification failed (this may be expected for production DB)"
    # }

    log_success "Backup integrity verified"
}

# Create symlink to latest backup
create_latest_symlink() {
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would create symlink: $BACKUP_DIR/latest -> ${DB_NAME}_${TIMESTAMP}.sql.gz"
        return
    fi

    local latest_link="${BACKUP_DIR}/latest"
    local backup_file="${DB_NAME}_${TIMESTAMP}.sql.gz"

    # Remove old symlink
    rm -f "$latest_link"

    # Create new symlink
    ln -s "$backup_file" "$latest_link"
    log_info "Latest backup symlink updated"
}

# Send notification (placeholder)
send_notification() {
    local status="$1"
    local message="$2"

    # TODO: Implement notification via Slack, email, etc.
    log_info "Notification [$status]: $message"
}

# Main function
main() {
    log_info "========================================"
    log_info "BIN Check API - Daily Backup"
    log_info "========================================"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Database: $DB_HOST:$DB_PORT/$DB_NAME"
    log_info "Backup Directory: $BACKUP_DIR"
    log_info "Dry Run: $DRY_RUN"
    log_info "Upload to S3: $UPLOAD"
    log_info "Keep Backups: $KEEP_BACKUPS"
    log_info "========================================"

    parse_args "$@"
    check_prerequisites
    setup_backup_dir
    create_backup
    encrypt_backup
    upload_to_s3
    cleanup_old_backups
    verify_backup
    create_latest_symlink

    log_success "Backup completed successfully!"
    log_info "========================================"

    send_notification "success" "Daily backup completed successfully"
}

main "$@"
