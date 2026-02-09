#!/bin/bash

# HashiCorp Vault secrets migration script
# This script migrates secrets from environment variables to Vault

set -e

echo "🔄 MIGRATING SECRETS TO HASHICORP VAULT"
echo "========================================"

# Check if Vault is available
if ! docker exec bin-check-vault vault status >/dev/null 2>&1; then
    echo "❌ Vault is not running!"
    exit 1
fi

# Get Vault token (using existing token)
VAULT_TOKEN=$(docker exec bin-check-vault vault print token)

# Secrets to migrate from environment variables
declare -A SECRETS_TO_MIGRATE=(
    ["JWT_SECRET"]="${JWT_SECRET:-default-jwt-secret-change-me}"
    ["JWT_REFRESH_SECRET"]="${JWT_REFRESH_SECRET:-default-refresh-secret-change-me}"
    ["POSTGRES_PASSWORD"]="${POSTGRES_PASSWORD:-default-postgres-password}"
    ["DATABASE_URL"]="${DATABASE_URL:-postgresql://localhost:5432/bincheck}"
    ["REDIS_PASSWORD"]="${REDIS_PASSWORD:-}"
    ["BCRYPT_ROUNDS"]="${BCRYPT_ROUNDS:-12}"
    ["BIN_CHECK_API_KEY"]="${BIN_CHECK_API_KEY:-default-api-key-change-me}"
    ["BIN_CHECK_ADMIN_SECRET"]="${BIN_CHECK_ADMIN_SECRET:-default-admin-secret}"
)

# Function to create a secret in Vault
create_secret() {
    local path=$1
    local value=$2
    
    echo "📝 Creating secret: $path"
    
    curl -s -H "X-Vault-Token: bin-check-vault-root" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {\"value\": \"$value\"}}" \
        "http://localhost:8200/v1/secret/data/$path" || {
        echo "❌ Failed to create secret: $path"
        return 1
    }
    
    echo "✅ Created secret: $path"
    return 0
}

# Migrate each secret
migrated_count=0
failed_count=0

for secret_name in "${!SECRETS_TO_MIGRATE[@]}"; do
    secret_value="${SECRETS_TO_MIGRATE[$secret_name]}"
    
    # Skip if no value provided
    if [[ -z "$secret_value" ]]; then
        echo "⚠ Skipping empty secret: $secret_name"
        continue
    fi
    
    if create_secret "$secret_name" "$secret_value"; then
        ((migrated_count++))
    else
        ((failed_count++))
        echo "❌ Failed to migrate: $secret_name"
    fi
done

echo ""
echo "📊 MIGRATION SUMMARY"
echo "========================================"
echo "✅ Successfully migrated: $migrated_count secrets"
echo "❌ Failed to migrate: $failed_count secrets"
echo "📋 Total secrets processed: $(($migrated_count + $failed_count))"

# Create test secret to verify Vault operation
echo ""
echo "🧪 Testing Vault integration..."
create_secret "TEST_VAULT_INTEGRATION" "Vault integration test successful"

echo ""
echo "🔐 NEXT STEPS:"
echo "1. Update application configuration to use Vault"
echo "2. Test application with Vault secrets"
echo "3. Implement secret rotation policies"
echo "4. Setup monitoring and alerting"
echo ""
echo "💾 Vault Configuration:"
echo "   - UI: http://localhost:8200"
echo "   - API: http://localhost:8200/v1"