# ============================================
# TBS ERP - HashiCorp Vault Configuration
# ============================================
#
# File-based storage for single-node deployment.
# For HA production, switch to Consul or Raft storage.

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 0
  # Self-signed certs should be generated for internal use:
  #   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  #     -keyout /vault/tls/vault-key.pem -out /vault/tls/vault-cert.pem
  tls_cert_file = "/vault/tls/vault-cert.pem"
  tls_key_file  = "/vault/tls/vault-key.pem"
}

api_addr = "https://vault:8200"

# Enable only for maintenance: ui = true
ui = false

# Disable mlock for Docker environments
disable_mlock = true

# Telemetry for Prometheus metrics
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname          = true
}

# Max lease TTL (30 days)
max_lease_ttl = "720h"

# Default lease TTL (1 hour)
default_lease_ttl = "1h"
