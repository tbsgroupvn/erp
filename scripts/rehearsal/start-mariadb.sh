#!/usr/bin/env bash
# Khởi container MariaDB 10.11 CỤC BỘ cho diễn tập cutover L0.
# ⛔ Đây KHÔNG phải prod — không kết nối, không SSH tới prod ở đây.
#
# Container riêng tên `tbs-mariadb-rehearsal`, cổng riêng 3307 (không đụng
# cổng 3306 mặc định), sql_mode + charset/collation set trùng khớp thông số
# đo được trên prod 25/09/2026: MariaDB 10.11.16,
# sql_mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION, utf8mb4_general_ci.
#
# Dùng: bash scripts/rehearsal/start-mariadb.sh

cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

if docker ps -a --format '{{.Names}}' | grep -qx "${MARIADB_CONTAINER}"; then
  if docker ps --format '{{.Names}}' | grep -qx "${MARIADB_CONTAINER}"; then
    log "Container ${MARIADB_CONTAINER} đã chạy — bỏ qua khởi tạo."
  else
    log "Container ${MARIADB_CONTAINER} tồn tại nhưng đang dừng — start lại."
    docker start "${MARIADB_CONTAINER}" >/dev/null
  fi
else
  log "Tạo container ${MARIADB_CONTAINER} (image ${MARIADB_IMAGE}, cổng host ${MARIADB_HOST_PORT})..."
  docker run -d \
    --name "${MARIADB_CONTAINER}" \
    -p "${MARIADB_HOST_PORT}:3306" \
    -e MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD}" \
    -e MARIADB_DATABASE="${MARIADB_DB}" \
    "${MARIADB_IMAGE}" \
    --sql-mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_general_ci \
    >/dev/null
fi

log "Chờ MariaDB sẵn sàng (kiểm bằng truy vấn CÓ xác thực — `mariadb-admin ping` không đủ,"
log "  vì bước 'Securing system users' của entrypoint chạy SAU khi ping đã trả lời)..."
tries=0
until docker exec "${MARIADB_CONTAINER}" mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" -e "SELECT 1;" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "${tries}" -gt 60 ]; then
    die "MariaDB không sẵn sàng sau 60 lần thử (~2 phút)."
  fi
  sleep 2
done

log "MariaDB sẵn sàng. Kiểm sql_mode/charset/collation thực tế:"
docker exec "${MARIADB_CONTAINER}" mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" -e \
  "SELECT @@version AS version, @@sql_mode AS sql_mode, @@character_set_server AS charset, @@collation_server AS collation;"

log "OK — container ${MARIADB_CONTAINER} sẵn sàng trên host port ${MARIADB_HOST_PORT}."
