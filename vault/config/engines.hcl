# Secret engines configuration for HashiCorp Vault

# Enable core secret engines
enable_kv_secret_engine_v2 = true
enable_transit_secret_engine = true
enable_database_secrets_engine = true
enable_pki_secret_engine = true
enable_ssh_signing_engine = true

# KV v2 secrets engine
kv {
  # Mount path for KV v2 secrets
  path = "secret/"
  # Version must be "v2" for new secrets engine
  version = "v2"
}

# Transit secrets engine
transit {
  # Mount path for transit secrets
  path = "transit/"
  
  # Enable auto-unseal for administrative operations
  auto_unseal = true
  
  # Default encryption key configuration
  # In production, create and use specific keys
  # For development, default key is sufficient
  transit_default_key_name = "bincheck-default-key"
  
  # Cache TTL (time-to-live) for encrypted values
  cache_ttl = "300s"
}

# Database secrets engine
database {
  # Mount path for database secrets
  path = "database/"
  
  # Enable database rotation
  allowed_roles = [
    "bincheck-db-owner",
    "bincheck-db-reader"
  ]
}

# PKI secrets engine
pki {
  # Mount path for PKI secrets
  path = "pki/"
  
  # Default TTL for certificates
  default_ttl = "8760h"
  
  # Max TTL for certificates (1 year)
  max_ttl = "87600h"
  
  # Allow certificate issuance without roles (development only)
  allowed_roles = [
    "bincheck-ca-admin"
  ]
}

# SSH signing secrets engine
ssh {
  # Mount path for SSH secrets
  path = "ssh/"
  
  # Generate keys with proper key type
  generate_signing_key = true
  
  # Default key types for SSH
  allowed_key_types = [
    "rsa",
    "ecdsa",
    "ed25519"
  ]
  
  # Key bits configuration
  default_key_bits = "2048"
  
  # Maximum allowed key bits for RSA keys
  max_key_bits = "4096"
}