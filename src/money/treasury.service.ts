// src/money/treasury.service.ts
//
// 09b đợt 1 — SỔ QUỸ CÔNG TY (port `CLS_TREASURY`, prod `libs/cls.treasury.php` @9ea8b15).
// Đặc tả: docs/rewrite-spec/09b-so-quy-treasury.md §3, §5.1, §5.2, §5.6, §10.2, §12;
//         docs/rewrite-spec/09a-thanh-toan-ncc.md §6.1, §11.
//
// ⛔ Ranh giới: đây là ví QUỸ (tbl_accounts / tbl_account_histories), KHÔNG phải ví KHÁCH (#03).
//    Ví quỹ ĐƯỢC ÂM (Q12, prod TK02 −170.936,87 ¥) — không có chốt không-âm nào ở đây, và tệp này
//    không được import/gọi dịch vụ ví khách hay mượn/nới hằng dung sai âm của nó (test grep canh).
// ⛔ Chưa có đường ghi sống nào gọi vào đây ở đợt 1 (đặc tả §11.3 — cutover một ngày).
//
// Tiền: Prisma.Decimal suốt, không `number`. Không chép P8 của prod (`(string)float` precision=14).
import { Injectable } from '@nestjs/common';
import { FundAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';
import { numberFormatVn, viPhiFx } from './fx-rules';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;
type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type TreasuryType = 'in' | 'out' | 'tranfer'; // 'tranfer' (sic) — KHOÁ lọc báo cáo, §12.1

export interface PostEntryOpts {
  gout?: string;
  note?: string;
  rate?: Dec | string;
  cdate?: number;
  cuser?: string;
  /** Mặc định 0 như prod (`:580`) — 0 = treo, KHÔNG vào số dư. */
  status?: number;
  approveUser?: string;
  sourceModule?: string;
  sourceId?: number;
  cusId?: string;
  poId?: number;
  containerId?: number;
  orderCode?: string;
  reversalOf?: number;
  reversalCode?: string;
  reversalReason?: string;
  refRequestId?: number;
}

export interface DaoTheoNguonResult {
  /** Số dòng status=1 tìm thấy theo (module, sourceId) — prod `so_dong`. */
  soDong: number;
  /** Số dòng đảo ghi MỚI trong lần gọi này — prod `da_dao`. */
  daDao: number;
  /** Chuỗi mô tả như prod (`TK01 +54.847.800,00, …`). */
  moTa: string;
  /** Id mọi dòng GỐC status=1 của nguồn (kể cả dòng đã đảo từ trước). */
  idsGoc: number[];
  /** Id dòng gốc được đảo TRONG lần gọi này (chạy lại ⇒ rỗng). */
  idsDaDao: number[];
  /**
   * Việc đảo GL NGƯỜI GỌI phải chạy SAU commit (`GlMapService`/`GlService`, ngoài tx — T10).
   * Chép `cls.treasury.php:540-551`: thu_chi_tbs ⇒ ('appr_request', id PHIẾU); fx_transfer/fx_fee/
   * fx_quydoi ⇒ theo TỪNG id dòng gốc (fx_quydoi dùng nguồn GL 'fx_transfer'); còn lại ⇒ không đảo GL.
   */
  glDao: { sourceType: string; sourceId: number }[];
}

/** `mb_substr($s, 0, n)` — cắt theo KÝ TỰ (code point), không theo byte/UTF-16. */
function mbSubstr(s: string, n: number): string {
  return Array.from(s).slice(0, n).join('');
}

/** `tbs_money($n)` (`gffunc.php:745`) = `number_format($n, 0, ',', '.')` — dùng bộ định dạng chung. */
function tbsMoney(x: Dec): string {
  return numberFormatVn(x, 0);
}

/** Truthiness chuỗi của PHP: '' và '0' là falsy (ghi chú `$fx['note'] ? … : ''`). */
function phpTruthyStr(s: string | null | undefined): s is string {
  return s !== null && s !== undefined && s !== '' && s !== '0';
}

/** Ngày hôm nay theo giờ prod (`date.timezone=Asia/Ho_Chi_Minh`, UTC+7, không DST) — cho cột DATE. */
function todayVnAsUtcDate(): Date {
  const ymd = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return new Date(`${ymd}T00:00:00Z`);
}

const GL_DAO_FX: Record<string, string> = { fx_transfer: 'fx_transfer', fx_fee: 'fx_fee', fx_quydoi: 'fx_transfer' };

/** Lỗi nghiệp vụ sổ quỹ — NÉM ra ⇒ tx của người gọi lùi toàn bộ (thay DELETE của prod, P-FX2). */
export class TreasuryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'TreasuryError';
    if (options && 'cause' in options) (this as { cause?: unknown }).cause = options.cause;
  }
}

/**
 * Việc GL NGƯỜI GỌI chạy SAU commit (09c §10.2) — transfer()/fxGhiSoPhieu() KHÔNG gọi GL.
 * Nguồn GL chuyển ví = id DÒNG SỔ chân nguồn `outId` (bẫy §12.2), phí = `feeId`.
 * Chỉ sinh khi quy ra VND được mà KHÔNG cần bảng tỷ giá (ví VND): GL FX ngoại tệ phụ thuộc Q11 —
 * không làm ở lô này (prod: bảng tỷ giá rỗng ⇒ toVnd ngoại tệ = NULL ⇒ bỏ qua, đo 0 bút toán).
 */
export type GlTodo =
  | { kind: 'chuyenVi'; outId: number; from: string; to: string; outVnd: Dec; inVnd: Dec }
  | { kind: 'fxPhi'; feeId: number; feeTk: string; feeVnd: Dec; cur: string; amountCcy: Dec };

export interface TransferOpts {
  /**
   * Có ⇒ HAI chân (nguồn + đích) ghi THẲNG nhãn này, KHÔNG qua hasPosted từng dòng (bẫy §0.3/§12.1:
   * khử trùng theo (module, source_id) sẽ nuốt chân thứ hai). Khoá idempotency do NGƯỜI GỌI giữ.
   * Không có ⇒ chép prod: nguồn source_module '' / đích 'transfer' + outId.
   */
  label?: { module: string; sourceId: number };
  fee?: Dec | string;
  feeTk?: string;
  feeNote?: string;
  feeModule?: string;
  feeSourceId?: number;
  /** Bỏ chốt số dư ví NGUỒN — KHÔNG bỏ chốt phí-ở-ví-đích (F13/§12.6). */
  choAm?: boolean;
}

export interface TransferResult {
  outId: number;
  inId: number;
  /** 0 khi không có phí. */
  feeId: number;
  glTodo: GlTodo[];
}

export interface FxGhiSoResult {
  chang1: 'moi' | 'da_co';
  chang2: 'khong' | 'da_co' | 'moi';
  /** round(amount_in × agent_rate, 2) — null khi không có chặng 2. */
  agentAmount: Dec | null;
  glTodo: GlTodo[];
}

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService) {}

  /** `getAccount($code)` (`:97-101`) — không lọc is_active. */
  async getAccount(code: string, tx?: Tx): Promise<FundAccount | null> {
    const db: Db = tx ?? this.prisma;
    return db.fundAccount.findUnique({ where: { code } });
  }

  /** `getBalance($code)` (`:173-181`) = opening_balance + Σmoney(status=1) — T1/Q1. */
  async getBalance(code: string, tx?: Tx): Promise<Dec> {
    const db: Db = tx ?? this.prisma;
    const s = await db.treasuryEntry.aggregate({ _sum: { money: true }, where: { tkCode: code, status: 1 } });
    const a = await db.fundAccount.findUnique({ where: { code }, select: { openingBalance: true } });
    return new Decimal(s._sum.money ?? 0).plus(a?.openingBalance ?? 0);
  }

  /**
   * `getBalances()` (`:163-171`): khởi tạo từ tbl_accounts (opening), rồi CỘNG Σ(status=1) theo tk_code.
   * Chép nguyên: tk_code không có trong danh mục mà có dòng status=1 cũng được cộng vào khoá riêng
   * (prod hiện không có — CHI-TBS chỉ có dòng status 9).
   */
  async getBalances(tx?: Tx): Promise<Map<string, Dec>> {
    const db: Db = tx ?? this.prisma;
    const rs = new Map<string, Dec>();
    const accs = await db.fundAccount.findMany({ select: { code: true, openingBalance: true }, orderBy: { id: 'asc' } });
    for (const a of accs) rs.set(a.code, new Decimal(a.openingBalance));
    const sums = await db.treasuryEntry.groupBy({ by: ['tkCode'], where: { status: 1 }, _sum: { money: true } });
    for (const r of sums) {
      const k = r.tkCode ?? '';
      rs.set(k, (rs.get(k) ?? new Decimal(0)).plus(r._sum.money ?? 0));
    }
    return rs;
  }

  /**
   * `hasPosted($module, $source_id)` (`:413-421`) — SQL y hệt prod:
   * KHÔNG lọc status (dòng 0/9 vẫn "đã ghi" — §12.2), dòng bị một dòng khác `reversal_of` trỏ tới
   * coi là CHƯA ghi (thiết kế "mở lại → đảo → duyệt lại"). Trả id dòng, 0 nếu chưa.
   */
  async hasPosted(tx: Tx, module: string, sourceId: number): Promise<number> {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT h.id FROM tbl_account_histories h
       WHERE h.source_module = ${module} AND h.source_id = ${Math.trunc(sourceId)}
         AND NOT EXISTS (SELECT 1 FROM tbl_account_histories r WHERE r.reversal_of = h.id)
       ORDER BY h.id
       LIMIT 1`;
    return rows.length ? Number(rows[0].id) : 0;
  }

  /**
   * `postEntry($tk, $type, $money, $opts)` (`:565-605`).
   * money = |money|; <= 0 ⇒ 0 (không ghi); out/tranfer ⇒ lưu ÂM.
   * Có (module, sourceId>0): khoá advisory theo khoá nguồn TRONG tx rồi mới hasPosted (Q3 — khép
   * cửa sổ đua P7 của prod; kết quả y như prod khi không đua). Đã ghi ⇒ trả id CŨ, không lỗi.
   * Id: sequence Postgres nối tiếp id đã nạp (Q2) — KHÔNG `max(time(), MAX+1)` của prod.
   */
  async postEntry(tx: Tx, tk: string, type: TreasuryType, money: Dec | string, opts: PostEntryOpts = {}): Promise<number> {
    let m = new Decimal(money).abs();
    if (m.lte(0)) return 0;
    if (type === 'out' || type === 'tranfer') m = m.neg();

    const srcM = opts.sourceModule ?? '';
    const srcI = Math.trunc(opts.sourceId ?? 0);
    if (srcM !== '' && srcI > 0) {
      await this.lockSource(tx, srcM, srcI);
      const existed = await this.hasPosted(tx, srcM, srcI);
      if (existed) return existed;
    }
    return this.insertRow(tx, tk, type, m, srcM, srcI, opts);
  }

  /** Khoá advisory theo khoá nguồn (module, sourceId) TRONG tx — cùng khoá postEntry dùng (Q3). */
  private async lockSource(tx: Tx, module: string, sourceId: number): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'treasury:' + module}), ${Math.trunc(sourceId)}::int)::text`;
  }

  /**
   * Chèn MỘT dòng sổ, KHÔNG khử trùng (`themDongSo` của prod). `m` đã mang dấu.
   * Chỉ postEntry (sau khi đã khử trùng) và transfer() có `label` (người gọi giữ khoá idempotency
   * cho CẢ CẶP — bẫy §0.3/§12.1) được gọi thẳng vào đây.
   */
  private async insertRow(
    tx: Tx, tk: string, type: TreasuryType, m: Dec, srcM: string, srcI: number, opts: PostEntryOpts,
  ): Promise<number> {
    const status = Math.trunc(opts.status ?? 0);
    const cuser = opts.cuser ?? '';
    const data: Prisma.TreasuryEntryUncheckedCreateInput = {
      tkCode: tk,
      type,
      gout: opts.gout ?? '',
      cdate: opts.cdate !== undefined ? Math.trunc(opts.cdate) : nowSec(),
      cuser,
      money: m,
      rate: new Decimal(opts.rate ?? 0),
      note: opts.note ?? '',
      status,
      sourceModule: srcM,
      sourceId: srcI,
    };
    if (opts.cusId !== undefined) data.cusId = opts.cusId;
    if (opts.poId !== undefined) data.poId = Math.trunc(opts.poId);
    if (opts.containerId !== undefined) data.containerId = Math.trunc(opts.containerId);
    if (opts.orderCode !== undefined) data.orderCode = mbSubstr(String(opts.orderCode), 50);
    if (opts.reversalOf !== undefined) data.reversalOf = Math.trunc(opts.reversalOf);
    if (opts.reversalCode !== undefined) data.reversalCode = mbSubstr(String(opts.reversalCode), 20);
    if (opts.reversalReason !== undefined) data.reversalReason = mbSubstr(String(opts.reversalReason), 255);
    if (opts.refRequestId !== undefined) data.refRequestId = Math.trunc(opts.refRequestId);
    if (status === 1) {
      data.approveUser = opts.approveUser ?? cuser;
      data.approveDate = nowSec();
    }
    const row = await tx.treasuryEntry.create({ data, select: { id: true } });
    return row.id;
  }

  /**
   * `getRate($currency)` (`:299-306`): tỷ giá gần nhất <= hôm nay (giờ VN); 0 nếu chưa từng nhập.
   * Prod `tbl_exchange_rates` RỖNG ⇒ luôn 0 (§12.6 — "bỏ qua, không bịa").
   */
  private async getRate(tx: Tx, currency: 'USD' | 'CNY'): Promise<Dec> {
    const r = await tx.exchangeRate.findFirst({
      where: { currency, rateDate: { lte: todayVnAsUtcDate() } },
      orderBy: [{ rateDate: 'desc' }, { id: 'desc' }],
      select: { rateVnd: true },
    });
    return r ? new Decimal(r.rateVnd) : new Decimal(0);
  }

  /**
   * `postPaymentEntry($payment_id, $approver, $cdate_override)` (`:1284-1316`, 09a §6.1 nguyên văn).
   * Nhánh theo TỆ CỦA VÍ (không theo cờ currency phiếu — 09a §11.2), trừ đúng một chỗ prod có đọc
   * cờ phiếu: ví USD + phiếu 'USD' + price_cyn > 0.
   * price_payment NULL/<=0 là bình thường ⇒ price_cyn × rate_buy (09a §11.1), KHÔNG làm tròn.
   */
  async postPaymentEntry(tx: Tx, paymentId: number, approver: string, cdateOverride?: number | null): Promise<number> {
    const p = await tx.supplierPayment.findUnique({
      where: { id: Math.trunc(paymentId) },
      select: { id: true, priceCyn: true, rateBuy: true, pricePayment: true, accountCode: true, codeOrder: true, poId: true, currency: true },
    });
    if (!p || p.accountCode === '') return 0;
    const acc = await this.getAccount(p.accountCode, tx);
    if (!acc) return 0;

    const priceCyn = new Decimal(p.priceCyn ?? 0);
    const rateBuy = new Decimal(p.rateBuy ?? 0);
    let priceVnd = new Decimal(p.pricePayment ?? 0);
    if (priceVnd.lte(0)) priceVnd = priceCyn.times(rateBuy);

    let money: Dec;
    let rate: Dec;
    if (acc.currency === 'CNY') {
      money = priceCyn; rate = rateBuy;
    } else if (acc.currency === 'USD') {
      if (p.currency === 'USD' && priceCyn.gt(0)) {
        money = priceCyn; rate = rateBuy;
      } else {
        const usd = await this.getRate(tx, 'USD');
        if (usd.lte(0)) return 0; // chưa có tỷ giá USD ⇒ không ghi (prod: hiện ở "chưa phân loại")
        // PHP round(x, 2) = nửa xa 0; Decimal chia chính xác rồi làm tròn nửa xa 0 (ROUND_HALF_UP).
        money = priceVnd.div(usd).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        rate = usd;
      }
    } else {
      money = priceVnd; rate = rateBuy;
    }

    const codeOrder = p.codeOrder ?? '';
    const note = `Phiếu chi NCC #${p.id}` + (p.poId > 0 ? ` (PO ${p.poId})` : '') + (codeOrder !== '' ? ` - ${codeOrder}` : '');
    const opts: PostEntryOpts = {
      // note varchar(255): code_order tới 255 ký tự ⇒ ghép có thể vượt; Postgres ném lỗi thay vì
      // cắt ⇒ cắt 255 ký tự để không làm hỏng giao dịch duyệt (xem báo cáo Task 2).
      note: mbSubstr(note, 255),
      rate, cuser: approver, status: 1, approveUser: approver,
      sourceModule: 'payment', sourceId: p.id,
      poId: p.poId, orderCode: codeOrder,
    };
    if (cdateOverride !== undefined && cdateOverride !== null) opts.cdate = Math.trunc(cdateOverride);
    return this.postEntry(tx, p.accountCode, 'out', money, opts);
  }

  /**
   * `daoTheoNguon($module, $source_id, $lyDo, $user, $reversal_code, $ref_request_id)` (`:499-554`).
   * CHỈ đảo dòng status=1 (T4; dòng 0/9 chưa từng vào số dư — xử lý bằng đổi trạng thái, không ở đây).
   * Mỗi dòng: bỏ nếu |money| < 1e-5 hoặc đã có dòng đảo (hasPosted(mod_dao, id)) ⇒ chạy lại không đảo lần 2.
   * GL đảo KHÔNG gọi trong tx — trả `glDao` cho người gọi chạy sau commit.
   */
  async daoTheoNguon(
    tx: Tx, module: string, sourceId: number, lyDo: string, user: string,
    reversalCode = 'khac', refRequestId = 0,
  ): Promise<DaoTheoNguonResult> {
    module = String(module ?? '').trim();
    sourceId = Math.trunc(sourceId);
    const empty: DaoTheoNguonResult = { soDong: 0, daDao: 0, moTa: '', idsGoc: [], idsDaDao: [], glDao: [] };
    if (module === '' || sourceId <= 0) return empty;

    const rows = await tx.treasuryEntry.findMany({
      where: { sourceModule: module, sourceId, status: 1 },
      select: { id: true, tkCode: true, money: true, rate: true, poId: true, containerId: true, orderCode: true, cusId: true },
      orderBy: { id: 'asc' },
    });
    if (!rows.length) return empty;

    const modDao = mbSubstr('daoxoa_' + module, 20); // source_module varchar(20)
    refRequestId = Math.trunc(refRequestId);
    const idsDaDao: number[] = [];
    const moTa: string[] = [];
    for (const r of rows) {
      const tien = new Decimal(r.money ?? 0);
      if (tien.abs().lt('0.00001')) continue;
      if (await this.hasPosted(tx, modDao, r.id)) continue; // dòng này đã đảo rồi
      const chieu: TreasuryType = tien.lt(0) ? 'in' : 'out'; // ghi NGƯỢC dấu
      const opt: PostEntryOpts = {
        note: '↩ ĐẢO' + (refRequestId > 0 ? ` phiếu #${refRequestId}` : '') + ` — bút toán #${r.id}`,
        rate: new Decimal(r.rate ?? 0), cuser: user, status: 1, approveUser: user,
        sourceModule: modDao, sourceId: r.id,
        reversalOf: r.id, reversalCode, reversalReason: lyDo, refRequestId,
      };
      if (r.poId > 0) opt.poId = r.poId;
      if (r.containerId > 0) opt.containerId = r.containerId;
      if (r.orderCode !== '') opt.orderCode = r.orderCode;
      if ((r.cusId ?? '') !== '') opt.cusId = r.cusId as string;
      const id = await this.postEntry(tx, r.tkCode ?? '', chieu, tien.abs(), opt);
      if (id) {
        idsDaDao.push(r.id);
        moTa.push(`${r.tkCode ?? ''} ${chieu === 'in' ? '+' : '−'}${numberFormatVn(tien.abs(), 2)}`);
      }
    }

    const glDao: { sourceType: string; sourceId: number }[] = [];
    if (module === 'thu_chi_tbs') glDao.push({ sourceType: 'appr_request', sourceId });
    else if (GL_DAO_FX[module]) for (const r of rows) glDao.push({ sourceType: GL_DAO_FX[module], sourceId: r.id });

    return { soDong: rows.length, daDao: idsDaDao.length, moTa: moTa.join(', '), idsGoc: rows.map((r) => r.id), idsDaDao, glDao };
  }

  /**
   * `CLS_TREASURY::transfer(...)` (`cls.treasury.php:1039-1145`, 09c §5.2 + §10.2).
   * MỘT tx của người gọi, KHÔNG DELETE: lỗi ⇒ NÉM TreasuryError ⇒ tx lùi toàn bộ (thay DELETE
   * `:1074`/`:1095`/`:1109` của prod — P-FX2). Không gọi GL — trả `glTodo` cho người gọi chạy sau commit.
   * Ví quỹ được âm (Q12): chốt số dư nguồn bỏ qua khi `choAm`; chốt phí-ở-ví-đích VẪN chạy (F13).
   * ⛔ Có `label` ⇒ 2 chân ghi THẲNG nhãn đó, KHÔNG khoá, KHÔNG khử trùng — an toàn CHỈ khi người gọi đã giữ
   *    khoá + `hasPosted` cho đúng (module, sourceId) đó (hôm nay chỉ `fxGhiSoPhieu`). Người gọi mới dùng `label`
   *    mà không khoá ⇒ ghi đôi (review cuối L2, Minor 1).
   */
  async transfer(
    tx: Tx, from: string, to: string, amountOut: Dec | string, amountIn: Dec | string, rate: Dec | string,
    note: string, cuser: string, cdate: number, status: number, o: TransferOpts = {},
  ): Promise<TransferResult> {
    if (from === to) throw new TreasuryError('TK nguồn và đích trùng nhau');
    const aOut = new Decimal(amountOut).abs();
    const aIn = new Decimal(amountIn).abs();
    if (aOut.lte(0) || aIn.lte(0)) throw new TreasuryError('Số tiền không hợp lệ');
    const cd = Math.trunc(cdate) > 0 ? Math.trunc(cdate) : nowSec();
    const r = new Decimal(rate);

    const fee = new Decimal(o.fee ?? 0).abs();
    const feeTk = o.feeTk === from || o.feeTk === to ? (o.feeTk as string) : from;
    const feeM = o.feeModule ?? '';
    const feeI = Math.trunc(o.feeSourceId ?? 0);
    const feeDaGhi = fee.gt(0) && feeM !== '' && feeI > 0 ? await this.hasPosted(tx, feeM, feeI) : 0;
    const canTru = aOut.plus(feeDaGhi || feeTk !== from ? 0 : fee);
    if (!o.choAm) {
      const bal = await this.getBalance(from, tx);
      if (bal.lt(canTru)) {
        // Nguyên văn prod (`cls.treasury.php` transfer); tbs_money = 0 lẻ, nửa xa 0.
        throw new TreasuryError(
          'Số dư TK nguồn không đủ (' + tbsMoney(bal) + ')' +
            (fee.gt(0) && !feeDaGhi ? ' — cần ' + tbsMoney(canTru) + ' gồm cả phí chuyển ' + tbsMoney(fee) : ''),
        );
      }
    }

    const base: PostEntryOpts = { note, rate: r, cdate: cd, cuser, status };
    let outId: number;
    let inId: number;
    if (o.label) {
      const lm = String(o.label.module ?? '');
      const li = Math.trunc(o.label.sourceId ?? 0);
      if (lm === '' || li <= 0) throw new TreasuryError('Nhãn nguồn (label) không hợp lệ');
      // Bẫy §0.3/§12.1: KHÔNG qua postEntry (khử trùng từng dòng sẽ nuốt chân đích).
      outId = await this.insertRow(tx, from, 'tranfer', aOut.neg(), lm, li, base);
      inId = await this.insertRow(tx, to, 'in', aIn, lm, li, base);
    } else {
      outId = await this.postEntry(tx, from, 'tranfer', aOut, base); // source_module '' như prod
      inId = await this.postEntry(tx, to, 'in', aIn, { ...base, sourceModule: 'transfer', sourceId: outId });
    }

    let feeId = 0;
    if (fee.gt(0)) {
      if (feeTk === to && !feeDaGhi) {
        const balTo = await this.getBalance(to, tx); // đã gồm chân đích vừa ghi (cùng tx), như prod :1091
        if (balTo.gte(0) && balTo.lt(fee)) {
          // Nguyên văn prod. "đã huỷ cả phiếu" ĐÚNG ở v2: ném ⇒ tx lùi cả 2 chân vừa ghi.
          throw new TreasuryError(
            'Phí ' + numberFormatVn(fee, 2) + ' sẽ làm ví đích âm' + ' (hiện có ' + numberFormatVn(balTo, 2) + ') — đã huỷ cả phiếu',
          );
        }
      }
      feeId = await this.postEntry(tx, feeTk, 'out', fee, {
        note: o.feeNote ?? '', rate: r, cdate: cd, cuser, status, sourceModule: feeM, sourceId: feeI,
      });
    }

    // GL (người gọi, sau commit). toVnd chỉ cho ví VND — ngoại tệ bỏ qua (Q11, xem GlTodo).
    const glTodo: GlTodo[] = [];
    const curOf = async (tk: string) => (await tx.fundAccount.findUnique({ where: { code: tk }, select: { currency: true } }))?.currency;
    const [curFrom, curTo] = [await curOf(from), await curOf(to)];
    if (curFrom === 'VND' && curTo === 'VND') glTodo.push({ kind: 'chuyenVi', outId, from, to, outVnd: aOut, inVnd: aIn });
    if (feeId) {
      const curFee = feeTk === from ? curFrom : curTo;
      if (curFee === 'VND') glTodo.push({ kind: 'fxPhi', feeId, feeTk, feeVnd: fee, cur: 'VND', amountCcy: fee });
    }
    return { outId, inId, feeId, glTodo };
  }

  /**
   * `fx_ghi_so_phieu($fxId, $cuser, $opts)` (`libs/fx_ghiso.php:67-121`, 09c §5.1 + §10.2) — CỬA DUY NHẤT
   * ghi sổ phiếu FX. `cuser` = người NỘP phiếu duyệt (bẫy §12.3 — người gọi truyền `submitted_by`).
   * KHÔNG đổi `status` phiếu (người gọi lo). `choAm` chỉ áp cho chặng 1 (người gọi đặt khi phiếu có
   * tbl_fx_adjustments — bẫy §12.5); chặng 2 LUÔN choAm.
   * Khác prod có chủ đích: khoá dòng phiếu `FOR UPDATE` + advisory lock (prod không khoá — hai người
   * duyệt cùng lúc ⇒ 2 bộ chân); lỗi ⇒ NÉM, không DELETE / không daoTheoNguon.
   * ⛔ HỢP ĐỒNG VỚI NGƯỜI GỌI (review cuối L2, Minor 2 — BẮT BUỘC cho L8): lỗi nghiệp vụ JS KHÔNG làm hỏng
   *    transaction Postgres. Người gọi bắt `TreasuryError` để ghi `status='failed'` rồi COMMIT CÙNG tx ⇒ chặng 1
   *    + UPDATE `agent_amount` được lưu mà thiếu chặng 2 — đúng thứ Q-FX-3 muốn chặn. Phải gọi hàm này trong
   *    SAVEPOINT (hoặc tx riêng) và ghi `failed` ở tx KHÁC sau khi tx này đã lùi.
   */
  async fxGhiSoPhieu(
    tx: Tx, fxId: number, cuser: string, opts: { choAm?: boolean; cdate?: number } = {},
  ): Promise<FxGhiSoResult> {
    const id = Math.trunc(fxId);
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM tbl_fx_transfers WHERE id = ${id} FOR UPDATE`;
    if (!locked.length) throw new TreasuryError('Không tìm thấy phiếu FX #' + id);
    const fx = await tx.fxTransfer.findUniqueOrThrow({ where: { id } });
    const cdate = opts.cdate !== undefined && Math.trunc(opts.cdate) > 0 ? Math.trunc(opts.cdate) : nowSec();
    const glTodo: GlTodo[] = [];

    // Chặng 1 — khoá ('treasury:fx_transfer', fxId) RỒI mới hasPosted, cả cặp một lần.
    await this.lockSource(tx, 'fx_transfer', id);
    let chang1: FxGhiSoResult['chang1'] = 'da_co';
    if (!(await this.hasPosted(tx, 'fx_transfer', id))) {
      const { feeTk } = viPhiFx({
        fromTk: fx.fromTk, toTk: fx.toTk, fromCurrency: fx.fromCurrency, toCurrency: fx.toCurrency, feeCurrency: fx.feeCurrency ?? '',
      });
      const feeCur = fx.feeCurrency ?? ''; // NULL coi như '' (0 dòng NULL trên prod — xem báo cáo)
      let r1: TransferResult;
      try {
        r1 = await this.transfer(
          tx, fx.fromTk, fx.toTk, fx.amountOut, fx.amountIn, fx.rate,
          'FX #' + fx.code + (phpTruthyStr(fx.note) ? ' — ' + fx.note : ''), cuser, cdate, 1,
          {
            label: { module: 'fx_transfer', sourceId: id },
            fee: fx.fee, feeTk, feeNote: 'Phí chuyển FX #' + fx.code + (feeCur !== '' ? ' (' + feeCur + ')' : ''),
            feeModule: 'fx_fee', feeSourceId: id,
            choAm: !!opts.choAm,
          },
        );
      } catch (e) {
        // Lỗi nghiệp vụ (TreasuryError — transfer() luôn ném kèm thông điệp) ⇒ giữ nguyên. Lỗi khác
        // (CSDL…) ⇒ thông điệp prod 'Không ghi được chặng chuyển', giữ `cause`. Không nói "đã huỷ" —
        // v2 không DELETE, tx người gọi lùi toàn bộ.
        if (e instanceof TreasuryError) throw e;
        throw new TreasuryError('Không ghi được chặng chuyển', { cause: e });
      }
      glTodo.push(...r1.glTodo);
      chang1 = 'moi';
    }

    // Chặng 2 — quy đổi sang ví agent.
    const agentRate = new Decimal(fx.agentRate);
    if (fx.agentTk === '' || agentRate.lte(0)) return { chang1, chang2: 'khong', agentAmount: null, glTodo };
    const amountIn = new Decimal(fx.amountIn);
    // PHP round(x, 2) = nửa xa 0 ⇒ ROUND_HALF_UP trên Decimal (không có nhiễu float của prod).
    const agentAmt = amountIn.times(agentRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    await this.lockSource(tx, 'fx_quydoi', id);
    if (await this.hasPosted(tx, 'fx_quydoi', id)) return { chang1, chang2: 'da_co', agentAmount: agentAmt, glTodo };
    if (agentAmt.minus(fx.agentAmount).abs().gt('0.005')) {
      await tx.fxTransfer.update({ where: { id }, data: { agentAmount: agentAmt } });
    }
    // Q-FX-3 (KHÁC PROD có chủ đích): lỗi ở đây NÉM ⇒ tx người gọi lùi TOÀN BỘ, kể cả chặng 1 vừa ghi
    // ở trên và UPDATE agent_amount. Prod (`fx_ghiso.php`) giữ chặng 1 rồi daoTheoNguon ra cặp đảo.
    const r2 = await this.transfer(
      tx, fx.toTk, fx.agentTk, amountIn, agentAmt, agentRate,
      'FX #' + fx.code + ' — quy đổi tại agent', cuser, cdate, 1,
      { label: { module: 'fx_quydoi', sourceId: id }, choAm: true },
    );
    glTodo.push(...r2.glTodo);
    return { chang1, chang2: 'moi', agentAmount: agentAmt, glTodo };
  }
}
