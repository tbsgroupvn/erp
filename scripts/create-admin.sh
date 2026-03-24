#!/bin/bash
# Usage: COMPOSE_PROJECT_NAME=erp ./scripts/create-admin.sh
# Container names follow docker-compose.ip.yml naming: ${COMPOSE_PROJECT_NAME}_backend, etc.
set -e

PROJECT=${COMPOSE_PROJECT_NAME:-erp}
DB_USER=${POSTGRES_USER:-erp_user}
DB_NAME=${POSTGRES_DB:-erp_db}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@nhaphangchinhngach.vn}

echo "Using project=$PROJECT, db_user=$DB_USER, db=$DB_NAME, email=$ADMIN_EMAIL"

# Step 1: Generate hash inside backend container
HASH=$(docker exec ${PROJECT}_backend node -e "require('bcrypt').hash('Admin@123',10).then(h=>process.stdout.write(h))")
echo "Hash generated: ${HASH:0:10}..."

# Step 2: Insert directly via psql
docker exec ${PROJECT}_postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO users (id, email, full_name, password_hash, role, branch, is_active, is_2fa_enabled, preferred_two_factor_method, created_at, updated_at)
VALUES ('admin-sys-001', '$ADMIN_EMAIL', 'System Admin', '$HASH', 'COO', 'HN', true, false, 'TOTP', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = '$HASH', updated_at = NOW();
"

# Step 3: Verify
docker exec ${PROJECT}_postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT email, role, is_active FROM users;"

echo "DONE - Login: $ADMIN_EMAIL / Admin@123"
