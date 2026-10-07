#!/usr/bin/env bash
# Hằng số + hàm dùng chung cho các script diễn tập L0.
# shellcheck disable=SC2034

set -euo pipefail

MARIADB_CONTAINER="tbs-mariadb-rehearsal"
MARIADB_IMAGE="mariadb:10.11"
MARIADB_HOST_PORT="3307"
MARIADB_ROOT_PASSWORD="rehearsal_local_only"
MARIADB_DB="sql_nhpcn"

PG_CONTAINER="tbs-pg-test"
PG_REHEARSAL_DB="tbs_rehearsal"
PG_HOST_PORT="5433"
PG_USER="postgres"
PG_PASSWORD="postgres"

# Thư mục dump — NGOÀI repo, không bao giờ copy vào trong repo.
# Mặc định dùng đường dẫn kiểu Git Bash (/f/...); ghi đè bằng biến môi
# trường REHEARSAL_DUMP_DIR nếu máy khác cấu trúc ổ đĩa.
DUMP_DIR="${REHEARSAL_DUMP_DIR:-/f/01_TBS_GROUP/_dump_20260925}"

# Thư mục kết quả diễn tập — NGOÀI repo (chứa số tiền thật, không commit).
REHEARSAL_OUT_DIR="${REHEARSAL_OUT_DIR:-/f/01_TBS_GROUP/_dump_20260925/rehearsal-out}"

log() {
  echo "[rehearsal] $*" >&2
}

die() {
  echo "[rehearsal] LỖI: $*" >&2
  exit 1
}
