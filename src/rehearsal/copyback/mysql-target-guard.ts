/**
 * Chốt ĐÍCH MySQL của công cụ chép ngược L13 (PG v2 → MySQL).
 *
 * ⛔ Lô L13 chỉ được ghi vào MariaDB DIỄN TẬP CỤC BỘ — container
 * `tbs-mariadb-rehearsal` (scripts/rehearsal/lib.sh), cổng host 3307, CSDL
 * `sql_nhpcn`. Chạy vào prod thật là quyết định Q-CUT-5 — KHÔNG có cờ/biến môi
 * trường nào mở chốt này (các hàm dưới chỉ nhận đúng các trường cần kiểm).
 *
 * Hai lớp:
 *  1. `assertMysqlRehearsalTarget` — TĨNH, trước khi mở kết nối: host phải là
 *     loopback (127.0.0.1/localhost), cổng đúng 3307, CSDL đúng `sql_nhpcn`.
 *     Tên CSDL prod CŨNG là `sql_nhpcn` ⇒ tên CSDL KHÔNG phân biệt được prod —
 *     vì thế cần lớp 2.
 *  2. `assertMysqlRehearsalServer` — LÚC CHẠY, sau khi kết nối, trước mọi ghi:
 *     `SELECT @@hostname` phải BẰNG hostname của container diễn tập đọc bằng
 *     `docker inspect` (`resolveRehearsalContainer`), hostname đó phải có dạng
 *     id docker 12 hex (container dựng bởi start-mariadb.sh không đặt --hostname).
 *     Chặn được cả trường hợp 127.0.0.1:3307 là một đường hầm SSH tới máy khác:
 *     máy bên kia trả @@hostname của nó, không trùng id container. Kèm: phải là
 *     MariaDB 10.11 và sql_mode có STRICT_TRANS_TABLES (không cắt dữ liệu im lặng).
 */
import { EtlSafeError } from '../etl/convert';

export const REHEARSAL_MYSQL = {
  container: 'tbs-mariadb-rehearsal',
  port: 3307,
  containerPort: '3306/tcp',
  database: 'sql_nhpcn',
} as const;

/** Máy prod đã biết (CLAUDE.md) — nêu tên riêng trong thông điệp để không ai nhầm. */
const KNOWN_PROD_HOSTS = new Set([
  '103.142.27.124',
  '180.93.136.224',
  'erp.nhaphangchinhngach.vn',
  'demo.taobaostore.vn',
  'order.taobaostore.vn',
]);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

export interface MysqlTargetConfig {
  host: string;
  port: number;
  database: string;
}

export function assertMysqlRehearsalTarget(cfg: MysqlTargetConfig): void {
  const host = String(cfg.host ?? '').trim().toLowerCase();
  if (KNOWN_PROD_HOSTS.has(host)) {
    throw new EtlSafeError(`mysql-target-guard: "${host}" là máy prod — TỪ CHỐI (L13 chỉ chép vào MariaDB diễn tập cục bộ).`);
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new EtlSafeError(`mysql-target-guard: host "${host}" không phải 127.0.0.1/localhost — TỪ CHỐI máy từ xa.`);
  }
  if (cfg.port !== REHEARSAL_MYSQL.port) {
    throw new EtlSafeError(
      `mysql-target-guard: cổng ${String(cfg.port)} ≠ ${REHEARSAL_MYSQL.port} (cổng MariaDB diễn tập) — TỪ CHỐI.`,
    );
  }
  if (cfg.database !== REHEARSAL_MYSQL.database) {
    throw new EtlSafeError(
      `mysql-target-guard: CSDL "${cfg.database}" ≠ "${REHEARSAL_MYSQL.database}" (CSDL nạp bởi load-dump.sh) — TỪ CHỐI.`,
    );
  }
}

export interface MysqlServerIdentity {
  /** SELECT @@hostname */
  hostname: string;
  /** SELECT @@version */
  version: string;
  /** SELECT @@sql_mode (phiên) */
  sqlMode: string;
  /** SELECT DATABASE() */
  database: string;
}

const DOCKER_ID_HOSTNAME = /^[0-9a-f]{12}$/;

export function assertMysqlRehearsalServer(actual: MysqlServerIdentity, containerHostname: string): void {
  if (!DOCKER_ID_HOSTNAME.test(containerHostname)) {
    throw new EtlSafeError(
      'mysql-target-guard: hostname container diễn tập không phải id docker 12 hex — không xác minh được đích, TỪ CHỐI.',
    );
  }
  if (actual.hostname !== containerHostname) {
    throw new EtlSafeError(
      `mysql-target-guard: @@hostname "${actual.hostname}" ≠ hostname container ${REHEARSAL_MYSQL.container} — máy trả lời KHÔNG phải MariaDB diễn tập, TỪ CHỐI.`,
    );
  }
  if (!actual.version.startsWith('10.11.') ||!/MariaDB/i.test(actual.version)) {
    throw new EtlSafeError(`mysql-target-guard: máy chủ không phải MariaDB 10.11 (${actual.version}) — TỪ CHỐI.`);
  }
  if (!actual.sqlMode.split(',').includes('STRICT_TRANS_TABLES')) {
    throw new EtlSafeError('mysql-target-guard: sql_mode thiếu STRICT_TRANS_TABLES (có thể cắt dữ liệu im lặng) — TỪ CHỐI.');
  }
  if (actual.database !== REHEARSAL_MYSQL.database) {
    throw new EtlSafeError(`mysql-target-guard: DATABASE()="${actual.database}" ≠ "${REHEARSAL_MYSQL.database}" — TỪ CHỐI.`);
  }
}

/** Chạy `docker <args>` trả stdout (script dùng execFileSync; test tiêm hàm giả). */
export type DockerExec = (args: string[]) => string;

/**
 * Đọc hostname container diễn tập qua docker, kèm kiểm container đang chạy và
 * cổng 3306/tcp của nó ánh xạ ra host ĐÚNG 3307 (cổng mà chốt tĩnh cho phép).
 */
export function resolveRehearsalContainer(exec: DockerExec): string {
  const name = REHEARSAL_MYSQL.container;
  let running: string;
  let hostname: string;
  let ports: string;
  try {
    running = exec(['inspect', '-f', '{{.State.Running}}', name]).trim();
    hostname = exec(['inspect', '-f', '{{.Config.Hostname}}', name]).trim();
    ports = exec(['port', name, REHEARSAL_MYSQL.containerPort]).trim();
  } catch {
    throw new EtlSafeError(`mysql-target-guard: không đọc được container ${name} qua docker — TỪ CHỐI.`);
  }
  if (running !== 'true') {
    throw new EtlSafeError(`mysql-target-guard: container ${name} không chạy — TỪ CHỐI.`);
  }
  const lines = ports.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0 || !lines.every((l) => l.endsWith(`:${REHEARSAL_MYSQL.port}`))) {
    throw new EtlSafeError(
      `mysql-target-guard: cổng ${REHEARSAL_MYSQL.containerPort} của ${name} không ánh xạ ra host ${REHEARSAL_MYSQL.port} — TỪ CHỐI.`,
    );
  }
  return hostname;
}
