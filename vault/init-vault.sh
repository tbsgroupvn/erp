#!/bin/bash
# ============================================
# TBS ERP - Vault Initialization Script
# ============================================
#
# This script:
#   1. Initializes Vault (if not already initialized)
#   2. Unseals Vault
#   3. Enables KV v2 secrets engine
#   4. Stores initial secrets
#   5. Creates an AppRole for the backend service
#
# IMPORTANT: Run this script only ONCE after first deployment.
# Store the unseal keys and root token securely!
#
# Usage:
#   docker exec -it tbs_erp_vault_prod sh /vault/scripts/init-vault.sh
#
# Environment Variables (set before running):
#   VAULT_ADDR          - Vault address (default: http://127.0.0.1:8200)
#   JWT_SECRET          - JWT signing secret
#   JWT_REFRESH_SECRET  - JWT refresh token secret
#   POSTGRES_USER       - Database username
#   POSTGRES_PASSWORD   - Database password
#   FIELD_ENCRYPTION_KEY - Field-level encryption key
#   TWO_FA_ENCRYPTION_KEY - 2FA TOTP encryption key

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
export VAULT_ADDR

echo "============================================"
echo "TBS ERP - Vault Initialization"
echo "============================================"
echo "Vault Address: ${VAULT_ADDR}"
echo ""

# Check if Vault is already initialized
INIT_STATUS=$(vault status -format=json 2>/dev/null | jq -r '.initialized' 2>/dev/null || echo "unknown")

if [ "$INIT_STATUS" = "true" ]; then
  echo "[INFO] Vault is already initialized."
  echo "[INFO] If you need to re-initialize, delete /vault/data and restart."

  # Check if sealed
  SEALED=$(vault status -format=json 2>/dev/null | jq -r '.sealed' 2>/dev/null || echo "unknown")
  if [ "$SEALED" = "true" ]; then
    echo "[WARN] Vault is sealed. Please unseal manually with your unseal keys."
    echo "       vault operator unseal <key1>"
    echo "       vault operator unseal <key2>"
    echo "       vault operator unseal <key3>"
  else
    echo "[OK] Vault is initialized and unsealed."
  fi
  exit 0
fi

echo "[STEP 1/5] Initializing Vault..."
# Initialize with 5 key shares, 3 required to unseal
INIT_OUTPUT=$(vault operator init -key-shares=5 -key-threshold=3 -format=json)

# Extract unseal keys and root token
UNSEAL_KEY_1=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[0]')
UNSEAL_KEY_2=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[1]')
UNSEAL_KEY_3=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[2]')
UNSEAL_KEY_4=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[3]')
UNSEAL_KEY_5=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[4]')
ROOT_TOKEN=$(echo "$INIT_OUTPUT" | jq -r '.root_token')

VAULT_KEYS_FILE="/vault/data/vault-keys.json"

# Save keys to a secure file with restricted permissions
echo "$INIT_OUTPUT" > "$VAULT_KEYS_FILE"
chmod 600 "$VAULT_KEYS_FILE"

echo ""
echo "============================================"
echo "WARNING: Vault unseal keys and root token"
echo "have been saved to: ${VAULT_KEYS_FILE}"
echo "File permissions set to 600 (owner read/write only)."
echo ""
echo "CRITICAL: Move this file to a secure location"
echo "(e.g., offline storage, HSM, or Vault transit)"
echo "and DELETE it from the server immediately!"
echo "============================================"
echo ""

echo "[STEP 2/5] Unsealing Vault..."
vault operator unseal "$UNSEAL_KEY_1"
vault operator unseal "$UNSEAL_KEY_2"
vault operator unseal "$UNSEAL_KEY_3"

# Login with root token
export VAULT_TOKEN="$ROOT_TOKEN"

echo "[STEP 3/5] Enabling KV v2 secrets engine..."
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "[INFO] KV v2 already enabled at 'secret/'"

echo "[STEP 4/5] Storing initial secrets..."
vault kv put secret/tbs-erp \
  JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64)}" \
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -base64 64)}" \
  POSTGRES_USER="${POSTGRES_USER:-tbs_erp}" \
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}" \
  FIELD_ENCRYPTION_KEY="${FIELD_ENCRYPTION_KEY:-$(openssl rand -base64 48)}" \
  TWO_FA_ENCRYPTION_KEY="${TWO_FA_ENCRYPTION_KEY:-$(openssl rand -base64 48)}" \
  SENTRY_DSN="${SENTRY_DSN:-}"

echo "[OK] Secrets stored at secret/tbs-erp"

echo "[STEP 5/5] Creating AppRole for backend service..."

# Enable AppRole auth method
vault auth enable approle 2>/dev/null || echo "[INFO] AppRole auth already enabled"

# Create a policy for the backend service
vault policy write tbs-erp-backend - <<'POLICY'
# Read secrets for TBS ERP
path "secret/data/tbs-erp" {
  capabilities = ["read"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow looking up own token
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
POLICY

# Create the AppRole
vault write auth/approle/role/tbs-erp-backend \
  token_policies="tbs-erp-backend" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=720h \
  secret_id_num_uses=0

# Get the Role ID and Secret ID
ROLE_ID=$(vault read -format=json auth/approle/role/tbs-erp-backend/role-id | jq -r '.data.role_id')
SECRET_ID=$(vault write -format=json -f auth/approle/role/tbs-erp-backend/secret-id | jq -r '.data.secret_id')

APPROLE_KEYS_FILE="/vault/data/approle-credentials.json"

# Save AppRole credentials to a secure file
cat > "$APPROLE_KEYS_FILE" <<CREDS
{
  "role_id": "${ROLE_ID}",
  "secret_id": "${SECRET_ID}"
}
CREDS
chmod 600 "$APPROLE_KEYS_FILE"

echo ""
echo "============================================"
echo "AppRole credentials saved to: ${APPROLE_KEYS_FILE}"
echo "File permissions set to 600 (owner read/write only)."
echo ""
echo "CRITICAL: Retrieve these credentials and"
echo "configure your backend .env, then DELETE"
echo "this file from the server!"
echo ""
echo "To authenticate via AppRole:"
echo "  vault write auth/approle/login role_id=<ROLE_ID> secret_id=<SECRET_ID>"
echo ""
echo "============================================"
echo "Vault initialization complete!"
echo "============================================"
