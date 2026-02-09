# Vault main configuration
storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address = "0.0.0.0"
  port = 8200
  tls_disable = 1
  cluster_address = "https://0.0.0.0:8201"
}

api_addr = "https://0.0.0.0:8200"
cluster_addr = "https://0.0.0.0:8201"
ui = true

default_lease_ttl = "168h"
max_lease_ttl = "720h"

# Logging
log_level = "INFO"
log_format = "json"

# Disable mlock for systems without /dev/mem
disable_mlock = true

# Enable auto-unseal for production
auto_unseal = true

# Performance tuning
api_cache_use_lru = 1
plugin_directory = "/vault/plugins"

# Enable audit logging
audit_file = "/vault/logs/audit.log"

# Enable core secrets engine
secrets "transit" {
  file = true
  path = "/vault/data/transit/"
}