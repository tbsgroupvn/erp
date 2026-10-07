#!/usr/bin/env bash
# Nạp 4 tệp dump prod vào MariaDB diễn tập CỤC BỘ, rồi kiểm số dòng khớp
# `rowcounts_at_dump.tsv` cho các bảng có trong tệp đó.
#
# ⛔ KHÔNG copy dump vào repo, KHÔNG in dữ liệu dòng ra log (chỉ đếm/OK).
# Thứ tự nạp bắt buộc (schema_accounts_customer PHẢI trước 2 tệp *_nosecret
# vì 2 tệp đó chỉ có INSERT, không có CREATE TABLE):
#   1. core_money.sql.gz              (tự chứa CREATE TABLE + INSERT, 45 bảng)
#   2. schema_accounts_customer.sql.gz (CREATE TABLE tbl_accounts, tbl_customer)
#   3. tbl_accounts_nosecret.sql.gz    (INSERT, một số cột đã lược)
#   4. tbl_customer_nosecret.sql.gz    (INSERT, một số cột đã lược)
#
# Dùng: bash scripts/rehearsal/load-dump.sh

cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

[ -d "${DUMP_DIR}" ] || die "Không thấy thư mục dump: ${DUMP_DIR} (đặt REHEARSAL_DUMP_DIR nếu khác)."

docker ps --format '{{.Names}}' | grep -qx "${MARIADB_CONTAINER}" \
  || die "Container ${MARIADB_CONTAINER} chưa chạy — chạy start-mariadb.sh trước."

FILES_IN_ORDER=(
  "core_money.sql.gz"
  "schema_accounts_customer.sql.gz"
  "tbl_accounts_nosecret.sql.gz"
  "tbl_customer_nosecret.sql.gz"
)

for f in "${FILES_IN_ORDER[@]}"; do
  path="${DUMP_DIR}/${f}"
  [ -f "${path}" ] || die "Thiếu tệp dump: ${path}"
done

for f in "${FILES_IN_ORDER[@]}"; do
  path="${DUMP_DIR}/${f}"
  log "Nạp ${f}..."
  gunzip -c "${path}" | docker exec -i "${MARIADB_CONTAINER}" \
    mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" "${MARIADB_DB}" \
    || die "Nạp ${f} thất bại."
  log "  -> xong ${f}"
done

log "Nạp xong 4 tệp. Kiểm số dòng khớp rowcounts_at_dump.tsv..."

ROWCOUNTS_FILE="${DUMP_DIR}/rowcounts_at_dump.tsv"
[ -f "${ROWCOUNTS_FILE}" ] || die "Không thấy ${ROWCOUNTS_FILE}"

printf '%-24s %12s %12s %s\n' "table" "expected" "actual" "OK"
overall_ok=1
while IFS=$'\t' read -r table expected; do
  [ -z "${table}" ] && continue
  actual="$(docker exec "${MARIADB_CONTAINER}" mariadb -N -uroot -p"${MARIADB_ROOT_PASSWORD}" "${MARIADB_DB}" \
    -e "SELECT COUNT(*) FROM \`${table}\`;" 2>/dev/null | tr -d '[:space:]')"
  if [ "${actual}" = "${expected}" ]; then
    ok="OK"
  else
    ok="FAIL"
    overall_ok=0
  fi
  printf '%-24s %12s %12s %s\n' "${table}" "${expected}" "${actual:-ERR}" "${ok}"
done < "${ROWCOUNTS_FILE}"

if [ "${overall_ok}" -eq 1 ]; then
  log "Tất cả bảng khớp số dòng."
else
  die "Có bảng LỆCH số dòng so với rowcounts_at_dump.tsv — xem bảng ở trên."
fi
