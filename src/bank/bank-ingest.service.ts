// src/bank/bank-ingest.service.ts
//
// 09c L3 — NHẬN GIAO DỊCH SePay dạng SERVICE (port `api/bank-sepay-hook.php`, prod HEAD).
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §5.5, §7, §8 (F7/F8), §10.3, §11 (L3), §12 (7–11, 13);
//         docs/rewrite-spec/09b-so-quy-treasury.md §5.1, §7.
//
// ⛔ KHÔNG có route HTTP gọi vào đây (xác thực webhook là Q9 — chờ chủ DN), không cron.
// ⛔ KHÔNG log / in / đưa vào thông báo lỗi số tài khoản (`accountNumber`, `stk`, `bank_account`) — §12.13.
// ⛔ KHÔNG nạp ví khách ở đây (chỉ sổ quỹ công ty + GL).
//
// Khác prod CÓ CHỦ ĐÍCH (§10.3, plan L3):
//  - MỘT tx + `pg_advisory_xact_lock` theo id SePay, SELECT bankid DƯỚI khoá (khép cửa sổ đua P-B4 —
//    prod đếm rồi INSERT … WHERE NOT EXISTS, không UNIQUE bankid).
//  - Lỗi ghi ⇒ NÉM (prod vẫn trả 200 và không kiểm kết quả INSERT).
//  - Công tắc `chi_ghi_nhan` (cửa sổ đóng băng): chỉ INSERT giao dịch; `replayFrom()` ghi bù sau.
//  - Khớp phiếu chi theo MÃ MẪU `phieu_chi_tbs_master` (prod cứng `template_id=55`).
// Task 1 = phần chung + chiều `in`. Task 2 = `bank-sepay-hook.php:86-321` (prod HEAD 81c96d0): chiều `out`
// (nội bộ / khớp phiếu chi / ẩn khỏi hàng chờ), `in` nội bộ, gán khách tự động 3 tầng — CHỈ set `cus_id`.
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';
import { TreasuryService } from '../money/treasury.service';
import { GlMapService } from '../money/gl-map.service';

type Tx = Prisma.TransactionClient;

/** Khoá SePay đang dùng (§10.3). Khoá lạ bị bỏ qua. Giá trị để `unknown` — ép kiểu như PHP `(string)`. */
export interface SepayPayload {
  id?: unknown;
  gateway?: unknown;
  transactionDate?: unknown;
  accountNumber?: unknown;
  transferType?: unknown;
  transferAmount?: unknown;
  content?: unknown;
  [k: string]: unknown;
}

export type IngestMode = 'ghi_so' | 'chi_ghi_nhan';

export interface IngestOpts {
  /** 'chi_ghi_nhan' = công tắc đóng băng: chỉ lưu giao dịch, không sổ quỹ, không GL. Mặc định 'ghi_so'. */
  mode?: IngestMode;
}

export interface IngestResult {
  status: 'ignored' | 'duplicate' | 'unmapped' | 'recorded' | 'posted';
  bankTxId?: number;
  histId?: number;
  /** Kết quả GL (sau commit) — GL không bao giờ làm hỏng luồng tiền (postBiz không ném). */
  gl?: 'posted' | 'exists' | 'skipped' | 'error';
  /** Chiều `in`: mã khách được gán tự động (chỉ `cus_id`, KHÔNG nạp ví). */
  cusId?: string;
  /** Chiều `out`: phiếu chi (`ApprovalRequest.id`) được khớp tự động. */
  chiMatchRequestId?: number;
  /**
   * 'error' = bước phân loại/gán khách (:86-321) lỗi và đã lùi về SAVEPOINT — giao dịch + dòng sổ (+GL) VẪN
   * được lưu; `replayFrom` chạy lại phân loại sau. Không có khoá này = phân loại chạy xong.
   */
  classify?: 'error';
}

/** Lỗi nhận giao dịch — thông điệp KHÔNG chứa dữ liệu payload (không STK, không nội dung). */
export class BankIngestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'BankIngestError';
    if (options && 'cause' in options) (this as { cause?: unknown }).cause = options.cause;
  }
}

const NOTE_PREFIX = 'Bank báo có tự động — ';

/** PHP `(string)($x ?? '')`: null/undefined ⇒ ''; bool ⇒ '1'/''. */
function phpStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '1' : '';
  return String(v);
}

/** `mb_substr($s, 0, n)` (UTF-8) — cắt theo KÝ TỰ (code point), không byte, không đơn vị UTF-16. */
function mbSubstr(s: string, n: number): string {
  return Array.from(s).slice(0, n).join('');
}

/**
 * `tranAmount` BigInt nguyên đồng (§12.7). Thiếu/'' ⇒ 0 (prod `?? 0`). Số nguyên (có thể dạng chuỗi,
 * cho phép phần lẻ toàn 0 như "2000000.00") ⇒ BigInt. Có phần lẻ khác 0 / rác ⇒ NÉM (không làm tròn ngầm).
 */
function toDong(v: unknown): bigint {
  if (v === null || v === undefined) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') {
    if (Number.isSafeInteger(v)) return BigInt(v);
    throw new BankIngestError('transferAmount không phải số nguyên đồng');
  }
  const s = String(v).trim();
  if (s === '') return 0n;
  const m = /^(-?\d+)(?:\.0+)?$/.exec(s);
  if (!m) throw new BankIngestError('transferAmount không phải số nguyên đồng');
  return BigInt(m[1]);
}

/**
 * `strtotime($transactionDate).'000'` — mili-giây (§12.8). SePay gửi 'YYYY-MM-DD HH:MM:SS' giờ máy chủ
 * (Asia/Ho_Chi_Minh, UTC+7, không DST). Chuỗi có múi giờ tường minh (Z/±hh:mm) ⇒ theo múi đó.
 * Không đọc được ⇒ prod `false.'000'` = '000' ⇒ 0.
 */
function tranTimeMs(v: unknown): bigint {
  const s = phpStr(v).trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (local) {
    const [, y, mo, d, h = '0', mi = '0', se = '0'] = local;
    const ms = Date.UTC(+y, +mo - 1, +d, +h - 7, +mi, +se);
    return Number.isFinite(ms) ? BigInt(ms) : 0n;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const ms = Date.parse(s.replace(' ', 'T'));
    if (Number.isFinite(ms)) return BigInt(Math.floor(ms / 1000) * 1000);
  }
  return 0n;
}

// ═══════════════ Chuẩn hoá — chép NGUYÊN VĂN `bank-sepay-hook.php:86-321` (PHP 8.2, PCRE2) ═══════════════
// Ngữ nghĩa PCRE được tái tạo tường minh (JS `\s`, `.`, `$`, `trim()` KHÁC PCRE/PHP):
//  - KHÔNG cờ `u`: `\s` = [\t\n\v\f\r ] (ASCII), `\d` = [0-9].
//  - CÓ cờ `u` (PHP bật PCRE2_UTF + PCRE2_UCP): `\s` = HSPACE ∪ VSPACE ∪ \p{Z}; `.` = mọi ký tự trừ \n
//    (NEWLINE mặc định LF — `.` KHỚP \r); `$` = cuối chuỗi hoặc trước một \n cuối; lớp ký tự theo code point.
//  - `trim()` PHP chỉ cắt " \t\n\r\0\x0B" (JS trim cắt mọi khoảng trắng Unicode, vd U+1680 nằm TRONG dải à..ỹ).

/** `$dauNBO`/`$dauNB` (:98, :211) — 67 ký tự dựng sẵn (NFC), cùng thứ tự với `BANG_KHONG_DAU`. */
const BANG_DAU: readonly string[] = ["à","á","ạ","ả","ã","â","ầ","ấ","ậ","ẩ","ẫ","ă","ằ","ắ","ặ","ẳ","ẵ","è","é","ẹ","ẻ","ẽ","ê","ề","ế","ệ","ể","ễ","ì","í","ị","ỉ","ĩ","ò","ó","ọ","ỏ","õ","ô","ồ","ố","ộ","ổ","ỗ","ơ","ờ","ớ","ợ","ở","ỡ","ù","ú","ụ","ủ","ũ","ư","ừ","ứ","ự","ử","ữ","ỳ","ý","ỵ","ỷ","ỹ","đ"]; // prettier-ignore
/** `$khgNBO`/`$khgNB` (:99, :212). */
const BANG_KHONG_DAU: readonly string[] = ["a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","a","e","e","e","e","e","e","e","e","e","e","e","i","i","i","i","i","o","o","o","o","o","o","o","o","o","o","o","o","o","o","o","o","o","u","u","u","u","u","u","u","u","u","u","u","y","y","y","y","y","d"]; // prettier-ignore
const MAP_DAU = new Map(BANG_DAU.map((c, i) => [c, BANG_KHONG_DAU[i]] as const));

/** `$genericA` (:258). So `in_array(..., true)` — chuỗi KHÔNG dấu, so đúng từng ký tự. */
const CUM_CHUNG_CHUNG: ReadonlySet<string> = new Set(["chuyen tien","chuyen khoan","thanh toan","ck","tt","chuyen tien den","giao dich chuyen tien","thanh toan tien hang"]); // prettier-ignore
/** `$stopA` (:273). */
const TU_DUNG: ReadonlySet<string> = new Set(["cong","ty","tnhh","co","phan","cp","cty","dv","tm","va","and","ct","xnk","sx","thanh","toan","chuyen","khoan","tien","hang","coc","dat","tt","ck","po","don","mua","ban","tra","not","theo","cho","lan","dot","so","gd","ma","sdt","stk","ung","hoan","phi"]); // prettier-ignore

/** `\s` PCRE2 khi UCP (cờ `u`): HSPACE_CASES ∪ VSPACE_CASES ∪ \p{Z}. */
const WS_UCP = '\\t\\n\\v\\f\\r \\u0085\\u00A0\\u1680\\u180E\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000';
/** `/[\s\-]GD[\s\-][0-9A-Za-z].*$/u` (:252) — `.` = [^\n], `$` = cuối hoặc trước \n cuối. */
const RE_CAT_GD = new RegExp(`[${WS_UCP}\\-]GD[${WS_UCP}\\-][0-9A-Za-z][^\\n]*(?=\\n?$)`, 'gu');
/** `/TBS[\s\-\.]?(\d{1,6})/i` (:103, :216, :246) — KHÔNG cờ u ⇒ `\s` ASCII. */
const RE_TBS = /TBS[\t\n\v\f\r \-.]?(\d{1,6})/i;
/** `/\s+/` KHÔNG cờ u ⇒ ASCII. */
const RE_WS_ASCII = /[\t\n\v\f\r ]+/g;

/** `trim()` PHP — chỉ " \t\n\r\0\x0B". */
function phpTrim(s: string): string {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

/** `mb_strlen` — đếm code point. */
function mbLen(s: string): number {
  return Array.from(s).length;
}

/**
 * `mb_strtolower($s, 'UTF-8')` của PHP **8.2**: ánh xạ chữ thường ĐẦY ĐỦ, KHÔNG có quy tắc sigma cuối từ
 * (PHP 8.3 mới thêm) — JS `toLowerCase()` đổi 'Σ' cuối từ thành 'ς', nên ép 'Σ'→'σ' trước.
 */
function thuong(s: string): string {
  return s.replace(/\u03A3/g, '\u03C3').toLowerCase();
}

/** `:100-101` — bỏ dấu để dò "noi bo": thường → bảng dấu → `[^a-z0-9]+`→' ' → `\s+`→' ' → trim. */
function khongDau(s: string): string {
  const k = Array.from(thuong(s), (ch) => MAP_DAU.get(ch) ?? ch).join('');
  return phpTrim(k.replace(/[^a-z0-9]+/g, ' ').replace(RE_WS_ASCII, ' '));
}

/** `preg_match('/TBS[\s\-\.]?(\d{1,6})/i', …)` ⇒ `'TBS'.$m[1]` hoặc null. */
function maTBS(s: string): string | null {
  const m = RE_TBS.exec(s);
  return m ? 'TBS' + m[1] : null;
}

/** Bước 1 vân tay (:252): cắt đuôi mã tham chiếu `-GD …`. */
function catGD(s: string): string {
  return s.replace(RE_CAT_GD, '');
}

/**
 * "Vân tay" nội dung (:252-257, :262-267 tầng 2; :275-279 tầng 3 — tầng 3 lịch sử KHÔNG cắt 60).
 * cắt GD → mb_strtolower → `\d+`→' ' → `[^a-zà-ỹđ ]+`/u→' ' (dải code point U+00E0..U+1EF9) →
 * trim(`\s+`→' ') → mb_substr(0, 60).
 */
function chuKy(s: string, cat60 = true): string {
  let x = thuong(catGD(s));
  x = x.replace(/\d+/g, ' ');
  x = x.replace(/[^a-z\u00E0-\u1EF9\u0111 ]+/gu, ' ');
  x = phpTrim(x.replace(RE_WS_ASCII, ' '));
  return cat60 ? mbSubstr(x, 60) : x;
}

/** Tầng 3 (:274-275, :280-281): từ đầu tiên không thuộc `$stopA`, chỉ nhận khi ≥ 5 KÝ TỰ. */
function tenNguoiGui(sig: string): string {
  const w = sig.split(' ').filter((x) => x !== '' && !TU_DUNG.has(x));
  return w.length > 0 && mbLen(w[0]) >= 5 ? w[0] : '';
}

/** `(float)$x` của PHP 8 cho giá trị từ `json_decode(..., true)` (§12.11: so `===` float). */
function phpFloat(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return v.length > 0 ? 1 : 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0 ? 1 : 0;
  // chuỗi: tiền tố số (khoảng trắng đầu " \t\n\r\v\f"), phần còn lại bỏ qua; không có ⇒ 0.
  const m = /^[ \t\n\r\v\f]*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(String(v));
  return m ? Number(m[1]) : 0;
}

/**
 * Tên lớp lỗi (+ mã Prisma dạng `P1234` nếu có) để log — KHÔNG thông điệp lỗi (có thể mang giá trị cột,
 * nội dung chuyển khoản, số tài khoản).
 */
function tenLoi(x: unknown): string {
  if (x instanceof Error) {
    const code = (x as { code?: unknown }).code;
    const ten = x.constructor?.name || x.name || 'Error';
    return typeof code === 'string' && /^P\d{4}$/.test(code) ? ten + '(' + code + ')' : ten;
  }
  return typeof x;
}

/** Chỉ để test từng bước chuẩn hoá — KHÔNG dùng ngoài service. */
export const _chuanHoa = {
  BANG_DAU,
  BANG_KHONG_DAU,
  khongDau,
  maTBS,
  catGD,
  thuong,
  chuKy,
  tenNguoiGui,
  phpFloat,
};

const MAU_PHIEU_CHI = 'phieu_chi_tbs_master';
const NOTE_NBO_OUT = 'Tu dong: Chuyen tien noi bo giua cac TK ngan hang cong ty';
const NOTE_OUT_ALL = 'Tu dong: giao dich tru tien - an khoi hang cho /bank, giu de doi soat';
const NOTE_NB_IN = 'Tu phan Nap noi bo theo noi dung CK';
const NOTE_CHI_MATCH = 'Tu dong khop theo so tien';
const LICH_SU_GAN = 3000;

interface SauInsert {
  histId?: number;
  /** Đã ghi dòng chi tiết tự động / khớp phiếu chi. */
  classified: boolean;
  /** Phân loại lỗi, đã lùi về SAVEPOINT (giao dịch + dòng sổ giữ nguyên). */
  classifyError?: boolean;
  chiMatchRequestId?: number;
  cusId?: string;
}

/** Kết quả `replayFrom`. `failed` = id giao dịch lỗi (tx của dòng đó lùi; các dòng khác vẫn chạy). */
export interface ReplayResult {
  posted: number;
  classified: number;
  assigned: number;
  failed: number[];
}

interface TxInfo {
  bankTxId: number;
  bankid: string;
  bankName: string;
  amount: bigint;
  tk: string;
  content: string;
}

@Injectable()
export class BankIngestService {
  private readonly logger = new Logger('BankIngest');

  constructor(
    private prisma: PrismaService,
    private treasury: TreasuryService,
    private glMap: GlMapService,
  ) {}

  /** Khoá advisory theo id SePay trong tx — cùng khoá cho ingest và replayFrom. */
  private async lockBankId(tx: Tx, bankid: string): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('sepay'), hashtext(${bankid}))::text`;
  }

  /**
   * `findBySTK($stk)` (`cls.treasury.php:103-108`): '' ⇒ null; `stk = … AND is_active = 1`.
   * ⛔ Không log giá trị STK.
   */
  private async findBySTK(tx: Tx, stk: string): Promise<string | null> {
    if (stk === '') return null;
    const a = await tx.fundAccount.findFirst({ where: { stk, isActive: 1 }, select: { code: true }, orderBy: { id: 'asc' } });
    return a ? a.code : null;
  }

  private noteOf(content: string): string {
    return NOTE_PREFIX + mbSubstr(content, 180);
  }

  private glDescription(tk: string, content: string): string {
    return 'Tiền về ' + tk + ' — ' + mbSubstr(content, 180);
  }

  /** Dòng sổ `bank_tx` cho một giao dịch '+' (prod `:58-68`). */
  private postIn(tx: Tx, tk: string, bankTxId: number, amount: bigint, content: string): Promise<number> {
    return this.treasury.postEntry(tx, tk, 'in', amount.toString(), {
      note: this.noteOf(content),
      cuser: 'sepay',
      approveUser: 'sepay',
      status: 1,
      sourceModule: 'bank_tx',
      sourceId: bankTxId,
    });
  }

  /**
   * GL SAU commit (prod `:74-85`): nguồn = id DÒNG SỔ, vế tiền theo ví.
   * ⛔ KHÔNG BAO GIỜ ném: prod bọc try/catch + error_log — "Lỗi ghi sổ KHÔNG được chặn webhook: tiền đã
   * về tài khoản thật rồi". Ném hay trả 'error' ⇒ chỉ ghi log thông điệp CỐ ĐỊNH + id (bankTxId, histId,
   * mã ví) — KHÔNG nội dung chuyển khoản, KHÔNG số tài khoản, KHÔNG chi tiết lỗi gốc.
   */
  private async postGl(bankTxId: number, histId: number, tk: string, amount: bigint, content: string) {
    let status: 'posted' | 'exists' | 'skipped' | 'error';
    try {
      const r = await this.glMap.postBiz('bank_tien_ve', 'bank_tx', histId, amount.toString(), {
        tkVi: tk,
        createdBy: 'sepay',
        description: this.glDescription(tk, content),
      });
      status = r.status;
    } catch {
      status = 'error';
    }
    if (status === 'error') {
      this.logger.error(`[GL-BANKTX] ghi GL bank_tien_ve thất bại bankTxId=${bankTxId} histId=${histId} tk=${tk}`);
    }
    return status;
  }

  /** `SELECT code FROM tbl_customer WHERE code='…' AND isactive=1 LIMIT 1` ⇒ có hay không. */
  private async khachHoatDong(tx: Tx, code: string): Promise<boolean> {
    const c = await tx.customer.findFirst({ where: { code, isactive: 1 }, select: { id: true } });
    return c !== null;
  }

  /** `$coTBSO`/`$coTBS` (:102-106, :215-219): nội dung có mã `TBSnnnn` của khách ĐANG HOẠT ĐỘNG. */
  private async coMaKhachHopLe(tx: Tx, content: string): Promise<boolean> {
    const code = maTBS(content);
    return code !== null && (await this.khachHoatDong(tx, code));
  }

  /**
   * "chỉ tự động khi phiếu còn nguyên trạng (chưa có dòng phân bổ nào)" ⇒ INSERT 1 dòng chi tiết `author 'auto'`
   * + UPDATE đầu giao dịch (:111-127, :183-197, :224-236). Trả true nếu đã ghi.
   */
  private async ghiChiTietTuDong(
    tx: Tx,
    t: TxInfo,
    type: '2' | '3',
    note: string,
    cusIdRong: boolean,
  ): Promise<boolean> {
    const n = await tx.bankTransactionDetail.count({ where: { tranId: BigInt(t.bankTxId) } });
    if (n !== 0) return false;
    const now = nowSec();
    await tx.bankTransactionDetail.create({
      data: {
        tranId: BigInt(t.bankTxId),
        type,
        money: t.amount,
        payInfo: 'CK ' + t.bankName,
        note,
        author: 'auto',
        cdate: now,
      },
    });
    await tx.bankTransaction.update({ where: { id: BigInt(t.bankTxId) }, data: { type, status: 'yes', mdate: now } });
    if (cusIdRong) {
      // prod đặt cus_id='' vô điều kiện (dòng vừa INSERT luôn NULL). Replay: KHÔNG ghi đè cus_id kế toán đã đặt
      // trong cửa sổ đóng băng (final review M3) ⇒ chỉ khi còn trống.
      await tx.bankTransaction.updateMany({
        where: { id: BigInt(t.bankTxId), OR: [{ cusId: null }, { cusId: '' }] },
        data: { cusId: '' },
      });
    }
    return true;
  }

  /**
   * Chiều `out` (:88-199). Trả id phiếu chi được khớp tự động (hoặc null).
   * 1) "noi bo" (bỏ dấu) + KHÔNG có mã khách hợp lệ ⇒ detail type 2 "nội bộ" + type=2/status='yes'.
   * 2) ngược lại: khớp phiếu chi (mẫu `phieu_chi_tbs_master`, status 2, chưa xoá, chưa có chi_match
   *    hiệu lực; `(float)so_tien === (float)tranAmount`; ưu tiên `^(TK\d+)` của `tk_chi_tbs` == tk_code nếu
   *    ra ĐÚNG 1; còn ĐÚNG 1 ứng viên ⇒ BankChiMatch auto) rồi detail type 2 "ẩn khỏi hàng chờ".
   * ⚠ `tk_code=''` ⇒ TK07 chỉ ở bước DUYỆT, không ở đây (§12.10).
   */
  private async phanLoaiOut(tx: Tx, t: TxInfo): Promise<{ classified: boolean; reqId: number | null }> {
    // Chốt "đã xử lý" (replay chạy lại phải là no-op): đã có dòng chi tiết ⇒ bỏ qua. Lượt ingest thường
    // luôn gặp 0 dòng (giao dịch vừa INSERT) ⇒ hành vi prod không đổi.
    if (await this.coChiTiet(tx, t)) return { classified: false, reqId: null };
    let isNoiBoOut = false;
    const coTBSO = await this.coMaKhachHopLe(tx, t.content);
    if (khongDau(t.content).includes('noi bo') && !coTBSO) {
      isNoiBoOut = await this.ghiChiTietTuDong(tx, t, '2', NOTE_NBO_OUT, false);
    }
    if (isNoiBoOut) return { classified: true, reqId: null };

    let matched: number | null = null;
    const tpl = await tx.approvalTemplate.findUnique({ where: { code: MAU_PHIEU_CHI }, select: { id: true } });
    // Chốt: giao dịch đã có chi_match hiệu lực (vd khớp tay trong cửa sổ đóng băng) ⇒ không khớp thêm.
    const daKhop = await tx.bankChiMatch.findFirst({
      where: { bankTxId: BigInt(t.bankTxId), unmatchedAt: null },
      select: { id: true },
    });
    if (tpl && !daKhop) {
      const dangKhop = await tx.bankChiMatch.findMany({ where: { unmatchedAt: null }, select: { requestId: true } });
      const cands = await tx.approvalRequest.findMany({
        where: { templateId: tpl.id, status: 2, isDeleted: false, id: { notIn: dangKhop.map((m) => m.requestId) } },
        select: { id: true, formData: true },
        orderBy: { id: 'asc' },
      });
      const outAmount = Number(t.amount); // (float)tranAmount
      let matches: number[] = [];
      const matchesTk: number[] = [];
      for (const c of cands) {
        let fd: unknown;
        try {
          fd = JSON.parse(c.formData ?? '');
        } catch {
          continue;
        }
        if (fd === null || typeof fd !== 'object') continue; // !is_array($fd)
        const f = fd as Record<string, unknown>;
        if (phpFloat(f['so_tien']) !== outAmount) continue;
        matches.push(c.id);
        const tkChi = typeof f['tk_chi_tbs'] === 'string' ? (f['tk_chi_tbs'] as string) : '';
        const mTk = /^(TK\d+)/.exec(tkChi);
        if (mTk && mTk[1] === t.tk) matchesTk.push(c.id);
      }
      if (matchesTk.length === 1) matches = matchesTk;
      if (matches.length === 1) {
        await tx.bankChiMatch.create({
          data: {
            bankTxId: BigInt(t.bankTxId),
            requestId: matches[0],
            method: 'auto',
            matchedBy: 'auto',
            matchedAt: nowSec(),
            note: NOTE_CHI_MATCH,
          },
        });
        matched = matches[0];
      }
    }

    const an = await this.ghiChiTietTuDong(tx, t, '2', NOTE_OUT_ALL, false);
    return { classified: an || matched !== null, reqId: matched };
  }

  private async coChiTiet(tx: Tx, t: TxInfo): Promise<boolean> {
    return (await tx.bankTransactionDetail.count({ where: { tranId: BigInt(t.bankTxId) } })) > 0;
  }

  /**
   * Chiều `in` (:200-315). "noi bo" + không mã khách hợp lệ ⇒ detail type 3 + type=3/status='yes'/cus_id='';
   * ngược lại gán khách 3 tầng — CHỈ `cus_id` (+mdate) khi còn trống, KHÔNG duyệt, KHÔNG nạp ví.
   * Trả mã khách đã gán ('' nếu không).
   */
  private async phanLoaiIn(tx: Tx, t: TxInfo): Promise<{ classified: boolean; cusId: string }> {
    // Chốt "đã xử lý": có dòng chi tiết (nội bộ đã phân, hoặc kế toán đã phân bổ) ⇒ bỏ qua cả gán khách —
    // nếu không, lượt replay thứ 2 của một dòng "nạp nội bộ" (cus_id='') sẽ gán khách cho nó.
    if (await this.coChiTiet(tx, t)) return { classified: false, cusId: '' };
    let isNoiBo = false;
    const coTBS = await this.coMaKhachHopLe(tx, t.content);
    if (khongDau(t.content).includes('noi bo') && !coTBS) {
      isNoiBo = await this.ghiChiTietTuDong(tx, t, '3', NOTE_NB_IN, true);
    }
    if (isNoiBo) return { classified: true, cusId: '' };

    // Chốt prod: chỉ gán khi cus_id còn trống (UPDATE … AND (cus_id IS NULL OR cus_id='')).
    const cur = await tx.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(t.bankTxId) }, select: { cusId: true } });
    if (cur.cusId !== null && cur.cusId !== '') return { classified: false, cusId: '' };
    const autoCus = await this.timKhach(tx, t.content);
    if (autoCus === '') return { classified: false, cusId: '' };
    const u = await tx.bankTransaction.updateMany({
      where: { bankid: t.bankid, OR: [{ cusId: null }, { cusId: '' }] },
      data: { cusId: autoCus, mdate: nowSec() },
    });
    return { classified: false, cusId: u.count > 0 ? autoCus : '' };
  }

  /**
   * CÁC BƯỚC SAU INSERT — MỘT routine dùng chung cho `ingest` (ghi_so) và `replayFrom`, đúng thứ tự prod:
   * (1) chiều in, tiền > 0, CHƯA TỪNG có dòng sổ ('bank_tx', id) ⇒ postEntry; (2) out ⇒ phanLoaiOut;
   * in ⇒ phanLoaiIn. Người gọi bảo đảm: đang trong tx, đã giữ khoá id SePay, `t.tk` là ví có thật.
   * GL KHÔNG ở đây — người gọi ghi sau commit (histId trả về).
   */
  private async sauInsert(tx: Tx, t: TxInfo, chieu: 'in' | 'out'): Promise<SauInsert> {
    const r: SauInsert = { classified: false };
    if (chieu === 'in' && t.amount > 0n) {
      const coSo = await tx.treasuryEntry.findFirst({
        where: { sourceModule: 'bank_tx', sourceId: t.bankTxId },
        select: { id: true },
      });
      if (!coSo) {
        const histId = await this.postIn(tx, t.tk, t.bankTxId, t.amount, t.content);
        if (!(histId > 0)) throw new BankIngestError('Ghi sổ quỹ tiền về thất bại');
        r.histId = histId;
      }
    }
    // Phân loại / gán khách (:86-321) trong SAVEPOINT (final review M1): lỗi ở đây KHÔNG được làm mất dòng
    // giao dịch hay dòng sổ tiền về (prod không bao giờ mất — lỗi phân loại ở prod là im lặng). Lỗi ⇒ lùi về
    // savepoint (kể cả khi Postgres đã ở trạng thái aborted), log CỐ ĐỊNH chỉ id + tên lớp lỗi, đánh dấu
    // classifyError; `replayFrom` chạy lại phân loại sau (chốt "đã xử lý" giữ idempotent).
    await tx.$executeRawUnsafe('SAVEPOINT bank_phan_loai');
    try {
      if (chieu === 'out') {
        const o = await this.phanLoaiOut(tx, t);
        r.classified = o.classified;
        if (o.reqId !== null) r.chiMatchRequestId = o.reqId;
      } else {
        const i = await this.phanLoaiIn(tx, t);
        r.classified = i.classified;
        if (i.cusId !== '') r.cusId = i.cusId;
      }
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT bank_phan_loai');
    } catch (x) {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT bank_phan_loai');
      r.classified = false;
      delete r.chiMatchRequestId;
      delete r.cusId;
      r.classifyError = true;
      this.logger.error(
        `[BANK-CLS] phân loại thất bại bankTxId=${t.bankTxId} sepayId=${t.bankid} tk=${t.tk} loi=${tenLoi(x)}`,
      );
    }
    return r;
  }

  /** Gán khách 3 tầng (:244-311). */
  private async timKhach(tx: Tx, plainMess: string): Promise<string> {
    // Tầng 1: mã TBS#### ở bất kỳ vị trí (khách đang hoạt động).
    const codeA = maTBS(plainMess);
    if (codeA !== null && (await this.khachHoatDong(tx, codeA))) return codeA;

    // 3.000 dòng ĐÃ gán gần nhất — prod truy vấn y hệt ở tầng 2 và tầng 3; đọc một lần trong cùng tx.
    let lichSu: { tranMess: string | null; cusId: string | null }[] | null = null;
    const docLichSu = async () =>
      (lichSu ??= await tx.bankTransaction.findMany({
        where: { cusId: { not: null }, NOT: { cusId: '' } },
        select: { tranMess: true, cusId: true },
        orderBy: { id: 'desc' },
        take: LICH_SU_GAN,
      }));
    /** `count($cands)===1` (100% một khách) && ≥ 2 lần && khách hoạt động. */
    const chon = async (cands: Map<string, number>): Promise<string> => {
      if (cands.size !== 1) return '';
      const [top, n] = cands.entries().next().value as [string, number];
      return n >= 2 && (await this.khachHoatDong(tx, top)) ? top : '';
    };

    // Tầng 2: "vân tay" nội dung.
    const sigA = chuKy(plainMess);
    if (
      mbLen(sigA) >= 8 &&
      !CUM_CHUNG_CHUNG.has(sigA) &&
      sigA.split(' ').filter((x) => x !== '' && x !== '0').length >= 3
    ) {
      const cands = new Map<string, number>();
      for (const r of await docLichSu()) {
        if (chuKy(r.tranMess ?? '') === sigA) cands.set(r.cusId!, (cands.get(r.cusId!) ?? 0) + 1);
      }
      const k = await chon(cands);
      if (k !== '') return k;
    }

    // Tầng 3: tên người gửi — chạy cả khi tầng 2 bị loại vì ngưỡng, miễn `$sigA !== ''`.
    if (sigA !== '') {
      const sndA = tenNguoiGui(sigA);
      if (sndA !== '') {
        const cands3 = new Map<string, number>();
        for (const r of await docLichSu()) {
          const snd3 = tenNguoiGui(chuKy(r.tranMess ?? '', false)); // lịch sử tầng 3 KHÔNG cắt 60
          if (snd3 !== '' && snd3 === sndA) cands3.set(r.cusId!, (cands3.get(r.cusId!) ?? 0) + 1);
        }
        const k = await chon(cands3);
        if (k !== '') return k;
      }
    }
    return '';
  }

  /**
   * Nhận một giao dịch SePay (`bank-sepay-hook.php:17-85`, §10.3).
   * Trả: 'ignored' (transferType ∉ {in,out} hoặc id rỗng) · 'duplicate' (đã có bankid) ·
   * 'unmapped' (STK không ánh xạ ví đang bật — KHÔNG ghi gì, như prod `die` trước INSERT) ·
   * 'recorded' (đã lưu giao dịch, không ghi sổ: chiều out / tiền ≤ 0 / chi_ghi_nhan) · 'posted'.
   * Lỗi ghi sổ/giao dịch ⇒ NÉM, tx lùi toàn bộ; GL chỉ chạy khi tx đã commit và lỗi GL KHÔNG ném (chỉ log).
   */
  async ingest(payload: SepayPayload, opts: IngestOpts = {}): Promise<IngestResult> {
    const mode: IngestMode = opts.mode ?? 'ghi_so';
    if (mode !== 'ghi_so' && mode !== 'chi_ghi_nhan') throw new BankIngestError('mode không hợp lệ');

    const p = (payload ?? {}) as SepayPayload;
    const transferType = p.transferType;
    if (transferType !== 'in' && transferType !== 'out') return { status: 'ignored' }; // :19 in_array strict
    const bankid = phpStr(p.id);
    if (bankid === '') return { status: 'ignored' }; // :22

    const stk = phpStr(p.accountNumber);
    const content = phpStr(p.content);
    const amount = toDong(p.transferAmount);
    const tranTime = tranTimeMs(p.transactionDate);

    type Out = { res: IngestResult; gl?: { histId: number; tk: string } };
    let out: Out;
    try {
      out = await this.prisma.$transaction(
        async (tx): Promise<Out> => {
          await this.lockBankId(tx, bankid);
          const dup = await tx.bankTransaction.findFirst({ where: { bankid }, select: { id: true } });
          if (dup) return { res: { status: 'duplicate', bankTxId: Number(dup.id) } };

          const tk = await this.findBySTK(tx, stk);
          if (!tk) return { res: { status: 'unmapped' } };

          const bt = await tx.bankTransaction.create({
            data: {
              bankid,
              bankName: phpStr(p.gateway),
              bankAccount: stk,
              tranType: transferType === 'in' ? '+' : '-',
              tranAmount: amount,
              tranTime,
              tranMess: content,
              originMess: content,
              cdate: nowSec(),
              status: 'no',
              confirm: 'no',
              tkCode: tk,
            },
            select: { id: true },
          });
          const bankTxId = Number(bt.id);

          // Công tắc đóng băng: CHỈ lưu giao dịch — không sổ, không GL, không phân loại, không gán khách.
          if (mode === 'chi_ghi_nhan') return { res: { status: 'recorded', bankTxId } };

          // Ghi sổ + :86-321 — cùng routine với replayFrom, cùng tx (lỗi ⇒ NÉM, lùi cả giao dịch).
          const info: TxInfo = { bankTxId, bankid, bankName: phpStr(p.gateway), amount, tk, content };
          const r = await this.sauInsert(tx, info, transferType);
          const res: IngestResult = r.histId ? { status: 'posted', bankTxId, histId: r.histId } : { status: 'recorded', bankTxId };
          if (r.chiMatchRequestId !== undefined) res.chiMatchRequestId = r.chiMatchRequestId;
          if (r.cusId !== undefined) res.cusId = r.cusId;
          if (r.classifyError) res.classify = 'error';
          return { res, gl: r.histId ? { histId: r.histId, tk } : undefined };
        },
        { timeout: 20000, maxWait: 20000 },
      );
    } catch (x) {
      if (x instanceof BankIngestError) throw x;
      // Không nối chi tiết lỗi gốc (có thể mang giá trị cột) vào thông điệp.
      throw new BankIngestError('Ghi giao dịch ngân hàng thất bại', { cause: x });
    }

    if (out.gl) out.res.gl = await this.postGl(out.res.bankTxId!, out.gl.histId, out.gl.tk, amount, content);
    return out.res;
  }

  /**
   * Ghi bù sau cửa sổ đóng băng (§10.3, T2/F7): mỗi dòng ghi nhận trong `chi_ghi_nhan` phải kết thúc ở
   * ĐÚNG trạng thái như khi được ingest bình thường. Phạm vi: `markExclusive < id ≤ toInclusive` — CẢ HAI bắt
   * buộc (final review M2): `toInclusive` = id giao dịch lớn nhất lúc KẾT THÚC cửa sổ đóng băng, để một lượt
   * chạy lại sau khi luồng sống đã mở lại không đụng dòng ingest thường (vd gán khách lại dòng kế toán đã
   * cố ý gỡ). Mốc phải > 0 và `toInclusive ≥ markExclusive + 1`, cả hai số nguyên ⇒ ngược lại NÉM.
   * Dòng: `bankid <> ''` (CHỈ dòng từ SePay), `tranType` '+'/'-', `tk_code` là ví có thật (ingest chỉ
   * INSERT dòng có ví) ⇒ `sauInsert` — ĐÚNG routine của ingest, cùng thứ tự, trên nội dung GỐC `originMess`.
   * Chốt "đã xử lý" (chạy lại ⇒ no-op): đã có dòng sổ ('bank_tx', id) — kể cả đã ĐẢO; đã có dòng chi tiết;
   * chi_match hiệu lực; cus_id đã có.
   *
   * ⚠⚠ ĐIỀU KIỆN CHO L8/L9 (cổng DUYỆT phân bổ bank — prod `process_duyet.php` `!da_len_vi` ⇒ INSERT
   * tbl_account_histories(… tran_id, trandetail_id)): chốt chống ghi đôi dòng sổ ở đây CHỈ nhìn
   * `source_module='bank_tx' AND source_id=id`. Khi port cổng duyệt, dòng sổ nó ghi PHẢI mang
   * source ('bank_tx', id giao dịch) — HOẶC mở rộng chốt ở `sauInsert` để kiểm thêm `TreasuryEntry.tranId = id` —
   * nếu không, duyệt một dòng của cửa sổ đóng băng TRƯỚC khi replay sẽ làm replay ghi sổ LẦN HAI.
   * (Hoặc runbook: khoá duyệt bank cho tới khi replay xong.) (final review M4)
   *
   * Mỗi dòng một tx, dưới cùng khoá id SePay với ingest (đọc lại dòng DƯỚI khoá). Dòng lỗi ⇒ tx dòng đó lùi,
   * id vào `failed`, log CỐ ĐỊNH chỉ id + tên lớp lỗi; các dòng khác vẫn chạy. Phân loại lỗi (SAVEPOINT) ⇒
   * dòng sổ vẫn ghi và được đếm, id cũng vào `failed`. GL sau commit từng dòng (lỗi GL chỉ log).
   */
  async replayFrom(markExclusive: number | bigint, toInclusive: number | bigint): Promise<ReplayResult> {
    const soNguyen = (v: unknown) =>
      typeof v === 'bigint' || (typeof v === 'number' && Number.isSafeInteger(v));
    if (!soNguyen(markExclusive) || !soNguyen(toInclusive)) {
      throw new BankIngestError('Mốc/trần replayFrom phải là số nguyên');
    }
    const mark = BigInt(markExclusive);
    const tran = BigInt(toInclusive);
    if (mark <= 0n) throw new BankIngestError('Mốc replayFrom phải là số nguyên > 0');
    if (tran < mark + 1n) throw new BankIngestError('Trần replayFrom phải ≥ mốc + 1');
    const codes = (await this.prisma.fundAccount.findMany({ select: { code: true } })).map((a) => a.code);
    const rows = await this.prisma.bankTransaction.findMany({
      where: { id: { gt: mark, lte: tran }, tranType: { in: ['+', '-'] }, bankid: { not: '' }, tkCode: { in: codes, not: '' } },
      select: { id: true, bankid: true },
      orderBy: { id: 'asc' },
    });

    const out: ReplayResult = { posted: 0, classified: 0, assigned: 0, failed: [] };
    for (const row of rows) {
      const bankTxId = Number(row.id);
      let done: { r: SauInsert; t: TxInfo };
      try {
        done = await this.prisma.$transaction(
          async (tx) => {
            await this.lockBankId(tx, row.bankid);
            const cur = await tx.bankTransaction.findUniqueOrThrow({ where: { id: row.id } }); // đọc DƯỚI khoá
            const t: TxInfo = {
              bankTxId,
              bankid: cur.bankid,
              bankName: cur.bankName ?? '',
              amount: cur.tranAmount ?? 0n,
              tk: cur.tkCode,
              // M5: nội dung GỐC — cái ingest thường đã dùng (= payload.content); tranMess có thể bị sửa tay.
              content: cur.originMess ?? cur.tranMess ?? '',
            };
            const r = await this.sauInsert(tx, t, cur.tranType === '+' ? 'in' : 'out');
            return { r, t };
          },
          { timeout: 20000, maxWait: 20000 },
        );
      } catch (x) {
        out.failed.push(bankTxId);
        this.logger.error(`[REPLAY-BANKTX] ghi bù thất bại bankTxId=${bankTxId} loi=${tenLoi(x)}`);
        continue;
      }
      // Phân loại lỗi (đã lùi về savepoint, đã log): dòng sổ vẫn ghi & được đếm; id vào failed để chạy lại.
      if (done.r.classifyError) out.failed.push(bankTxId);
      if (done.r.classified) out.classified++;
      if (done.r.cusId !== undefined) out.assigned++;
      if (done.r.histId) {
        out.posted++;
        // lỗi GL vẫn đếm dòng sổ
        await this.postGl(bankTxId, done.r.histId, done.t.tk, done.t.amount, done.t.content);
      }
    }
    return out;
  }
}
