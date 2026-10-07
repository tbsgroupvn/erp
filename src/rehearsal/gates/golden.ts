/**
 * L0 Task 3 — SỐ VÀNG 09d §9 (a)–(i) trên dump.
 *
 * Số trong tài liệu 09d đo trên prod ở thời điểm KHÁC (25/09 12:37…); dump rút 25/09 15:41 ⇒ con số được
 * phép khác vì có dòng mới. Vì thế mỗi cổng so HAI con số tính trên CÙNG bản dump:
 *   - NGUỒN: công thức PROD (SQL prod chép nguyên văn chạy trên MariaDB diễn tập; phần thuật toán PHP
 *     dùng lại hàm THUẦN v2 đã port + đã test vàng với PHP — `fxqTinh`, `bankReconMatch`,
 *     `clusterSuspectDuplicates`, `poTienNccTinh` — nạp đầu vào đọc từ MariaDB);
 *   - ĐÍCH: service ĐỌC v2 (`TreasuryReportService`, `TreasuryService`, `PoTienNccService`,
 *     `BankReconService`) dựng trên PrismaClient diễn tập (read-only).
 * Số của tài liệu chỉ là bối cảnh. Chênh CÓ CHỦ Ý đã được quyết (Q-DOC-1/3) ⇒ số prod để ở `info`.
 */
import { Prisma } from '@prisma/client';
import { compareKeyed, compareScalars, normVal } from './compare';
import { FX_FAMILY_MY } from './source-gates';
import { WALLET_BALANCE_SRC } from './target-gates';
import { Agg, Gate, GateContext, GateEval, QueryDb, Row } from './types';
import { clusterSuspectDuplicates, tbsSkLoc, vnEpoch, vnYmd } from '../../treasury/report-rules';
import { FxqInput, fxqTinh } from '../../money/fx-quyte';
import { bankReconDebitCat, bankReconMatch, ReconLink, vnMidnight } from '../../bank/bank-recon.rules';
import { poTienNccTinh, PtnEntry } from '../../po/po-tien-ncc.rules';

const Decimal = Prisma.Decimal;
type Dec = Prisma.Decimal;
const D09D = '09d §9';
const VN = 7 * 3600;

/** Bề mặt ĐỌC của service v2 mà cổng số vàng dùng (dạng cấu trúc — test dùng đồ giả). */
export interface GoldenServices {
  treasury: { getBalance(code: string): Promise<Dec> };
  report: {
    statement(uid: number, code: string, filter: ReturnType<typeof tbsSkLoc>, opts?: { gioiHan?: number }): Promise<{
      dauKy: string; kyVao: string; kyRa: string; kyNVao: number; kyNRa: number; cuoiKy: string; soDuVi: string | null;
    }>;
    monthlyFlow(uid: number, months: number, now: Date): Promise<{ thang: { ym: string; in: string; out: string }[] }>;
    quyTrongKy(uid: number, from: number, toExclusive: number): Promise<{ thu: string; chi: string }>;
    costSummary(uid: number, by: 'po_id' | 'container_id', from: number, to: number): Promise<{ ref: number; chiVnd: string; thuVnd: string; n: number }[]>;
    suspectDuplicates(uid: number, tk: string, from: number, to: number, windowMinutes?: number): Promise<{ n: number; rows: { sourceModule: string }[] }[]>;
    quyTe(uid: number, from: number, to: number): Promise<any>;
  };
  poTienNcc(poId: number): Promise<{
    chi: Record<string, string>; thu: Record<string, string>; con: Record<string, string>; moHo: unknown[];
    soPhieuChi: { daDuyet: number; choDuyet: number; quaDo: number };
  }>;
  recon: {
    reconList(uid: number, fd: number, td: number, win?: number): Promise<{
      rows: { status: string }[]; orphanDocs: { module: string }[]; totals: { bank: string; matched: string; unmatched: string };
    }>;
    fxUnaccounted(uid: number, now: Date): Promise<{
      cashCount: number; cashTotal: string; transferShort: string; reviewCount: number; reviewTotal: string;
    }>;
  };
}

const noSvc: GateEval = { status: 'SKIPPED', reason: 'không có service v2 (chạy không kèm service)' };
const dec = (v: unknown) => new Decimal(normVal(v) ?? '0');
const ep = (ymd: string, hms: string) => {
  const e = vnEpoch(ymd, hms);
  if (e === null) throw new Error('ngày không hợp lệ');
  return e;
};

// ───────────────────────────────────────────────────────── tỷ giá / toVnd (cls.treasury.php:301-343)
type Cur = 'VND' | 'CNY' | 'USD';
type Rates = Record<'CNY' | 'USD', Dec>;
async function srcRates(db: QueryDb, ngayVn: string): Promise<Rates> {
  const rows = await db.query(
    `SELECT currency, rate_vnd FROM tbl_exchange_rates WHERE rate_date <= '${ngayVn.replace(/[^0-9-]/g, '')}' ORDER BY rate_date DESC, id DESC`,
  );
  const pick = (c: string) => {
    const r = rows.find((x) => String(x.currency) === c);
    return r ? dec(r.rate_vnd) : new Decimal(0);
  };
  return { CNY: pick('CNY'), USD: pick('USD') };
}
const curOf = (c: unknown): Cur => (c === 'CNY' || c === 'USD' ? c : 'VND');
function toVnd(a: Dec, cur: Cur, r: Rates): Dec | null {
  if (cur === 'VND') return a;
  return r[cur].lte(0) ? null : a.times(r[cur]);
}

/** `date('Y-m', strtotime("-$i months"))` của PHP — tràn ngày như PHP (31/10 − 1 tháng = 01/10). */
export function phpMonthLabels(now: Date, n: number): string[] {
  const vn = new Date(now.getTime() + VN * 1000);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - i, vn.getUTCDate(), vn.getUTCHours(), vn.getUTCMinutes()));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
/** `strtotime(date('Y-m-01', strtotime('-(n-1) months')))` của prod monthlyFlow. */
function phpFlowFrom(now: Date, n: number): number {
  const vn = new Date(now.getTime() + VN * 1000);
  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - (n - 1), vn.getUTCDate()));
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000 - VN;
}

// ───────────────────────────────────────────────────────── (a) sao kê 15 ví × 3 kỳ
const KY = [
  { ky: 'T9', fdate: '2026-09-01', tdate: '2026-09-25' },
  { ky: 'T8', fdate: '2026-08-01', tdate: '2026-08-31' },
  { ky: 'ALL', fdate: '2020-01-01', tdate: '2026-09-25' },
];
function stmtSrcSql(tu: number, den: number): string {
  return `SELECT a.code, a.opening_balance,
    (SELECT COALESCE(SUM(money),0) FROM tbl_account_histories WHERE tk_code=a.code AND status=1 AND cdate < ${tu}) AS truoc,
    (SELECT COALESCE(SUM(CASE WHEN money>0 THEN money ELSE 0 END),0) FROM tbl_account_histories WHERE tk_code=a.code AND status=1 AND cdate BETWEEN ${tu} AND ${den}) AS vao,
    (SELECT COALESCE(SUM(CASE WHEN money<0 THEN -money ELSE 0 END),0) FROM tbl_account_histories WHERE tk_code=a.code AND status=1 AND cdate BETWEEN ${tu} AND ${den}) AS ra,
    (SELECT COUNT(*) FROM tbl_account_histories WHERE tk_code=a.code AND status=1 AND money>0 AND cdate BETWEEN ${tu} AND ${den}) AS nv,
    (SELECT COUNT(*) FROM tbl_account_histories WHERE tk_code=a.code AND status=1 AND money<0 AND cdate BETWEEN ${tu} AND ${den}) AS nr
    FROM tbl_accounts a ORDER BY a.code`;
}
const STMT_VALS = ['dauKy', 'kyVao', 'kyRa', 'kyNVao', 'kyNRa', 'cuoiKy'];

const gateA: Gate = {
  id: '09d-a', doc: D09D + ' (a) · §2.2', kind: 'golden',
  title: 'sao kê tbs_sk_doc 15 ví × 3 kỳ (đầu kỳ, vào, ra, số dòng, cuối kỳ)',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const src: Row[] = [];
    const tgt: Row[] = [];
    for (const k of KY) {
      const tu = ep(k.fdate, '00:00:00');
      const den = ep(k.tdate, '23:59:59');
      for (const r of await ctx.source.query(stmtSrcSql(tu, den))) {
        const dau = dec(r.opening_balance).plus(dec(r.truoc));
        src.push({ key: `${r.code} ${k.ky}`, dauKy: dau, kyVao: r.vao, kyRa: r.ra, kyNVao: r.nv, kyNRa: r.nr,
          cuoiKy: dau.plus(dec(r.vao)).minus(dec(r.ra)) });
        const code = String(r.code);
        const t = await ctx.services.report.statement(ctx.uid, code, tbsSkLoc({ tk: code, fdate: k.fdate, tdate: k.tdate }, ctx.now));
        tgt.push({ key: `${code} ${k.ky}`, dauKy: t.dauKy, kyVao: t.kyVao, kyRa: t.kyRa, kyNVao: t.kyNVao, kyNRa: t.kyNRa, cuoiKy: t.cuoiKy });
      }
    }
    return compareKeyed(src, tgt, { key: ['key'], values: STMT_VALS, keysAreLabels: true });
  },
};
const gateA2: Gate = {
  id: '09d-a2', doc: D09D + ' (a) · §2.2', kind: 'golden',
  title: 'kỳ chạm hôm nay: cuoiKy = soDuVi (getBalance) trên đích = số dư ví nguồn (09b §8.1)',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const src = await ctx.source.query(WALLET_BALANCE_SRC);
    const s: Row[] = [];
    const t: Row[] = [];
    for (const r of src) {
      const code = String(r.code);
      const st = await ctx.services.report.statement(ctx.uid, code, tbsSkLoc({ tk: code, fdate: '2020-01-01', tdate: vnYmd(new Date()) }, new Date()));
      s.push({ code, cuoiKy: r.balance, soDuVi: r.balance });
      t.push({ code, cuoiKy: st.cuoiKy, soDuVi: st.soDuVi });
    }
    return compareKeyed(s, t, { key: ['code'], values: ['cuoiKy', 'soDuVi'], keysAreLabels: true });
  },
};

// ───────────────────────────────────────────────────────── (b) monthlyFlow
async function srcMonthlyFlow(db: QueryDb, now: Date, n: number): Promise<Row[]> {
  const labels = phpMonthLabels(now, n);
  const from = phpFlowFrom(now, n);
  const raw = await db.query(`SELECT FROM_UNIXTIME(h.cdate,'%Y-%m') AS ym, a.currency,
      SUM(CASE WHEN h.money>0 THEN h.money ELSE 0 END) AS money_in, SUM(CASE WHEN h.money<0 THEN -h.money ELSE 0 END) AS money_out
    FROM tbl_account_histories h LEFT JOIN tbl_accounts a ON a.code=h.tk_code
    WHERE h.status=1 AND h.cdate >= ${from} AND h.type<>'tranfer' AND NOT ${FX_FAMILY_MY}
    GROUP BY ym, a.currency ORDER BY ym`);
  const rates = await srcRates(db, vnYmd(now));
  const out = new Map<string, { in: Dec; out: Dec }>();
  for (const l of labels) out.set(l, { in: new Decimal(0), out: new Decimal(0) });
  for (const r of raw) {
    const o = out.get(String(r.ym));
    if (!o) continue;
    const c = curOf(r.currency);
    o.in = o.in.plus(toVnd(dec(r.money_in), c, rates) ?? 0);
    o.out = o.out.plus(toVnd(dec(r.money_out), c, rates) ?? 0);
  }
  return [...out.entries()].map(([ym, v]) => ({ ym, in: v.in, out: v.out }));
}
const gateB: Gate = {
  id: '09d-b', doc: D09D + ' (b) · §3', kind: 'golden',
  title: 'monthlyFlow(6) — vào/ra VND từng tháng (công thức prod ↔ TreasuryReportService)',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const s = await srcMonthlyFlow(ctx.source, ctx.now, 6);
    const t = (await ctx.services.report.monthlyFlow(ctx.uid, 6, ctx.now)).thang.map((x) => ({ ym: x.ym, in: x.in, out: x.out }));
    return compareKeyed(s, t, { key: ['ym'], values: ['in', 'out'], keysAreLabels: true });
  },
};

// ───────────────────────────────────────────────────────── (c) quyTrongKy
const C_FROM = '2026-09-01';
const C_TO = '2026-09-26';
const gateC: Gate = {
  id: '09d-c', doc: D09D + ' (c) · §6', kind: 'golden',
  title: 'quyTrongKy(01/09, 26/09) thu/chi VND — bản SỬA (Q-DOC-1 (a)); số bld_data prod ở info',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const from = ep(C_FROM, '00:00:00');
    const to = ep(C_TO, '00:00:00');
    const [s] = await ctx.source.query(`SELECT COALESCE(SUM(CASE WHEN h.money>0 THEN h.money ELSE 0 END),0) AS thu,
        COALESCE(SUM(CASE WHEN h.money<0 THEN -h.money ELSE 0 END),0) AS chi
      FROM tbl_account_histories h LEFT JOIN tbl_accounts a ON a.code=h.tk_code
      WHERE h.status=1 AND h.cdate>=${from} AND h.cdate<${to} AND h.type<>'tranfer' AND NOT ${FX_FAMILY_MY}
        AND (a.currency IS NULL OR a.currency='VND')`);
    const prod = await ctx.source.query(`SELECT type, SUM(money) AS t FROM tbl_account_histories WHERE cdate>=${from} AND cdate<${to} GROUP BY type`);
    const t = await ctx.services.report.quyTrongKy(ctx.uid, from, to);
    const r = compareScalars({ thu: s?.thu, chi: s?.chi }, { thu: t.thu, chi: t.chi }, ['thu', 'chi']);
    const tIn = prod.find((x) => x.type === 'in');
    const tOut = prod.find((x) => x.type === 'out');
    r.info = {
      prodBldThu_PBLD1: tIn ? dec(tIn.t).toFixed() : '0',
      prodBldChi_PBLD1: tOut ? dec(tOut.t).abs().toFixed() : '0',
    };
    return r;
  },
};
const gateC2: Gate = {
  id: '09d-c2', doc: D09D + ' (c) · §6.3', kind: 'golden',
  title: 'quyTrongKy(01/09, 26/09) = monthlyFlow tháng 9 (một nguồn, hai màn — trên đích)',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const q = await ctx.services.report.quyTrongKy(ctx.uid, ep(C_FROM, '00:00:00'), ep(C_TO, '00:00:00'));
    const m = (await ctx.services.report.monthlyFlow(ctx.uid, 6, ctx.now)).thang.find((x) => x.ym === '2026-09');
    const r = compareScalars({ thu: m?.in ?? null, chi: m?.out ?? null }, { thu: q.thu, chi: q.chi }, ['thu', 'chi']);
    return { ...r, source: { monthlyFlowIn: r.source?.thu ?? null, monthlyFlowOut: r.source?.chi ?? null }, target: { quyTrongKyThu: r.target?.thu ?? null, quyTrongKyChi: r.target?.chi ?? null } };
  },
};

// ───────────────────────────────────────────────────────── (d) costSummary
function gateD(by: 'po_id' | 'container_id'): Gate {
  return {
    id: `09d-d-${by === 'po_id' ? 'po' : 'cont'}`, doc: D09D + ' (d) · §5.1', kind: 'golden',
    title: `costSummary(${by}) toàn kỳ — số ref, chi_vnd, thu_vnd, n từng ref`,
    async run(ctx) {
      if (!ctx.services) return noSvc;
      const raw = await ctx.source.query(`SELECT h.${by} AS ref, a.currency,
          SUM(CASE WHEN h.money<0 THEN -h.money ELSE 0 END) AS chi, SUM(CASE WHEN h.money>0 THEN h.money ELSE 0 END) AS thu, COUNT(*) AS n
        FROM tbl_account_histories h LEFT JOIN tbl_accounts a ON a.code=h.tk_code
        WHERE h.${by}>0 AND h.status=1 GROUP BY ref, a.currency`);
      const rates = await srcRates(ctx.source, vnYmd());
      const m = new Map<string, { chiVnd: Dec; thuVnd: Dec; n: number }>();
      for (const r of raw) {
        const k = String(normVal(r.ref));
        const o = m.get(k) ?? { chiVnd: new Decimal(0), thuVnd: new Decimal(0), n: 0 };
        const c = curOf(r.currency);
        o.chiVnd = o.chiVnd.plus(toVnd(dec(r.chi), c, rates) ?? 0);
        o.thuVnd = o.thuVnd.plus(toVnd(dec(r.thu), c, rates) ?? 0);
        o.n += Number(normVal(r.n));
        m.set(k, o);
      }
      const src = [...m.entries()].map(([ref, o]) => ({ ref, ...o }));
      const tgt = (await ctx.services.report.costSummary(ctx.uid, by, 0, 0)).map((x) => ({ ref: x.ref, chiVnd: x.chiVnd, thuVnd: x.thuVnd, n: x.n }));
      return compareKeyed(src, tgt, { key: ['ref'], values: ['chiVnd', 'thuVnd', 'n'] });
    },
  };
}

// ───────────────────────────────────────────────────────── (e) poTienNcc
const gateE: Gate = {
  id: '09d-e', doc: D09D + ' (e) · §5.2', kind: 'golden',
  title: 'po_tien_ncc mọi PO có phiếu supplier — chi/thu/còn theo tệ, số phiếu, mo_ho',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const pays = await ctx.source.query("SELECT po_id, currency, price_cyn, status, confirm FROM tbl_payment WHERE pay_type='supplier' AND po_id>0");
    const refunds = await ctx.source.query(`SELECT r.id, r.object_code, r.form_data, r.submitted_by FROM tbl_approval_requests r
      JOIN tbl_approval_templates t ON t.id=r.template_id WHERE t.code='thu_ncc_hoan_tien' AND r.status=2 AND COALESCE(r.is_deleted,0)=0 ORDER BY r.id DESC`);
    const ids = refunds.map((r) => Number(normVal(r.id)));
    const ents = ids.length
      ? await ctx.source.query(`SELECT h.source_id, h.tk_code, h.money, EXISTS (SELECT 1 FROM tbl_account_histories rv WHERE rv.reversal_of=h.id) AS da_bi_dao
          FROM tbl_account_histories h WHERE h.source_module='thu_chi_tbs' AND h.source_id IN (${ids.join(',')}) AND h.status=1 ORDER BY h.source_id, h.id`)
      : [];
    const byRid = new Map<number, PtnEntry>();
    for (const e of ents) {
      const rid = Number(normVal(e.source_id));
      if (!byRid.has(rid)) byRid.set(rid, { tkCode: e.tk_code as string | null, money: normVal(e.money), daBiDao: normVal(e.da_bi_dao) === '1' });
    }
    const accCur = new Map((await ctx.source.query('SELECT code, currency FROM tbl_accounts')).map((a) => [String(a.code).toUpperCase(), String(a.currency).toUpperCase()]));
    const pos = [...new Set(pays.map((p) => Number(normVal(p.po_id))))].sort((a, b) => a - b);
    const tgtPos = (await ctx.target.query("SELECT DISTINCT po_id FROM tbl_payment WHERE pay_type='supplier' AND po_id>0")).map((r) => Number(normVal(r.po_id)));
    const flat = (po: number, t: { chi: Record<string, unknown>; thu: Record<string, unknown>; con: Record<string, unknown>; moHo: unknown[]; soPhieuChi: { daDuyet: number; choDuyet: number; quaDo: number } }) => ({
      po,
      chiCNY: normVal(t.chi.CNY) ?? '0', chiUSD: normVal(t.chi.USD) ?? '0', thuCNY: normVal(t.thu.CNY) ?? '0', thuUSD: normVal(t.thu.USD) ?? '0',
      conCNY: normVal(t.con.CNY) ?? '0', conUSD: normVal(t.con.USD) ?? '0', nMoHo: t.moHo.length,
      daDuyet: t.soPhieuChi.daDuyet, choDuyet: t.soPhieuChi.choDuyet, quaDo: t.soPhieuChi.quaDo,
    });
    const refundRows = refunds.map((r) => ({ id: Number(normVal(r.id)), objectCode: r.object_code as string | null, formData: r.form_data as string | null, submittedBy: r.submitted_by as string | null }));
    const src = pos.map((po) => {
      const rows = pays.filter((p) => Number(normVal(p.po_id)) === po).map((p) => ({
        currency: p.currency as string | null, priceCyn: normVal(p.price_cyn), status: p.status as string | null, confirm: p.confirm as string | null,
      }));
      return flat(po, poTienNccTinh(po, rows, refundRows, (rid) => byRid.get(rid), accCur));
    });
    const tgt: Row[] = [];
    for (const po of [...new Set([...pos, ...tgtPos])].sort((a, b) => a - b)) tgt.push(flat(po, await ctx.services.poTienNcc(po)));
    const r = compareKeyed(src, tgt, { key: ['po'], values: ['chiCNY', 'chiUSD', 'thuCNY', 'thuUSD', 'conCNY', 'conUSD', 'nMoHo', 'daDuyet', 'choDuyet', 'quaDo'] });
    const nTgtRefund = Number(normVal((await ctx.target.query(
      "SELECT COUNT(*) AS c FROM tbl_approval_requests r JOIN tbl_approval_templates t ON t.id=r.template_id WHERE t.code='thu_ncc_hoan_tien' AND r.status=2")) [0]?.c));
    r.info = { refundRequestsSource: refunds.length, refundRequestsTarget: nTgtRefund };
    return r;
  },
};

// ───────────────────────────────────────────────────────── (f) quỹ ngoại tệ FIFO
async function srcFxqInput(db: QueryDb, from: number, to: number): Promise<FxqInput> {
  const inp: FxqInput = { from, to, usdLots: [], quydoi: [], cnyLots: [], cnyMoDau: new Decimal(0), cnyVaoKhac: [], cnyRa: [],
    usdThang: [], usdKhac: new Decimal(0), soDuCny: new Decimal(0), soDuUsd: new Decimal(0) };
  const accs = await db.query("SELECT code, currency, opening_balance FROM tbl_accounts WHERE currency IN ('CNY','USD') ORDER BY id");
  const bal = new Map((await db.query(WALLET_BALANCE_SRC)).map((r) => [String(r.code), dec(r.balance)]));
  const cny: string[] = [];
  const usd: string[] = [];
  let moDau = new Decimal(0);
  let usdKhac = new Decimal(0);
  let soDuCny = new Decimal(0);
  let soDuUsd = new Decimal(0);
  for (const a of accs) {
    const code = String(a.code);
    if (a.currency === 'CNY') { cny.push(code); moDau = moDau.plus(dec(a.opening_balance)); soDuCny = soDuCny.plus(bal.get(code) ?? 0); }
    else { usd.push(code); usdKhac = usdKhac.plus(dec(a.opening_balance)); soDuUsd = soDuUsd.plus(bal.get(code) ?? 0); }
  }
  Object.assign(inp, { cnyMoDau: moDau, soDuCny, soDuUsd });
  inp.usdLots = (await db.query("SELECT amount_in, rate, created_at FROM tbl_fx_transfers WHERE status='approved' AND from_currency='VND' AND to_currency='USD' ORDER BY created_at, id"))
    .map((r) => ({ ts: Number(normVal(r.created_at)), qty: dec(r.amount_in), rate: dec(r.rate) }));
  inp.quydoi = (await db.query(`SELECT id, code, note, created_at, usd, cny, ar FROM (
      SELECT 1 AS nhanh, id, code, note, created_at, amount_in AS usd, agent_amount AS cny, agent_rate AS ar FROM tbl_fx_transfers WHERE status='approved' AND agent_tk<>'' AND agent_rate>0
      UNION ALL
      SELECT 2 AS nhanh, id, code, note, created_at, amount_out AS usd, amount_in AS cny, rate AS ar FROM tbl_fx_transfers WHERE status='approved' AND from_currency='USD' AND to_currency='CNY'
    ) q ORDER BY nhanh, id`)).map((r) => ({ ts: Number(normVal(r.created_at)), fxId: Number(normVal(r.id)), code: String(r.code), note: r.note === null ? '' : String(r.note),
    usd: dec(r.usd), cny: dec(r.cny), agentRate: dec(r.ar) }));
  inp.cnyLots = (await db.query("SELECT amount_in, rate, created_at FROM tbl_fx_transfers WHERE status='approved' AND from_currency='VND' AND to_currency='CNY' ORDER BY created_at, id"))
    .map((r) => ({ ts: Number(normVal(r.created_at)), qty: dec(r.amount_in), rate: dec(r.rate) }));
  const FXFAM = `(${FX_FAMILY_MY} OR h.source_module='')`;
  const inList = (xs: string[]) => xs.map((x) => `'${x.replace(/[^A-Za-z0-9_-]/g, '')}'`).join(',');
  if (usd.length) {
    const [r] = await db.query(`SELECT COALESCE(SUM(h.money),0) AS s FROM tbl_account_histories h WHERE h.status=1 AND h.tk_code IN (${inList(usd)}) AND NOT ${FXFAM}`);
    usdKhac = usdKhac.plus(dec(r?.s));
  }
  inp.usdKhac = usdKhac;
  if (!cny.length) return inp;
  inp.cnyVaoKhac = (await db.query(`SELECT h.money, h.cdate FROM tbl_account_histories h WHERE h.status=1 AND h.tk_code IN (${inList(cny)}) AND h.money>0 AND NOT ${FXFAM} ORDER BY h.cdate, h.id`))
    .map((r) => ({ ts: Math.trunc(Number(normVal(r.cdate) ?? 0)), qty: dec(r.money) }));
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  inp.cnyRa = (await db.query(`SELECT h.cdate, h.money, p.id AS pid, p.status AS pst, p.payment AS ppay, p.confirm AS pcf, p.code_order,
      o.oid, o.rate_sell, o.cus_id, o.saler
    FROM tbl_account_histories h LEFT JOIN tbl_payment p ON h.source_module='payment' AND p.id=h.source_id LEFT JOIN tbl_order o ON o.id=p.order_id
    WHERE h.status=1 AND h.tk_code IN (${inList(cny)}) AND h.money<0 AND NOT ${FXFAM} ORDER BY h.cdate, h.id`)).map((r) => ({
    ts: Math.trunc(Number(normVal(r.cdate) ?? 0)), qty: dec(r.money).neg(), ok: r.pst === 'yes' && r.ppay === 'yes' && r.pcf === 'yes',
    rateSell: r.rate_sell === null ? null : dec(r.rate_sell), codeOrder: s(r.code_order), oid: s(r.oid), cusId: s(r.cus_id), saler: s(r.saler),
    pid: Number(normVal(r.pid) ?? 0),
  }));
  inp.usdThang = (await db.query(`SELECT p.id AS pid, p.cdate, p.price_cyn, p.rate_buy, p.code_order, o.oid, o.rate_sell, o.cus_id, o.saler
    FROM tbl_payment p LEFT JOIN tbl_order o ON o.id=p.order_id
    WHERE p.status='yes' AND p.payment='yes' AND p.confirm='yes' AND p.cdate>=${from} AND p.cdate<${to}
      AND COALESCE(p.account_code,'') NOT IN (${inList(cny)}) AND (p.rate_buy<=1 OR p.rate_buy BETWEEN 20000 AND 30000)
    ORDER BY p.cdate, p.id`)).map((r) => ({
    ts: Math.trunc(Number(normVal(r.cdate) ?? 0)), qty: dec(r.price_cyn), rateBuy: dec(r.rate_buy), rateSell: r.rate_sell === null ? null : dec(r.rate_sell),
    codeOrder: s(r.code_order), oid: s(r.oid), cusId: s(r.cus_id), saler: s(r.saler), pid: Number(normVal(r.pid)),
  }));
  return inp;
}
function fxqAgg(res: any, part: 'usd' | 'cny'): Agg {
  const v = (x: unknown) => normVal(x);
  if (part === 'usd') {
    const u = res.usd;
    return { muaVao: v(u.muaVao), daQuyDoi: v(u.daQuyDoi), kyUsd: v(u.kyUsd), kyCny: v(u.kyCny), kyVon: v(u.kyVon), ton: v(u.ton),
      soDu: v(u.soDu), lech: v(u.lech), rows: u.rows.length, canhBao: u.canhBao.length };
  }
  const c = res.cny;
  const t = res.usdThang;
  return { cnyQty: v(c.tongQty), cnyBaoKhach: v(c.tongBaoKhach), cnyGiaVon: v(c.tongGiaVon), cnyLai: v(c.tongLai), cnyTon: v(c.ton),
    cnySoDu: v(c.soDu), cnyLech: v(c.lech), cnyRows: c.rows.length, cnyKhongRo: c.khongRo.length, cnyKhongDu: c.khongDu.length,
    utQty: v(t.tongQty), utBaoKhach: v(t.tongBaoKhach), utGiaVon: v(t.tongGiaVon), utPhi: v(t.tongPhi), utLai: v(t.tongLai),
    utRows: t.rows.length, utPhiRows: t.phi.length, utLechDonVi: t.lechDonVi.length };
}
const FXQ_KY = [
  { ky: 'T9', from: '2026-09-01', to: '2026-10-01' },
  { ky: 'T8', from: '2026-08-01', to: '2026-09-01' },
  { ky: 'ALL', from: '2020-01-01', to: '2026-10-01' },
];
function gateF(ky: (typeof FXQ_KY)[number], part: 'usd' | 'cny'): Gate {
  return {
    id: `09d-f-${part}-${ky.ky}`, doc: D09D + ' (f) · §5.3', kind: 'golden',
    title: part === 'usd'
      ? `quỹ USD FIFO kỳ ${ky.ky} — mua/quy đổi/giá vốn/tồn = số dư`
      : `quỹ CNY FIFO + USD thẳng kỳ ${ky.ky} — tệ/báo khách/giá vốn/lãi (cần Order.rateSell)`,
    async run(ctx: GateContext) {
      if (!ctx.services) return noSvc;
      const from = ep(ky.from, '00:00:00');
      const to = ep(ky.to, '00:00:00');
      const s = fxqAgg(fxqTinh(await srcFxqInput(ctx.source, from, to)), part);
      const t = fxqAgg(await ctx.services.report.quyTe(ctx.uid, from, to), part);
      const r = compareScalars(s, t);
      if (part === 'cny') {
        const nS = Number(normVal((await ctx.source.query('SELECT COUNT(*) AS c FROM tbl_order'))[0]?.c));
        const nT = Number(normVal((await ctx.target.query('SELECT COUNT(*) AS c FROM tbl_order'))[0]?.c));
        if (nS > 0 && nT === 0) {
          return { ...r, status: 'SKIPPED', info: { orderRowsSource: nS, orderRowsTarget: nT },
            reason: 'tbl_order (#06 Order.rateSell) không thuộc lô L0 — đích rỗng ⇒ mọi dòng chi tệ mất rateSell; so sau khi nạp #06 (số hai phía vẫn in để tham khảo)' };
        }
      }
      return r;
    },
  };
}

// ───────────────────────────────────────────────────────── (g) đối soát bank
type SrcDebit = { id: number; amount: Dec; date: number; content: string | null; cdate: number };
type SrcDoc = { module: string; id: number; amount: Dec; date: number };
const toDebit = (r: Row): SrcDebit => {
  const cdate = Math.trunc(Number(normVal(r.cdate) ?? 0));
  return { id: Number(normVal(r.id)), amount: dec(r.tran_amount), date: vnMidnight(cdate), content: r.tran_mess as string | null, cdate };
};
const toDoc = (r: Row): SrcDoc => ({
  module: String(r.source_module), id: Math.trunc(Number(normVal(r.source_id))), amount: dec(r.money).abs(),
  date: vnMidnight(Math.trunc(Number(normVal(r.cdate) ?? 0))),
});
const DOC_SQL = (where: string) => `SELECT h.id AS hid, h.source_module, h.source_id, h.money, h.cdate FROM tbl_account_histories h
  WHERE h.tk_code='TK01' AND h.type IN ('out','tranfer') AND ${where}`;
async function srcRecon(db: QueryDb, fd: number, td: number, win: number) {
  const deb = (await db.query(`SELECT id, tranAmount AS tran_amount, cdate, tranMess AS tran_mess FROM tbl_bank_transaction
    WHERE tk_code='TK01' AND tranType='-' AND status<>'huy' AND cdate BETWEEN ${fd} AND ${td} ORDER BY cdate, id`)).map(toDebit);
  const debIds = new Set(deb.map((b) => b.id));
  const docs = (await db.query(DOC_SQL(`h.cdate BETWEEN ${fd - win * 86400} AND ${td + win * 86400} ORDER BY h.id`))).map(toDoc);
  const seen = new Set(docs.map((d) => d.module + '#' + d.id));
  const links = new Map<number, ReconLink>();
  const need = new Map<string, [string, number]>();
  const lk = deb.length
    ? await db.query(`SELECT bank_tran_id, doc_module, doc_id, match_type, note FROM tbl_bank_reconcile_link WHERE bank_tran_id IN (${[...debIds].join(',')}) ORDER BY id`)
    : [];
  for (const r of lk) {
    const bid = Number(normVal(r.bank_tran_id));
    if (!debIds.has(bid)) continue;
    const l: ReconLink = { matchType: String(r.match_type), docModule: String(r.doc_module), docId: Number(normVal(r.doc_id)), note: String(r.note ?? '') };
    links.set(bid, l);
    if (l.matchType === 'manual' && l.docModule !== '' && l.docId > 0) {
      const k = l.docModule + '#' + l.docId;
      if (!seen.has(k)) need.set(k, [l.docModule, l.docId]);
    }
  }
  for (const [m, sid] of need.values()) {
    const [rr] = await db.query(DOC_SQL(`h.source_module='${m.replace(/[^a-z0-9_]/gi, '')}' AND h.source_id=${Math.trunc(sid)} ORDER BY h.cdate DESC, h.id DESC LIMIT 1`));
    if (rr) docs.push(toDoc(rr));
  }
  return bankReconMatch(deb, docs, links, win);
}
function reconAgg(rows: { status: string }[], orphan: { module: string }[], totals: { bank: unknown; matched: unknown; unmatched: unknown }): Agg {
  const n = (st: string) => rows.filter((r) => r.status === st).length;
  const o = (m: string) => orphan.filter((d) => d.module === m).length;
  return { rows: rows.length, matched: n('matched'), manual: n('manual'), unmatched: n('unmatched'), ignore: n('ignore'),
    bank: normVal(totals.bank), totMatched: normVal(totals.matched), totUnmatched: normVal(totals.unmatched), orphanDocs: orphan.length,
    orphanThuChiTbs: o('thu_chi_tbs'), orphanFxTransfer: o('fx_transfer'), orphanKhac: orphan.length - o('thu_chi_tbs') - o('fx_transfer') };
}
const gateG: Gate = {
  id: '09d-g-recon', doc: D09D + ' (g) · §7.1', kind: 'golden',
  title: 'reconList TK01 01/09–25/09 (cửa sổ 3 ngày) — matched/manual/unmatched, tổng tiền, chứng từ mồ côi',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const fd = ep('2026-09-01', '00:00:00');
    const td = ep('2026-09-25', '23:59:59');
    const s = await srcRecon(ctx.source, fd, td, 3);
    const t = await ctx.services.recon.reconList(ctx.uid, fd, td, 3);
    return compareScalars(reconAgg(s.rows, s.orphanDocs, s.totals), reconAgg(t.rows, t.orphanDocs, t.totals));
  },
};
const gateG2: Gate = {
  id: '09d-g-fxunacc', doc: D09D + ' (g) · §7.2', kind: 'golden',
  title: 'fx_unaccounted 60 ngày tới giờ dump — rút quỹ tiền mặt / thiếu chứng từ chuyển nội bộ / chờ soát',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const td = Math.floor(ctx.now.getTime() / 1000);
    const fd = td - 60 * 86400;
    const deb = (await ctx.source.query(`SELECT id, tranAmount AS tran_amount, cdate, tranMess AS tran_mess FROM tbl_bank_transaction
      WHERE tk_code='TK01' AND tranType='-' AND status<>'huy' AND cdate BETWEEN ${fd} AND ${td} ORDER BY cdate DESC, id DESC`)).map(toDebit);
    const docs = (await ctx.source.query(DOC_SQL(`h.cdate BETWEEN ${fd - 3 * 86400} AND ${td + 3 * 86400} ORDER BY h.id`))).map(toDoc);
    const linked = new Set((await ctx.source.query('SELECT bank_tran_id FROM tbl_bank_reconcile_link')).map((r) => Number(normVal(r.bank_tran_id))));
    const anchored = new Set((await ctx.source.query('SELECT bank_tran_id FROM tbl_fx_transfers WHERE bank_tran_id>0')).map((r) => Number(normVal(r.bank_tran_id))));
    let cashN = 0;
    let cash = new Decimal(0);
    let trans = new Decimal(0);
    let revN = 0;
    let rev = new Decimal(0);
    for (const b of deb) {
      const cat = bankReconDebitCat(b.content);
      if (cat === 'cash') { cashN++; cash = cash.plus(b.amount); }
      else if (cat === 'transfer') trans = trans.plus(b.amount);
      else if (!linked.has(b.id) && !anchored.has(b.id)) { revN++; rev = rev.plus(b.amount); }
    }
    let transDoc = new Decimal(0);
    for (const d of docs) if (d.module === 'fx_transfer') transDoc = transDoc.plus(d.amount);
    const short = Decimal.max(0, trans.minus(transDoc));
    const t = await ctx.services.recon.fxUnaccounted(ctx.uid, ctx.now);
    return compareScalars(
      { cashCount: cashN, cashTotal: cash, transferShort: short, reviewCount: revN, reviewTotal: rev },
      { cashCount: t.cashCount, cashTotal: t.cashTotal, transferShort: t.transferShort, reviewCount: t.reviewCount, reviewTotal: t.reviewTotal },
    );
  },
};

// ───────────────────────────────────────────────────────── (h) rà trùng
function dupAgg(clusters: { rows: { sourceModule: string }[] }[]): Agg {
  const a: Agg = { clusters: clusters.length, rows: clusters.reduce((x, c) => x + c.rows.length, 0) };
  const mods = new Map<string, number>();
  for (const c of clusters) for (const r of c.rows) mods.set(r.sourceModule, (mods.get(r.sourceModule) ?? 0) + 1);
  for (const [m, n] of [...mods.entries()].sort()) a['rows_' + (m === '' ? "''" : m)] = n;
  return a;
}
function gateH(label: string, fromYmd: string | null, toYmd: string | null): Gate {
  return {
    id: `09d-h-${label}`, doc: D09D + ' (h) · §7.3', kind: 'golden',
    title: `rà trùng clusterSuspectDuplicates (30 phút) — ${label === '7d' ? '7 ngày 19/09–25/09' : 'toàn bộ'}: số cụm, số dòng, theo module`,
    async run(ctx) {
      if (!ctx.services) return noSvc;
      const f = fromYmd ? ep(fromYmd, '00:00:00') : 0;
      const t = toYmd ? ep(toYmd, '23:59:59') : 0;
      const w = ['h.money<>0'];
      if (f > 0) w.push(`h.cdate>=${f}`);
      if (t > 0) w.push(`h.cdate<=${t}`);
      const rows = (await ctx.source.query(`SELECT h.id, h.tk_code, h.money, h.cdate, h.source_module FROM tbl_account_histories h WHERE ${w.join(' AND ')} ORDER BY h.tk_code, h.cdate, h.id`))
        .map((r) => ({ tkCode: r.tk_code as string | null, money: dec(r.money), cdate: r.cdate === null ? null : Number(normVal(r.cdate)), sourceModule: String(r.source_module) }));
      const s = dupAgg(clusterSuspectDuplicates(rows, 30).map((c) => ({ rows: c })));
      const tg = dupAgg(await ctx.services.report.suspectDuplicates(ctx.uid, '', f, t, 30));
      return compareScalars(s, tg);
    },
  };
}

// ───────────────────────────────────────────────────────── (i) ngày 31
const gateI: Gate = {
  id: '09d-i', doc: D09D + ' (i) · §3.3 (P-FL2, Q-DOC-3)', kind: 'golden',
  title: 'monthlyFlow ngày 31/10/2026 ⇒ 6 tháng KHÁC nhau (v2 sửa P-FL2; nhãn prod ở info)',
  async run(ctx) {
    if (!ctx.services) return noSvc;
    const at = new Date('2026-10-31T03:00:00Z'); // 10:00 giờ VN
    const prod = new Set(phpMonthLabels(at, 6)).size;
    const t = (await ctx.services.report.monthlyFlow(ctx.uid, 6, at)).thang.map((x) => x.ym);
    const distinct = new Set(t).size;
    return {
      status: distinct === 6 && t.length === 6 ? 'PASS' : 'FAIL',
      source: { expectedDistinctMonths: 6 },
      target: { distinctMonths: distinct, months: t.length },
      diff: { distinctMonths: distinct - 6 },
      info: { prodDistinctMonths: prod },
    };
  },
};

export const GOLDEN_GATES: readonly Gate[] = [
  gateA, gateA2, gateB, gateC, gateC2, gateD('po_id'), gateD('container_id'), gateE,
  ...FXQ_KY.flatMap((k) => [gateF(k, 'usd'), gateF(k, 'cny')]),
  gateG, gateG2, gateH('7d', '2026-09-19', '2026-09-25'), gateH('all', null, null), gateI,
];
