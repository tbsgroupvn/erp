#!/usr/bin/env bash
# Tạo CSDL Postgres diễn tập `tbs_rehearsal` TRONG container `tbs-pg-test`
# đã có sẵn (không đụng CSDL `tbs_test` dùng chung), rồi chạy
# `prisma migrate deploy` nhắm vào CSDL đó qua DATABASE_URL ghi đè.
#
# ⛔ KHÔNG bao giờ `migrate dev` / `migrate reset` / `db push` ở đây.
# ⛔ Luôn qua target-guard trước khi migrate — script TỰ DỪNG nếu chốt chặn
#    từ chối URL đích (vd trùng CSDL test, hoặc tên không kết thúc
#    `_rehearsal`).
#
# Dùng: bash scripts/rehearsal/setup-pg-rehearsal.sh

cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

REPO_ROOT="$(cd ../.. && pwd)"
REHEARSAL_DATABASE_URL="${REHEARSAL_DATABASE_URL:-postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_HOST_PORT}/${PG_REHEARSAL_DB}?schema=public}"

docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER}" \
  || die "Container ${PG_CONTAINER} chưa chạy. Container này phải có sẵn (test DB dùng chung) — không tự tạo ở đây."

log "Kiểm chốt an toàn (target-guard) cho URL đích..."
( cd "${REPO_ROOT}" && REHEARSAL_DATABASE_URL="${REHEARSAL_DATABASE_URL}" npx ts-node scripts/rehearsal/guard-check.ts ) \
  || die "target-guard TỪ CHỐI URL đích — DỪNG, không tạo/migrate gì cả."

log "Tạo CSDL ${PG_REHEARSAL_DB} trong container ${PG_CONTAINER} nếu chưa có (KHÔNG đụng tbs_test)..."
exists="$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${PG_REHEARSAL_DB}';")"
if [ "${exists}" = "1" ]; then
  log "CSDL ${PG_REHEARSAL_DB} đã tồn tại — bỏ qua CREATE DATABASE."
else
  docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -c "CREATE DATABASE ${PG_REHEARSAL_DB};" \
    || die "Tạo CSDL ${PG_REHEARSAL_DB} thất bại."
  log "Đã tạo CSDL ${PG_REHEARSAL_DB}."
fi

log "Chạy prisma migrate deploy nhắm CSDL diễn tập (DATABASE_URL ghi đè, KHÔNG đổi .env)..."
( cd "${REPO_ROOT}" && DATABASE_URL="${REHEARSAL_DATABASE_URL}" npx prisma migrate deploy ) \
  || die "prisma migrate deploy thất bại."

log "OK — CSDL diễn tập ${PG_REHEARSAL_DB} đã sẵn schema mới nhất."
