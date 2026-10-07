/**
 * L0 Task 2 — cổng vào ETL (`runEtl`) — KHÔNG đụng CSDL nào: nguồn/đích là đồ giả.
 * Chứng minh: (1) target-guard chạy TRƯỚC khi mở bất kỳ kết nối nào;
 * (2) cổng DỪNG ("≥1 ⇒ DỪNG") chặn TRƯỚC truncate, trừ khi có cờ tường minh;
 * (3) ánh xạ/kiểm toàn bộ TRƯỚC truncate; (4) truncate+nạp+setval trong một lời gọi
 * giao dịch; (5) đích báo tên CSDL khác ⇒ từ chối, không mở nguồn; (6) mã thoát.
 */
import * as path from 'path';
import * as os from 'os';
import {
  runEtl,
  exitCodeFor,
  EtlDeps,
  LoadPlan,
  SourceDb,
  TargetDb,
} from '../../src/rehearsal/etl/runner';
import { TABLES } from '../../src/rehearsal/etl/tables';
import { EtlSafeError } from '../../src/rehearsal/etl/convert';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';
import { safeErrorText } from '../../scripts/rehearsal/etl';

const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_test?schema=public';
const REH_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const OUT_DIR = path.join(os.tmpdir(), 'etl-runner-spec-out');

const PAY = {
  cdate: 1, mdate: null, price_cyn: '1.00', currency: 'CNY', rate_buy: 1, saler: 's', from: '', source: '',
  code_order: 'A', order_id: '0', note: '', note_payment: null, price_payment: null, payment: null, pdate: null,
  status: 'no', confirm: 'no', po_id: 0, pay_type: '', bill_images: null, account_code: '', ncc_receiver: '',
  ncc_bank_name: '', ncc_bank_account: '', ncc_qr_image: '', ncc_bank_note: null, ncc_pay_channel: 'bank',
  ncc_platform_order: '', ncc_invoice_images: null, ncc_packing_list_images: null, kt_note: null, tt_ngoai_kieu: '',
};

interface FakeOpts {
  dbName?: string;
  /** câu anomaly có chuỗi này ⇒ trả 1 (vd 'status <=> confirm' = 09a A8). */
  anomalyHit?: string;
  /** bảng nguồn trả dòng làm ánh xạ nổ. */
  badPaymentRow?: boolean;
  /** nguồn không trả sàn bộ đếm (information_schema). */
  noSeqFloor?: boolean;
}

function fakes(opts: FakeOpts = {}) {
  const calls: string[] = [];
  let plan: LoadPlan | null = null;
  const source: SourceDb = {
    async query(sql: string) {
      if (sql.startsWith('SELECT COUNT(*)') || sql.startsWith('SELECT (SELECT')) {
        calls.push('src:anomaly');
        return [{ c: opts.anomalyHit && sql.includes(opts.anomalyHit) ? '1' : '0' }];
      }
      if (sql.includes('information_schema.TABLES')) {
        calls.push('src:seqfloor');
        if (opts.noSeqFloor) return [];
        return [{ f: sql.includes("TABLE_NAME = 'tbl_payment'") ? '56999' : '0' }];
      }
      calls.push(`src:${sql.slice(0, 40)}`);
      if (/FROM `tbl_payment` /.test(sql))
        return [{ id: '10', ...PAY, ...(opts.badPaymentRow ? { currency: 'EUR' } : {}) }];
      if (/FROM `tbl_payment_orders` /.test(sql))
        return [
          { id: 1, payment_id: 10, order_id: 1, rmb: '1.00', cdate: 1, prev_fund: null, prev_rate: null },
          { id: 2, payment_id: 99, order_id: 1, rmb: '1.00', cdate: 1, prev_fund: null, prev_rate: null },
        ];
      return [];
    },
    async close() {
      calls.push('src:close');
    },
  };
  const target: TargetDb = {
    async currentDatabase() {
      return opts.dbName ?? 'tbs_rehearsal';
    },
    async replaceAll(p: LoadPlan) {
      plan = p;
      calls.push(`replaceAll:truncate=${p.truncateTables.length}`);
      const written: Record<string, number> = {};
      const setval: Record<string, string> = {};
      for (const s of p.steps) written[s.model] = s.rows.length;
      for (const s of p.steps) setval[s.table] = '1';
      return { written, setval };
    },
    async close() {
      calls.push('tgt:close');
    },
  };
  const deps: EtlDeps = {
    openSource: jest.fn(async () => source),
    openTarget: jest.fn(async () => target),
  };
  return { calls, deps, getPlan: () => plan };
}

const base = { forbiddenUrls: [TEST_URL], outDir: OUT_DIR, repoRoot: '/repo', writeReport: false };

describe('runEtl — target-guard trong đường chạy', () => {
  it('TỪ CHỐI tbs_test trước khi mở bất kỳ kết nối nào', async () => {
    const { deps, calls } = fakes();
    await expect(runEtl({ ...base, targetUrl: TEST_URL }, deps)).rejects.toThrow(/_rehearsal|tbs_test/);
    expect(deps.openSource).not.toHaveBeenCalled();
    expect(deps.openTarget).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('thông điệp từ chối KHÔNG chứa mật khẩu URL', async () => {
    const { deps } = fakes();
    const bad = 'postgresql://postgres:S3cretPw@localhost:5433/tbs_test';
    await expect(runEtl({ ...base, targetUrl: bad }, deps)).rejects.toThrow(EtlSafeError);
    await expect(runEtl({ ...base, targetUrl: bad }, deps)).rejects.not.toThrow(/S3cretPw/);
  });

  it('TỪ CHỐI khi CSDL diễn tập trùng tên URL cấm', async () => {
    const { deps } = fakes();
    await expect(runEtl({ ...base, targetUrl: REH_URL, forbiddenUrls: [REH_URL] }, deps)).rejects.toThrow(
      /TỪ CHỐI/,
    );
    expect(deps.openTarget).not.toHaveBeenCalled();
  });

  it('TỪ CHỐI khi thư mục báo cáo nằm TRONG repo', async () => {
    const { deps } = fakes();
    const repo = path.join(os.tmpdir(), 'fake-repo');
    await expect(
      runEtl({ ...base, targetUrl: REH_URL, outDir: path.join(repo, 'out'), repoRoot: repo }, deps),
    ).rejects.toThrow(/ngoài repo/);
    expect(deps.openTarget).not.toHaveBeenCalled();
  });

  it('TỪ CHỐI khi current_database() không phải *_rehearsal — không mở nguồn, không ghi', async () => {
    const { deps, calls } = fakes({ dbName: 'tbs_test' });
    await expect(runEtl({ ...base, targetUrl: REH_URL }, deps)).rejects.toThrow(/current_database/);
    expect(deps.openSource).not.toHaveBeenCalled();
    expect(calls.some((c) => c.startsWith('replaceAll'))).toBe(false);
    expect(calls).toContain('tgt:close');
  });
});

describe('runEtl — cổng DỪNG trước truncate', () => {
  it('mặc định: A8 nổ ⇒ outcome stopped, KHÔNG gọi replaceAll, exit 2', async () => {
    const { deps, calls } = fakes({ anomalyHit: 'status <=> confirm' });
    const s = await runEtl({ ...base, targetUrl: REH_URL }, deps);
    expect(s.outcome).toBe('stopped');
    expect(s.stopRulesFired).toEqual(['09a-A8']);
    expect(calls.some((c) => c.startsWith('replaceAll'))).toBe(false);
    expect(s.tables).toEqual([]);
    expect(exitCodeFor(s.outcome)).toBe(2);
  });

  it('tbl_fx_adjustments có dòng (09c §2.2) cũng DỪNG trước truncate', async () => {
    const { deps, calls } = fakes({ anomalyHit: 'FROM tbl_fx_adjustments' });
    const s = await runEtl({ ...base, targetUrl: REH_URL }, deps);
    expect(s.outcome).toBe('stopped');
    expect(s.stopRulesFired).toEqual(['09c-2.2']);
    expect(calls.some((c) => c.startsWith('replaceAll'))).toBe(false);
  });

  it('cờ allowStopAnomalies: vẫn nạp, ghi cờ + luật nổ vào tóm tắt, exit 3', async () => {
    const { deps, calls } = fakes({ anomalyHit: 'status <=> confirm' });
    const s = await runEtl({ ...base, targetUrl: REH_URL, allowStopAnomalies: true }, deps);
    expect(s.outcome).toBe('loaded_with_stop_anomalies');
    expect(s.allowStopAnomalies).toBe(true);
    expect(s.stopRulesFired).toEqual(['09a-A8']);
    expect(calls.some((c) => c.startsWith('replaceAll'))).toBe(true);
    expect(exitCodeFor(s.outcome)).toBe(3);
  });

  it('không nổ gì ⇒ clean, exit 0; lỗi ⇒ 1', () => {
    expect(exitCodeFor('clean')).toBe(0);
    expect(exitCodeFor('failed')).toBe(1);
  });
});

describe('runEtl — kiểm trước, nạp một giao dịch', () => {
  it('ánh xạ nổ (enum lạ) ⇒ ném lỗi TRƯỚC replaceAll (đích nguyên vẹn)', async () => {
    const { deps, calls } = fakes({ badPaymentRow: true });
    await expect(runEtl({ ...base, targetUrl: REH_URL }, deps)).rejects.toThrow(/currency/);
    expect(calls.some((c) => c.startsWith('replaceAll'))).toBe(false);
  });

  it('một lời gọi replaceAll gồm truncate đủ bảng + mọi bước theo §5; A2 mồ côi bị loại', async () => {
    const { deps, calls, getPlan } = fakes();
    const s = await runEtl({ ...base, targetUrl: REH_URL }, deps);
    expect(s.outcome).toBe('clean');
    expect(calls.filter((c) => c.startsWith('replaceAll'))).toEqual([`replaceAll:truncate=${TABLES.length}`]);
    // mọi lần đọc nguồn xảy ra TRƯỚC replaceAll
    const ri = calls.findIndex((c) => c.startsWith('replaceAll'));
    expect(calls.slice(ri + 1).some((c) => c.startsWith('src:') && c !== 'src:close')).toBe(false);
    const plan = getPlan()!;
    expect(plan.steps.map((x) => x.model)).toEqual(TABLES.map((t) => t.model));
    expect(plan.steps.find((x) => x.model === 'ReturnState')!.rawJsonInsert).toBe(true);
    const order = s.tables.find((t) => t.model === 'SupplierPaymentOrder')!;
    expect(order.read).toBe(2);
    expect(order.written).toBe(1);
    expect(Object.values(order.skipped)).toEqual([1]);
    expect(s.anomalies.length).toBeGreaterThan(0);
    expect(s.stopRulesFired).toEqual([]);
  });
});

describe('runEtl — sàn bộ đếm PG từ NGUỒN (L13 fix round 1)', () => {
  it('plan.seqFloor = GREATEST(MAX MySQL kể cả dòng loại, AUTO_INCREMENT−1) đọc trên nguồn, TRƯỚC replaceAll', async () => {
    const { deps, calls, getPlan } = fakes();
    await runEtl({ ...base, targetUrl: REH_URL }, deps);
    const plan = getPlan()!;
    expect(Object.keys(plan.seqFloor).sort()).toEqual(TABLES.map((t) => t.targetTable).sort());
    expect(plan.seqFloor.tbl_payment).toBe('56999');
    expect(plan.seqFloor.tbl_accounts).toBe('0');
    expect(calls.lastIndexOf('src:seqfloor')).toBeLessThan(calls.findIndex((c) => c.startsWith('replaceAll')));
  });

  it('nguồn không trả sàn ⇒ DỪNG trước replaceAll (không rơi về công thức cũ)', async () => {
    const { deps, calls } = fakes({ noSeqFloor: true });
    await expect(runEtl({ ...base, targetUrl: REH_URL }, deps)).rejects.toThrow(/sàn bộ đếm/);
    expect(calls.some((c) => c.startsWith('replaceAll'))).toBe(false);
  });
});

describe('safeErrorText (CLI)', () => {
  it('lỗi khác EtlSafeError chỉ in name/code/khoá meta — không in message', () => {
    const e = Object.assign(new Error('Invalid value ncc_bank_account: "0123456789"'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['id'] },
    });
    const t = safeErrorText(e);
    expect(t).toBe('PrismaClientKnownRequestError code=P2002 metaKeys=target');
    expect(t).not.toMatch(/0123456789/);
  });

  it('EtlSafeError in thông điệp', () => {
    expect(safeErrorText(new EtlSafeError('ETL cột x: lạ'))).toBe('ETL cột x: lạ');
  });
});

describe('collectForbiddenUrls', () => {
  it('gom DATABASE_URL của env và biến môi trường', () => {
    const urls = collectForbiddenUrls('/no/such/repo', { DATABASE_URL: TEST_URL });
    expect(urls).toContain(TEST_URL);
  });
});
