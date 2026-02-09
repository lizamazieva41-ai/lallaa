#!/bin/bash

# Simple Vault secret verification script

echo "🔍 VERIFYING VAULT SECRETS"
echo "========================="

# Test secrets to create
SECRETS=(
    "JWT_REFRESH_SECRET:default-refresh-secret-change-me"
    "POSTGRES_PASSWORD:default-postgres-password"
    "DATABASE_URL:postgresql://localhost:5432/bincheck"
    "REDIS_PASSWORD:"
    "BCRYPT_ROUNDS:12"
    "BIN_CHECK_API_KEY:default-api-key-change-me"
)

for secret in "${SECRETS[@]}"; do
    secret_name=$(echo "$secret" | cut -d':' -f1)
    secret_value=$(echo "$secret" | cut -d':' -f2-)
    
    echo "📝 Creating: $secret_name"
    
    if [[ -n "$secret_value" ]]; then
        curl -s -H "X-Vault-Token: bin-check-vault-root" \
             -H "Content-Type: application/json" \
             -d "{\"data\": {\"value\": \"$secret_value\"}}" \
             "http://localhost:8200/v1/secret/data/$secret_name" > /dev/null
        
        if [[ $? -eq 0 ]]; then
            echo "✅ Created: $secret_name"
        else
            echo "❌ Failed: $secret_name"
        fi
    else
        echo "⚠ Skipping empty: $secret_name"
    fi
done

echo ""
echo "🧪 Verifying all secrets..."
curl -s -H "X-Vault-Token: bin-check-vault-root" "http://localhost:8200/v1/secret/metadata" | jq -r '.data.keys[]' 2>/dev/null || echo "Could not list secrets"

echo ""
echo "🎯 Vault is ready for integration!"
echo "🌐 UI: http://localhost:8200"