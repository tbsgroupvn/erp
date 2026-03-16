#!/bin/bash
# Initialize MinIO buckets for TBS Drive
# Requires: MinIO running + mc (MinIO Client) installed

MC_ALIAS="tbsdev"
MINIO_URL="http://localhost:9000"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin123}"

echo "=== Initializing MinIO for TBS Drive ==="

# Add alias
mc alias set $MC_ALIAS $MINIO_URL $MINIO_USER $MINIO_PASS

# Create buckets
mc mb --ignore-existing $MC_ALIAS/tbs-drive
mc mb --ignore-existing $MC_ALIAS/tbs-chat
mc mb --ignore-existing $MC_ALIAS/tbs-media

# Set bucket policies (public read for media, private for drive/chat)
mc anonymous set download $MC_ALIAS/tbs-media

echo "=== MinIO buckets created ==="
echo "  tbs-drive  - Private (file storage)"
echo "  tbs-chat   - Private (chat attachments)"
echo "  tbs-media  - Public read (CMS media)"
