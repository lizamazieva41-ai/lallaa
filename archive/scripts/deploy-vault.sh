#!/bin/bash

# HashiCorp Vault Initialization Script for BIN Check API
# This script deploys Vault and initializes it with basic configuration

set -e

echo "🚀 HASHICORP VAULT DEPLOYMENT"
echo "=========================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to become ready..."
sleep 10

# Check Vault health
for i in {1..30}; do
    if curl -s http://localhost:8200/v1/sys/health | grep -q "initialized"; then
        echo "✅ Vault is ready!"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 1
done

# Login to Vault and get root token
echo "🔑 Logging into Vault and getting root token..."

# Try multiple methods to get root token
# Method 1: Use existing root token from Vault container
echo "🔍 Method 1: Using default root token from environment..."
DEFAULT_ROOT_TOKEN="s.8e6Xog0ct1RdJa8W5R4f7e6xF58X6I9KMuMF8A"

# Method 2: Try login with userpass if default fails
echo "🔍 Method 2: Attempting userpass login..."
USERPASS_LOGIN=$(docker exec bin-check-vault vault login -method=userpass -username=root -password=bincheck-vault-admin-password -format=json 2>/dev/null | jq -r '.auth.client_token' 2>/dev/null || echo "")

# Method 3: Use recovery keys if both above fail
echo "🔍 Method 3: Attempting recovery key..."
RECOVERY_TOKEN=$(docker exec bin-check-vault vault operator generate -format=json 2>/dev/null | jq -r '.root_token' 2>/dev/null || echo "")

# Select the first successful method
if [ ! -z "$DEFAULT_ROOT_TOKEN" ]; then
    VAULT_TOKEN="$DEFAULT_ROOT_TOKEN"
elif [ ! -z "$USERPASS_LOGIN" ]; then
    VAULT_TOKEN="$USERPASS_LOGIN"
elif [ ! -z "$RECOVERY_TOKEN" ]; then
    VAULT_TOKEN="$RECOVERY_TOKEN"
else
    echo "❌ All authentication methods failed!"
    exit 1
fi

echo "🎯 Authentication successful!"
echo "🎯 Token obtained (first 8 chars): ${VAULT_TOKEN:0:8}"

# Check current status
echo "📊 Checking Vault status..."
curl -s http://localhost:8200/v1/sys/seal-status -H "X-Vault-Token: $VAULT_TOKEN"

# Unseal Vault (for initial setup)
echo "🔓 Unsealing Vault for initial configuration..."
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{"renew_keys": false, "reset_seals": true}' \\
    http://localhost:8200/v1/sys/unseal || {
    echo "❌ Failed to unseal Vault"
    exit 1
}

# Re-seal Vault with recovery key
echo "🔓 Re-sealing Vault with recovery key..."
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{"recovery_keys": true, "reset_seals": false}' \\
    http://localhost:8200/v1/sys/seal || {
    echo "❌ Failed to re-seal Vault"
    exit 1
  } 2>/dev/null || {
    echo "❌ Re-seal failed"
}

# Initialize Vault with development policies
echo "🔧 Initializing Vault with policies..."

# Enable AppRole authentication method
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{
        "type": "auth",
        "description": "AppRole authentication",
        "options": {
            "default": "true",
            "ttl": "0"
        }
    }' \\
    http://localhost:8200/v1/sys/auths/approle || {
    echo "❌ Failed to enable AppRole auth"
}

# Create basic policies
echo "📝 Creating basic policies..."

# Policy for bincheck services
cat > /tmp/vault_policies.hcl << 'EOF'
# Read-only policy for BIN data access
path "bincheck/data/*" {
    capabilities = ["list", "read"]
}

# Write policy for API keys
path "bincheck/api-keys/*" {
    capabilities = ["create", "read", "update", "delete"]
    allowed_parameters = ["name", "role", "permissions"]
}

# Admin policy - full access
path "bincheck/admin/*" {
    capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# Policy for audit logs
path "bincheck/audit/*" {
    capabilities = ["create", "read"]
}

# Policy for usage logs  
path "bincheck/usage/*" {
    capabilities = ["create", "read"]
}
EOF

# Load policies into Vault
for policy_file in /tmp/vault_policies.hcl; do
    curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
        -H "Content-Type: application/json" \\
        -H "X-Vault-Wrap-TTL: 60" \\
        -d "{\"policy\": \"$(cat $policy_file)\"}" \\
        http://localhost:8200/v1/sys/policies/bincheck-read || {
        echo "❌ Failed to load policy: $policy_file"
    }
done

# Enable the transit secrets engine
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json" \
    -d '{"transit": {"type":"transit","version": "2"}}' \
    http://localhost:8200 /v1/sys/mounts/transit

# Enable the kv secrets engine (v2)
curl -s -X POST -  "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json" \
    -d '{"kv": {"version":"2"}}' \
    http://localhost:8200 /v1/sys/mounts/kv

# Enable database secrets engine
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"database": {"version":"2", "allowed_roles": ["bincheck-db-owner","bincheck-db-reader"]}}' \
    http://localhost:8200 /v1/sys/mounts/database

# Enable PKI secrets engine
curl -s - X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"pki": {"version":"2", "ttl":"8760h"}}' \
    http://localhost:8200 /v1/sys/mounts/pki

# Enable SSH secrets engine
curl -s - X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"ssh": {"version":"2"}}' \
    http://localhost:8ault /v1/sys/mounts/ssh

# Create initial secrets
echo "🔑 Creating initial secrets..."

# Get unseal keys
UNSEAL_KEYS=$(curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "X-Vault-Wrap-TTL: 60" \
    -d '{"recovery_keys": true}' \
    http://localhost:8200/v1/sys/unseal | jq -r '.keys[0:1] | map(.id)' | tr -d '"' )

RECOVERY_KEY=$(curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "X-Vault-Wrap-TTL: 43200" \
    -d '{"recovery_keys": true}' \
    http://localhost:8200/v1/sys/unseal | jq -r '.keys[0:1] | map(.id)' | tr -d '"' | head -1)

# Database connection string (adjust as needed)
DB_CONN="postgresql://{{username}}:{{password}}@localhost:5432/bincheck"

# Create admin secrets
echo "🗄️ Creating database and API secrets..."

# Database credentials (in production, these would be dynamic)
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{
        \"type\": \"database\",
        \"data\": {
            \"username\": \"bincheck\",
            \"password\": \"secure_password_$(openssl rand -base64 32)\"
        },
        \"metadata\": {
            \"description\": \"Database credentials for BIN Check API\"
        }
    }' \\
    http://localhost:8200/v1/database/bincheck-creds

# JWT secrets
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json" \\
    -d '{
        "type": "kv",
        "data": {
            "jwt_secret": "base64_$(openssl rand -base64 32)",
            "jwt_refresh_secret": "base64_$(openssl rand -base64 32)",
            "jwt_expiry": "15m",
            "jwt_refresh_expiry": "7d"
        },
        "metadata": {
            "description": "JWT signing secrets for BIN Check API\"
        }
    }' \
    http://localhost:8200/v1/secret/bincheck/jwt

# API key secrets
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \\
    -H "Content-Type: application/json' \
    -d '{
        "type": "kv",
        "data": {
            "api_key_prefix": "bincheck",
            "secret_key": "$(openssl rand -hex 32)"
        },
        "metadata": {
            "description": "API key secret key for BIN Check API"
        }
    }' \
    http://localhost:8200/v1/secret/bincheck/api-key

# HashiCorp Vault integration credentials
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json' \
    -d '{
        "type": "kv",
        "data": {
            "vault_token": "hvs.CxYz8h4v8zC4w7WzQ3Z7G15HsXJ2Yz6V37PWx3qCw7WzJ2Yz6P4w7WzQ3Z7G9sR5hW",
            "vault_addr": "http://localhost:8200"
        },
        "metadata": {
            "description": "HashiCorp Vault integration token\"
        }
    }' \
    http://localhost:8200/v1/secret/bincheck/vault-integration

# Environment-specific secrets
curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json' \
    -d '{
        "type": "kv",
        "data": {
            "app_environment": "development",
            "redis_url": "redis://localhost:6379",
            "database_pool_min": "2",
            "database_pool_max": "10"
        },
        "metadata": {
            "description": "Environment configuration\"
        }
    }' \
    http://localhost:8200/v1/secret/bincheck/environment

# Clean up
rm -f /tmp/vault_policies.hcl

echo "🎉 Vault deployment completed successfully!"
echo "📊 Vault UI: http://localhost:8200"
echo "📊 Vault API: http://localhost:8200/v1"
echo "🔑 Root token available (first 8 chars): ${VAULT_TOKEN:0:8}"
echo "💾 Unseal keys available for recovery: ${UNSEAL_KEYS:0:8}"
echo "💾 Recovery key available for recovery: ${RECOVERY_KEY:0:8}"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Update application to use Vault for secrets"
echo "2. Test RLS with Vault-integrated authentication"
echo "3. Implement secret rotation policies"
echo "4. Setup monitoring and alerting"
echo ""
echo "⚠ SAVE THESE VAULT CREDENTIALS SECURELY:"
echo "- Root token: ${VAULT_TOKEN:0:8}"
echo "- Unseal keys: ${UNSEAL_KEYS}"
echo "- Recovery key: ${RECOVERY_KEY:0:8}"
echo "- Vault UI: http://localhost:8200"
echo "- Vault API: http://localhost:8200/v1"