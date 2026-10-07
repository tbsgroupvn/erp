/**
 * L13 Task 1 — chốt ĐÍCH MySQL của công cụ chép ngược. Hàm thuần — không kết nối gì.
 * Đích duy nhất được chấp nhận: MariaDB diễn tập CỤC BỘ (127.0.0.1/localhost:3307,
 * CSDL sql_nhpcn) VÀ máy chủ trả lời phải đúng là container `tbs-mariadb-rehearsal`
 * (@@hostname == hostname container đọc bằng `docker inspect`). Không cờ nào mở được.
 */
import {
  assertMysqlRehearsalServer,
  assertMysqlRehearsalTarget,
  resolveRehearsalContainer,
  REHEARSAL_MYSQL,
} from '../../src/rehearsal/copyback/mysql-target-guard';

const OK_CFG = { host: '127.0.0.1', port: 3307, database: 'sql_nhpcn' };
const CONTAINER_HOST = '48a7f4c49ddd';
const OK_SERVER = {
  hostname: CONTAINER_HOST,
  version: '10.11.19-MariaDB-ubu2204',
  sqlMode: 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION',
  database: 'sql_nhpcn',
};

describe('assertMysqlRehearsalTarget (chốt tĩnh, TRƯỚC khi kết nối)', () => {
  it('chấp nhận MariaDB diễn tập cục bộ 127.0.0.1:3307 / localhost:3307', () => {
    expect(() => assertMysqlRehearsalTarget(OK_CFG)).not.toThrow();
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, host: 'localhost' })).not.toThrow();
    expect(REHEARSAL_MYSQL.port).toBe(3307);
    expect(REHEARSAL_MYSQL.container).toBe('tbs-mariadb-rehearsal');
  });

  it('TỪ CHỐI IP prod 103.142.27.124 (dù đúng cổng/CSDL)', () => {
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, host: '103.142.27.124' })).toThrow(/prod/);
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, host: '103.142.27.124', port: 3306 })).toThrow();
  });

  it('TỪ CHỐI máy prod cũ 180.93.136.224 và tên miền prod', () => {
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, host: '180.93.136.224' })).toThrow(/prod/);
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, host: 'erp.nhaphangchinhngach.vn' })).toThrow();
  });

  it('TỪ CHỐI cổng 3306 (cổng MySQL mặc định) và mọi cổng khác 3307', () => {
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, port: 3306 })).toThrow(/3307/);
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, port: 13307 })).toThrow(/3307/);
  });

  it('TỪ CHỐI máy từ xa bất kỳ (kể cả IP LAN, 0.0.0.0, host.docker.internal)', () => {
    for (const host of ['192.168.1.10', '10.0.0.5', '0.0.0.0', 'host.docker.internal', 'db.example.com', '']) {
      expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, host })).toThrow();
    }
  });

  it('TỪ CHỐI CSDL khác sql_nhpcn', () => {
    expect(() => assertMysqlRehearsalTarget({ ...OK_CFG, database: 'sql_demo_taobaos' })).toThrow(/sql_nhpcn/);
  });

  it('không có tham số nào mở được chốt (hàm chỉ nhận host/port/database)', () => {
    const withBypass = { ...OK_CFG, host: '103.142.27.124', force: true, allowRemote: true } as typeof OK_CFG;
    expect(() => assertMysqlRehearsalTarget(withBypass)).toThrow();
  });
});

describe('assertMysqlRehearsalServer (chốt LÚC CHẠY, sau kết nối, TRƯỚC mọi ghi)', () => {
  it('chấp nhận khi @@hostname == hostname container diễn tập', () => {
    expect(() => assertMysqlRehearsalServer(OK_SERVER, CONTAINER_HOST)).not.toThrow();
  });

  it('TỪ CHỐI khi @@hostname khác (vd đường hầm SSH 127.0.0.1:3307 → prod)', () => {
    expect(() => assertMysqlRehearsalServer({ ...OK_SERVER, hostname: 'erp-nhpcn' }, CONTAINER_HOST)).toThrow(
      /hostname/,
    );
  });

  it('TỪ CHỐI khi hostname container không phải dạng id docker 12 hex (không đọc được container)', () => {
    expect(() => assertMysqlRehearsalServer({ ...OK_SERVER, hostname: '' }, '')).toThrow();
    expect(() => assertMysqlRehearsalServer({ ...OK_SERVER, hostname: 'erp' }, 'erp')).toThrow(/docker/);
  });

  it('TỪ CHỐI khi không phải MariaDB 10.11 hoặc sql_mode không STRICT (cắt dữ liệu im lặng)', () => {
    expect(() => assertMysqlRehearsalServer({ ...OK_SERVER, version: '8.0.36' }, CONTAINER_HOST)).toThrow(/MariaDB/);
    expect(() =>
      assertMysqlRehearsalServer({ ...OK_SERVER, sqlMode: 'NO_ENGINE_SUBSTITUTION' }, CONTAINER_HOST),
    ).toThrow(/STRICT/);
  });

  it('TỪ CHỐI khi DATABASE() không phải sql_nhpcn', () => {
    expect(() => assertMysqlRehearsalServer({ ...OK_SERVER, database: 'mysql' }, CONTAINER_HOST)).toThrow();
  });
});

describe('resolveRehearsalContainer (đọc hostname + cổng qua docker inspect)', () => {
  it('trả hostname khi container chạy và cổng 3306/tcp ánh xạ ra host 3307', () => {
    const calls: string[][] = [];
    const exec = (args: string[]) => {
      calls.push(args);
      if (args.includes('{{.Config.Hostname}}')) return `${CONTAINER_HOST}\n`;
      if (args.includes('{{.State.Running}}')) return 'true\n';
      return '0.0.0.0:3307\n';
    };
    expect(resolveRehearsalContainer(exec)).toBe(CONTAINER_HOST);
    expect(calls.every((a) => a.includes('tbs-mariadb-rehearsal'))).toBe(true);
  });

  it('TỪ CHỐI khi container không chạy hoặc cổng host khác 3307', () => {
    const base = (args: string[]) =>
      args.includes('{{.Config.Hostname}}') ? CONTAINER_HOST : args.includes('{{.State.Running}}') ? 'true' : '0.0.0.0:3307';
    expect(() =>
      resolveRehearsalContainer((a) => (a.includes('{{.State.Running}}') ? 'false' : base(a))),
    ).toThrow(/chạy/);
    expect(() =>
      resolveRehearsalContainer((a) => (a[0] === 'port' ? '0.0.0.0:3306' : base(a))),
    ).toThrow(/3307/);
    expect(() =>
      resolveRehearsalContainer(() => {
        throw new Error('docker: not found');
      }),
    ).toThrow(/docker/);
  });
});
