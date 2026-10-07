// src/money/fx-quyte.ts
//
// #09d L11, Task 3 (R8d) — LÕI báo cáo lợi nhuận quỹ ngoại tệ `/report/quy-te`. HÀM THUẦN: không CSDL,
// không I/O, không đồng hồ. Đặc tả docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §5.3.
// Nguồn nguyên văn: prod `libs/fx_quyte.php` @1894f76 (`fxq_dai`, `fxq_tong`, `fxq_tieu`, `fxq_sap`,
// `fxq_tinh`) — bản chép tại .superpowers/sdd/2026-09-25-09d-L11-doc-so-quy-plan/prod-src/.
//
// Ba đường tiền (chép chú thích prod):
//   A. tệ qua agent — USD mua vào → agent đổi sang tệ → trả NCC từ ví CNY. Giá vốn tệ FIFO; tồn đầu kỳ
//      + tệ vào không qua phiếu FX là lô KHÔNG rõ giá vốn (rate = null).
//   B. NCC nhận thẳng USD — giá vốn = rate_buy thật từng lệnh, không FIFO.
//   C. phí NH (rate_buy <= 1; price_cyn là SỐ VND) — trừ vào lãi đơn báo USD.
//
// Port sang Decimal: MỌI ngưỡng float của prod giữ NGUYÊN giá trị (0,0001 · 1,0 USD · 3.000–6.000 ·
// 20.000–30.000) và NGUYÊN chiều so sánh (`<=`/`<`/`>`). Khác duy nhất: phép tính không còn sai số float
// (prod lệch ở chữ số thứ ~15); phép chia (giá vốn/đơn vị) theo độ chính xác 20 chữ số của Prisma.Decimal.
//
// Kỳ lọc CHỈ ảnh hưởng phần HIỂN THỊ; FIFO luôn chạy trên TOÀN BỘ lịch sử (như prod).
import { Prisma } from '@prisma/client';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;
type DecLike = Dec | string | number | null | undefined;

/** `FXQ_DUNG_SAI_USD` — thiếu USD ≤ 1 thì bù bằng tỷ giá lô cuối. */
export const FXQ_DUNG_SAI_USD = new Decimal('1.0');
/** Ngưỡng "coi như 0" của prod (`0.0001`, số float) — giữ đúng giá trị. */
const EPS = new Decimal('0.0001');
const ZERO = new Decimal(0);

/** PHP `floatval()` cho tiền/tỷ giá → Decimal (null/rỗng/không phải số ⇒ 0). */
function dec(v: DecLike): Dec {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  try {
    return new Decimal(v as any);
  } catch {
    return new Decimal(0);
  }
}

/** `fxq_dai($rate)` — phân loại theo DẢI tỷ giá (không tin cột currency, xem chú thích prod). */
export function fxqDai(rate: DecLike): 'cny' | 'usd' | '' {
  const r = dec(rate);
  if (r.gte(3000) && r.lte(6000)) return 'cny';
  if (r.gte(20000) && r.lte(30000)) return 'usd';
  return '';
}

export interface FxqLot {
  qty: Dec;
  /** null = lô KHÔNG rõ giá vốn (tồn đầu kỳ, tệ vào ngoài phiếu FX, quy đổi không có giá vốn). */
  rate: Dec | null;
}

/** `fxq_tong($lots)` */
export function fxqTong(lots: FxqLot[]): Dec {
  let s = new Decimal(0);
  for (const l of lots) s = s.plus(l.qty);
  return s;
}

/**
 * `fxq_tieu(&$lots, $need)` — tiêu FIFO đúng `need` (người gọi đã chắc đủ). SỬA TẠI CHỖ mảng `lots`
 * (như tham chiếu `&$lots` của prod). Trả [giá vốn, có_chạm_lô_không_rõ, tỷ_giá_lô_cuối].
 * Lô không rõ giá: bật cờ, KHÔNG cộng giá vốn và KHÔNG đổi "tỷ giá lô cuối".
 */
export function fxqTieu(lots: FxqLot[], need: Dec): [Dec, boolean, Dec | null] {
  let cost = new Decimal(0);
  let khongRo = false;
  let last: Dec | null = null;
  let n = new Decimal(need);
  while (n.gt(EPS) && lots.length > 0) {
    const take = Decimal.min(n, lots[0].qty);
    if (lots[0].rate === null) khongRo = true;
    else {
      cost = cost.plus(take.times(lots[0].rate));
      last = lots[0].rate;
    }
    lots[0].qty = lots[0].qty.minus(take);
    n = n.minus(take);
    if (lots[0].qty.lte(EPS)) lots.shift();
  }
  return [cost, khongRo, last];
}

interface Ev<T> {
  ts: number;
  ord: number;
  seq: number;
  k: 'lot' | 'qd' | 'ra';
  d: T;
}
/** `fxq_sap` — theo ts, rồi ord (lô 0 · quy đổi 1 · chi 2), rồi thứ tự nạp (seq). */
function fxqSap(a: Ev<unknown>, b: Ev<unknown>): number {
  if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  if (a.ord !== b.ord) return a.ord - b.ord;
  return a.seq - b.seq;
}

// ── Đầu vào (đúng khoá của `fxq_doc_du_lieu`) ──────────────────────────────────────────────────────
export interface FxqUsdLot { ts: number; qty: DecLike; rate: DecLike }
export interface FxqQuyDoi { ts: number; fxId?: number; code?: string; note?: string; usd: DecLike; cny: DecLike; agentRate?: DecLike }
export interface FxqCnyLot { ts: number; qty: DecLike; rate: DecLike }
export interface FxqCnyVaoKhac { ts: number; qty: DecLike }
export interface FxqCnyRa {
  ts: number;
  qty: DecLike;
  /** phiếu chi `status/payment/confirm` đều 'yes' */
  ok: boolean;
  rateSell: DecLike;
  codeOrder?: string;
  oid?: string;
  cusId?: string;
  saler?: string;
  pid?: number;
}
export interface FxqUsdThang {
  ts: number;
  qty: DecLike;
  rateBuy: DecLike;
  rateSell: DecLike;
  codeOrder?: string;
  oid?: string;
  cusId?: string;
  saler?: string;
  pid?: number;
}
export interface FxqInput {
  from: number;
  /** KHÔNG tính (`ts < to`) */
  to: number;
  usdLots: FxqUsdLot[];
  quydoi: FxqQuyDoi[];
  cnyLots: FxqCnyLot[];
  cnyMoDau: DecLike;
  cnyVaoKhac: FxqCnyVaoKhac[];
  cnyRa: FxqCnyRa[];
  usdThang: FxqUsdThang[];
  usdKhac: DecLike;
  soDuCny: DecLike;
  soDuUsd: DecLike;
}

// ── Đầu ra ────────────────────────────────────────────────────────────────────────────────────────
export interface FxqQuyDoiRow {
  ts: number;
  fxId: number;
  code: string;
  note: string;
  usd: Dec;
  cny: Dec;
  agentRate: Dec;
  costVnd: Dec | null;
  vndUsd: Dec | null;
  vndCny: Dec | null;
  thieuUsd: Dec;
  coGiaVon: boolean;
}
export interface FxqCnyRow {
  ts: number;
  codeOrder: string;
  oid: string;
  cusId: string;
  saler: string;
  pid: number;
  qty: Dec;
  rateSell: Dec;
  rateMua: Dec;
  baoKhach: Dec;
  giaVon: Dec;
  lai: Dec;
  /** lấy giá vốn (một phần) từ lô về SAU lệnh chi (sửa 25/09 "lô mới trả nợ trước") */
  vay: boolean;
}
export interface FxqUsdThangRow {
  ts: number;
  codeOrder: string;
  oid: string;
  cusId: string;
  saler: string;
  pid: number;
  qty: Dec;
  rateSell: Dec;
  rateMua: Dec;
  baoKhach: Dec;
  giaVon: Dec;
  lai: Dec;
}
export interface FxqResult {
  usd: {
    muaVao: Dec;
    daQuyDoi: Dec;
    rows: FxqQuyDoiRow[];
    /** mọi lần quy đổi KHÔNG có giá vốn — cả lịch sử, không chỉ trong kỳ (như prod) */
    canhBao: FxqQuyDoiRow[];
    kyUsd: Dec;
    kyCny: Dec;
    kyVon: Dec;
    ton: Dec;
    soDu: Dec;
    lech: Dec;
  };
  cny: {
    rows: FxqCnyRow[];
    khongRo: FxqCnyRa[];
    khongDu: FxqCnyRa[];
    tongQty: Dec;
    tongBaoKhach: Dec;
    tongGiaVon: Dec;
    tongLai: Dec;
    ton: Dec;
    soDu: Dec;
    lech: Dec;
  };
  usdThang: {
    rows: FxqUsdThangRow[];
    phi: FxqUsdThang[];
    lechDonVi: FxqUsdThang[];
    tongQty: Dec;
    tongBaoKhach: Dec;
    tongGiaVon: Dec;
    tongPhi: Dec;
    tongLai: Dec;
  };
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);

/** `fxq_tinh($in)` — nguyên văn thuật toán prod (`:39-145`). */
export function fxqTinh(inp: FxqInput): FxqResult {
  const from = Math.trunc(inp.from);
  const to = Math.trunc(inp.to);
  const trongKy = (ts: number) => ts >= from && ts < to;

  // ---------- 1. Hàng đợi USD → các lần quy đổi ----------
  let ev: Ev<any>[] = [];
  let seq = 0;
  for (const l of inp.usdLots) ev.push({ ts: Math.trunc(l.ts), ord: 0, seq: seq++, k: 'lot', d: l });
  for (const q of inp.quydoi) ev.push({ ts: Math.trunc(q.ts), ord: 1, seq: seq++, k: 'qd', d: q });
  ev.sort(fxqSap);
  let lots: FxqLot[] = [];
  let lastRate: Dec | null = null;
  const lotTe: { ts: number; qty: Dec; rate: Dec | null }[] = [];
  const U: FxqResult['usd'] = {
    muaVao: new Decimal(0), daQuyDoi: new Decimal(0), rows: [], canhBao: [],
    kyUsd: new Decimal(0), kyCny: new Decimal(0), kyVon: new Decimal(0),
    ton: ZERO, soDu: ZERO, lech: ZERO,
  };
  for (const e of ev) {
    if (e.k === 'lot') {
      const l = e.d as FxqUsdLot;
      lots.push({ qty: dec(l.qty), rate: dec(l.rate) }); // lô USD luôn có giá (floatval, không null)
      U.muaVao = U.muaVao.plus(dec(l.qty));
      continue;
    }
    const q = e.d as FxqQuyDoi;
    const usd = dec(q.usd);
    const cny = dec(q.cny);
    U.daQuyDoi = U.daQuyDoi.plus(usd);
    const co = fxqTong(lots);
    let thieu = Decimal.max(ZERO, usd.minus(co));
    let cost: Dec | null = null;
    if (thieu.lte(EPS)) {
      const [c, , lr] = fxqTieu(lots, usd);
      cost = c;
      thieu = new Decimal(0);
      if (lr !== null) lastRate = lr;
    } else if (thieu.lte(FXQ_DUNG_SAI_USD)) {
      const [c, , lr] = fxqTieu(lots, co);
      if (lr !== null) lastRate = lr;
      if (lastRate !== null) cost = c.plus(thieu.times(lastRate));
    }
    // thiếu > 1 USD: KHÔNG tiêu lô nào (lô còn nguyên cho lần sau), giá vốn null — chép prod.
    const row: FxqQuyDoiRow = {
      ts: e.ts, fxId: int(q.fxId), code: str(q.code), note: str(q.note),
      usd, cny, agentRate: dec(q.agentRate), costVnd: cost,
      vndUsd: cost !== null && usd.gt(0) ? cost.div(usd) : null,
      vndCny: cost !== null && cny.gt(0) ? cost.div(cny) : null,
      thieuUsd: thieu, coGiaVon: cost !== null,
    };
    if (cost === null) U.canhBao.push(row);
    lotTe.push({ ts: e.ts, qty: cny, rate: row.vndCny });
    if (trongKy(e.ts)) {
      U.rows.push(row);
      U.kyUsd = U.kyUsd.plus(usd);
      U.kyCny = U.kyCny.plus(cny);
      if (cost !== null) U.kyVon = U.kyVon.plus(cost);
    }
  }
  U.ton = U.muaVao.minus(U.daQuyDoi).plus(dec(inp.usdKhac));
  U.soDu = dec(inp.soDuUsd);
  U.lech = U.ton.minus(U.soDu);

  // ---------- 2. Hàng đợi tệ ----------
  ev = [];
  seq = 0;
  let tonTe = new Decimal(0);
  const moDau = dec(inp.cnyMoDau);
  tonTe = tonTe.plus(moDau); // cộng cả khi mở đầu ÂM (chỉ lô mới cần > 0)
  if (moDau.gt(0)) ev.push({ ts: Number.NEGATIVE_INFINITY, ord: 0, seq: seq++, k: 'lot', d: { qty: moDau, rate: null } });
  for (const l of inp.cnyLots) {
    ev.push({ ts: Math.trunc(l.ts), ord: 0, seq: seq++, k: 'lot', d: { qty: dec(l.qty), rate: dec(l.rate) } });
    tonTe = tonTe.plus(dec(l.qty));
  }
  for (const l of lotTe) {
    ev.push({ ts: Math.trunc(l.ts), ord: 0, seq: seq++, k: 'lot', d: l });
    tonTe = tonTe.plus(l.qty);
  }
  for (const l of inp.cnyVaoKhac) {
    ev.push({ ts: Math.trunc(l.ts), ord: 0, seq: seq++, k: 'lot', d: { qty: dec(l.qty), rate: null } });
    tonTe = tonTe.plus(dec(l.qty));
  }
  for (const x of inp.cnyRa) {
    ev.push({ ts: Math.trunc(x.ts), ord: 2, seq: seq++, k: 'ra', d: x });
    tonTe = tonTe.minus(dec(x.qty));
  }
  ev.sort(fxqSap);
  lots = [];
  const no: number[] = [];
  const kqRa: { x: FxqCnyRa; need: Dec; cost: Dec; khongRo: boolean; vay: boolean; hien: boolean; thieu: Dec }[] = [];
  const C: FxqResult['cny'] = {
    rows: [], khongRo: [], khongDu: [],
    tongQty: new Decimal(0), tongBaoKhach: new Decimal(0), tongGiaVon: new Decimal(0), tongLai: new Decimal(0),
    ton: ZERO, soDu: ZERO, lech: ZERO,
  };
  for (const e of ev) {
    if (e.k === 'lot') {
      const lot: FxqLot = { qty: dec(e.d.qty), rate: e.d.rate === null ? null : dec(e.d.rate) };
      // 25/09/2026 (huytbs duyệt): lô mới về TRẢ NỢ trước — lệnh chi đi TRƯỚC khi lập phiếu mua lấy giá
      // vốn của lô mua NGAY SAU. Nợ trả theo thứ tự thời gian của lệnh chi.
      while (lot.qty.gt(EPS) && no.length) {
        const k = no[0];
        const take = Decimal.min(kqRa[k].thieu, lot.qty);
        if (lot.rate === null) kqRa[k].khongRo = true;
        else kqRa[k].cost = kqRa[k].cost.plus(take.times(lot.rate));
        kqRa[k].thieu = kqRa[k].thieu.minus(take);
        lot.qty = lot.qty.minus(take);
        kqRa[k].vay = true;
        if (kqRa[k].thieu.lte(EPS)) {
          kqRa[k].thieu = new Decimal(0);
          no.shift();
        }
      }
      if (lot.qty.gt(EPS)) lots.push(lot);
      continue;
    }
    const x = e.d as FxqCnyRa;
    const need = dec(x.qty);
    const hien = trongKy(e.ts) && !!x.ok && fxqDai(x.rateSell ?? 0) === 'cny';
    const co = Decimal.min(need, fxqTong(lots));
    const [cost, khongRo] = fxqTieu(lots, co);
    const k = kqRa.length;
    kqRa.push({ x, need, cost, khongRo, vay: false, hien, thieu: Decimal.max(ZERO, need.minus(co)) });
    if (kqRa[k].thieu.gt(EPS)) no.push(k);
    else kqRa[k].thieu = new Decimal(0);
  }
  for (const q of kqRa) {
    if (!q.hien) continue;
    const { x, need, cost } = q;
    if (q.thieu.gt(EPS)) { C.khongDu.push(x); continue; } // cả lô mua sau cũng không bù đủ ⇒ ví tệ âm thật
    if (q.khongRo) { C.khongRo.push(x); continue; }
    const rs = dec(x.rateSell);
    const bao = need.times(rs);
    C.rows.push({
      ts: Math.trunc(x.ts), codeOrder: str(x.codeOrder), oid: str(x.oid), cusId: str(x.cusId), saler: str(x.saler), pid: int(x.pid),
      qty: need, rateSell: rs, rateMua: need.gt(0) ? cost.div(need) : new Decimal(0),
      baoKhach: bao, giaVon: cost, lai: bao.minus(cost), vay: q.vay,
    });
    C.tongQty = C.tongQty.plus(need);
    C.tongBaoKhach = C.tongBaoKhach.plus(bao);
    C.tongGiaVon = C.tongGiaVon.plus(cost);
    C.tongLai = C.tongLai.plus(bao.minus(cost));
  }
  C.ton = tonTe;
  C.soDu = dec(inp.soDuCny);
  C.lech = C.ton.minus(C.soDu);

  // ---------- 3. Đơn báo USD — NCC nhận thẳng USD ----------
  const B: FxqResult['usdThang'] = {
    rows: [], phi: [], lechDonVi: [],
    tongQty: new Decimal(0), tongBaoKhach: new Decimal(0), tongGiaVon: new Decimal(0), tongPhi: new Decimal(0), tongLai: new Decimal(0),
  };
  for (const p of inp.usdThang) {
    const rb = dec(p.rateBuy);
    const qty = dec(p.qty);
    const dai = fxqDai(p.rateSell ?? 0);
    const laPhi = rb.lte(1);
    if (!laPhi && fxqDai(rb) !== 'usd') continue;
    if (dai === 'cny') { B.lechDonVi.push(p); continue; } // kể cả dòng phí — thứ tự kiểm như prod
    if (dai !== 'usd') continue; // chưa gắn đơn / ngoài dải: khối cũ lo
    if (laPhi) { B.phi.push(p); B.tongPhi = B.tongPhi.plus(qty); continue; }
    const rs = dec(p.rateSell);
    const bao = qty.times(rs);
    const gv = qty.times(rb);
    B.rows.push({
      ts: Math.trunc(p.ts), codeOrder: str(p.codeOrder), oid: str(p.oid), cusId: str(p.cusId), saler: str(p.saler), pid: int(p.pid),
      qty, rateSell: rs, rateMua: rb, baoKhach: bao, giaVon: gv, lai: bao.minus(gv),
    });
    B.tongQty = B.tongQty.plus(qty);
    B.tongBaoKhach = B.tongBaoKhach.plus(bao);
    B.tongGiaVon = B.tongGiaVon.plus(gv);
    B.tongLai = B.tongLai.plus(bao.minus(gv));
  }
  B.tongLai = B.tongLai.minus(B.tongPhi);

  return { usd: U, cny: C, usdThang: B };
}
