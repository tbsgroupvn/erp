// src/customs/decl-source.service.ts — #08 Task 2
//
// ⚠⚠⚠ Tái hiện NGUYÊN VĂN `tbs_decl_tach_nen_thue(declItemId, triGiaKhaiVnd)`
// (libs/decl_source.php:203). Xem
// F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-08-haiquan-plan.md
// mục "⚠⚠⚠ CÔNG THỨC — chép từ mã prod, KHÔNG suy từ spec".
//
// Tách trị giá khai VND (đã quy đổi từ USD ở nơi gọi) thành ba phần: tiền
// hàng (hang), cước về VN (cuoc), và chi phí khác (cpk) — theo ĐÚNG tỷ
// trọng của dòng báo giá gốc đã sinh ra dòng khai này (`quote_items`, tra
// qua `transport_file_items.quote_item_id`).
//
// ⚠ Chia theo TỶ TRỌNG, không cộng thẳng số của báo giá — trị giá khai đã
// đi qua SL dòng khai (có thể khai thiếu) và qua làm tròn đơn giá USD 3 số
// lẻ, nên neo vào chính `triGiaKhaiVnd` giữ cho hang+cuoc+cpk bằng ĐÚNG số
// đã khai, không đẻ ra một con số tổng thứ hai.
//
// ⚠⚠ `cpk` PHẢI là PHẦN DƯ (tong - hang - cuoc), KHÔNG được tính độc lập —
// tính riêng rồi làm tròn sẽ phá vỡ bất biến hang+cuoc+cpk===tong.
//
// ⚠ Không tra được báo giá gốc (quoteItemId rỗng, dòng báo giá không tồn
// tại, hoặc a+s+c<=0) ⇒ coi TOÀN BỘ trị giá khai là tiền hàng, cước=0. Đây
// là phía AN TOÀN (nền nhập khẩu RỘNG HƠN, tính thuế nhiều hơn chứ không ít
// hơn) — KHÔNG phải phía khai thiếu. Đừng "sửa" thành chia đều hay bỏ qua.
// ⚠ NGOẠI LỆ CHỦ Ý với luật "tiền không dùng float" của dự án: dùng `number`
// giống ImportTaxService/quote-calc.ts của #05, cùng lý do (khớp PHP legacy
// bit-để-bit về mặt số học). Cột lưu vẫn là Decimal ở nơi gọi ghi DB.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TachNenThueResult {
  hang: number;
  cuoc: number;
  cpk: number;
  tong: number;
}

export type UsdRateSrc = 'cont' | 'treasury_closed' | 'treasury_today' | 'quote_tam' | 'none';
export interface UsdRateResult {
  rate: number;
  src: UsdRateSrc;
  // Ngày (chỉ NGÀY, giờ VN) gắn với rate được chọn — prod trả kèm 'date'
  // cho cả hai rung treasury (dùng để hiển thị/đối chiếu). Không có ý
  // nghĩa treasury nào cho rung 'cont' (rate chốt thủ công, không tra
  // theo ngày), 'quote_tam' (tỷ giá báo giá, không có "ngày" treasury) hay
  // 'none' (không có rate) -> null ở cả ba trường hợp đó.
  date: Date | null;
}

// #08 Task 5 gap-closing (23/09/2026) — output của usdRateOrQuoteForFile(),
// thêm đúng MỘT trường so với UsdRateResult: `tam` (tạm), đánh dấu rate lấy
// từ báo giá gốc chứ không phải tỷ giá cont thật. Xem method bên dưới.
export interface UsdRateOrQuoteResult extends UsdRateResult {
  tam: boolean;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 cố định — Việt Nam KHÔNG có giờ mùa hè.

// ⚠⚠ IMPORTANT 4 (fix-round-2, 23/09/2026) — "ngày hôm nay" của
// `tbs_decl_usd_rate` là `date('Y-m-d')` chạy trên máy chủ PHP đặt giờ
// VIỆT NAM, KHÔNG phải ngày UTC trần. `new Date()` + so khớp qua getters
// UTC (hoặc dựa vào biến môi trường TZ của tiến trình Node — repo này
// KHÔNG ghim TZ ở đâu cả) sẽ ĐỔI SAI ngày trong khung 00:00–07:00 giờ VN
// mỗi ngày (khi ngày UTC trần vẫn còn là "hôm qua" so với ngày VN thật) —
// một dòng tỷ giá NẠP ĐÚNG HÔM NAY (giờ VN) sẽ bị loại khỏi
// `rate_date<=hôm_nay`, và ngày hôm trước lặng lẽ được dùng thay. Hàm này
// cộng thẳng offset UTC+7 vào thời điểm UTC rồi đọc Y/M/D qua getter UTC
// của kết quả đã dịch — KHÔNG đụng tới TZ của hệ điều hành/tiến trình, nên
// đúng bất kể server chạy ở múi giờ nào. Trả về Date ở UTC-midnight của
// đúng ngày VN đó, khớp định dạng cột `@db.Date`.
export function vnDateOnly(instant: Date): Date {
  const shifted = new Date(instant.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

@Injectable()
export class DeclSourceService {
  constructor(private prisma: PrismaService) {}

  // ⚠⚠⚠ #08 fix-round-1/2 (23/09/2026) — tái hiện NGUYÊN VĂN
  // `tbs_decl_usd_rate($file_id)` (libs/decl_source.php), thang tra tỷ giá
  // USD của một cont:
  //
  //   1. tbl_transport_files.usd_rate_closed > 0 -> dùng thẳng (src='cont')
  //      — tỷ giá ĐÃ CHỐT thủ công khi đóng tờ khai, ưu tiên trên cùng.
  //   2. else nếu closed_at có giá trị -> THỬ getRate('USD', ngày
  //      closed_at). NẾU >0 -> trả (src='treasury_closed').
  //   3. LUÔN LUÔN thử tiếp getRate('USD', hôm nay). NẾU >0 -> trả
  //      (src='treasury_today').
  //   4. else -> {rate:0, src:'none', date:null}
  //
  // ⛔⛔⛔ CRITICAL, đã SỬA (fix-round-2): nguyên bản PHP là `if
  // ($has_closed) { ...; if ($r>0) return ...; }` — KHÔNG CÓ else. Rung 2
  // thất bại (getRate trả 0 vì không có dòng nào <= ngày closed_at) PHẢI
  // RƠI TIẾP xuống rung 3, không được coi là kết thúc thang tra. Bản
  // fix-round-1 trước đây dịch nhầm thành if/else, khiến rung 3 KHÔNG THỂ
  // CHẠM TỚI mỗi khi closed_at có giá trị — dù treasury không có dòng nào
  // khớp ngày đó. Đo prod 23/09/2026: 1/14 cont ĐÃ CÓ closed_at trong khi
  // tbl_exchange_rates 0 dòng — cont đó chỉ cần MỘT dòng tỷ giá nạp sau
  // ngày đóng cont là rơi đúng vào lỗi này (rung 2 thất bại, rung 3 lẽ ra
  // phải chạy nhưng không chạy được ⇒ recalcItemTax zero sạch thuế của một
  // dòng khai đáng lẽ tính được). Xem test
  // "⛔⛔⛔ CRITICAL — rung 2 THẤT BẠI ... PHẢI RƠI TIẾP xuống rung 3" —
  // cổng gác cho đúng hành vi if-không-else này.
  //
  // ⚠ Rung 4 là NƠI HẠ CÁNH DUY NHẤT từng có dữ liệu thật đi qua trên prod
  // TÍNH ĐẾN 23/09/2026 (0 dòng tbl_exchange_rates). `src` đánh dấu "rate
  // CUỐI CÙNG có thật hay không", không chỉ "đã THỬ nguồn nào" — nếu getRate
  // ở rung 2/3 không tìm được dòng nào khớp (trả 0), kết quả rơi tiếp/về
  // 'none' thay vì giữ nhãn rung đã thử với rate=0. Quyết định nhãn này
  // không ảnh hưởng một đồng thuế nào (rate=0 ⇒ recalcItemTax luôn về
  // nhánh no_rate bất kể nhãn src).
  async usdRateForFile(fileId: number): Promise<UsdRateResult> {
    const file = await this.prisma.transportFile.findUnique({
      where: { id: fileId },
      select: { usdRateClosed: true, closedAt: true },
    });
    if (!file) return { rate: 0, src: 'none', date: null };

    const rateClosed = Number(file.usdRateClosed ?? 0);
    if (rateClosed > 0) return { rate: rateClosed, src: 'cont', date: null };

    // Rung 2 — KHÔNG return sớm khi thất bại, rơi tiếp xuống rung 3 (xem
    // cảnh báo CRITICAL phía trên — đây CHÍNH LÀ điểm bản trước sai).
    if (file.closedAt) {
      const closedDate = vnDateOnly(file.closedAt);
      const r = await this.getRate('USD', closedDate);
      if (r > 0) return { rate: r, src: 'treasury_closed', date: closedDate };
    }

    // Rung 3 — LUÔN được thử, có closedAt hay không.
    const today = vnDateOnly(new Date());
    const r2 = await this.getRate('USD', today);
    if (r2 > 0) return { rate: r2, src: 'treasury_today', date: today };

    return { rate: 0, src: 'none', date: null };
  }

  // getRate(currency, asOf) = SELECT rate_vnd FROM tbl_exchange_rates
  // WHERE currency=? AND rate_date<=? ORDER BY rate_date DESC, id DESC
  // LIMIT 1 -> 0 nếu không có dòng nào (nguyên văn CLS_TREASURY::getRate,
  // cộng thêm tiebreaker `id DESC` — IMPORTANT 2 fix-round-2: (currency,
  // rate_date) giờ là UNIQUE trên prod nên về lý thuyết không có 2 dòng
  // trùng ngày, nhưng vẫn giữ tiebreaker tường minh thay vì phụ thuộc thứ
  // tự vật lý không xác định của Postgres khi có bằng nhau).
  private async getRate(currency: 'USD' | 'CNY', asOf: Date): Promise<number> {
    const row = await this.prisma.exchangeRate.findFirst({
      where: { currency, rateDate: { lte: asOf } },
      orderBy: [{ rateDate: 'desc' }, { id: 'desc' }],
    });
    return row ? Number(row.rateVnd) : 0;
  }

  // ⚠⚠⚠ #08 Task 5 gap-closing (23/09/2026) — tái hiện NGUYÊN VĂN
  // `tbs_decl_usd_rate_or_quote($file_id, $quote_item_id)` (libs/decl_source.php:657,
  // đọc trực tiếp trên prod ngày 23/09/2026):
  //
  //   $rr = tbs_decl_usd_rate((int)$file_id); $rr['tam'] = false;
  //   if (floatval($rr['rate']) > 0) return $rr;
  //   $qid = (int)$quote_item_id;
  //   if ($qid <= 0) return $rr;                          // không nối báo giá -> chịu, giữ 0
  //   SELECT q.rate_usd_vnd FROM tbl_quote_items qi
  //     JOIN tbl_quotes q ON q.id = qi.quote_id WHERE qi.id = $qid LIMIT 1
  //   $rate = $r ? floatval($r['rate_usd_vnd']) : 0.0;
  //   if ($rate <= 0) return $rr;
  //   return array('rate'=>$rate,'src'=>'quote_tam','date'=>'','tam'=>true);
  //
  // Lùi thêm MỘT nấc sau thang 4 nấc của usdRateForFile(): CHỈ khi thang gốc
  // thất bại hoàn toàn (rate=0, tức src='none' — không có ngoại lệ nào khác
  // trong usdRateForFile trả rate=0 kèm src khác 'none') VÀ có quoteItemId>0,
  // mới tra ngược `tbl_quotes.rate_usd_vnd` qua CHÍNH dòng báo giá gốc đã
  // sinh ra dòng khai này. Hai điều kiện (fileId hợp lệ, quoteItemId hợp lệ)
  // ĐỘC LẬP nhau đúng như prod — fileId không tồn tại KHÔNG chặn nấc lùi
  // này (xem test "nấc 3d").
  //
  // ⚠ Hàm này CHƯA được `recalcItemTax()` gọi — prod cũng vậy
  // (`_tygiaForFile` trong `cls.container.php:726` gọi THẲNG
  // `tbs_decl_usd_rate`, không phải bản `_or_quote`). Bản `_or_quote` phục
  // vụ một đường KHÁC (`tbs_decl_price_for_quote_item` — định giá USD LẦN
  // ĐẦU cho dòng khai MỚI, "đủ trị giá mà qua được cổng sẵn sàng lên cont"),
  // đường đó nằm NGOÀI phạm vi #08 đợt 1 (chưa dựng service tạo dòng khai
  // mới). Thêm ở đây để không bỏ trống một hàm nguồn đã đo trên prod, KHÔNG
  // phải để đổi hành vi `recalcItemTax()` — đừng nối nó vào đó mà không có
  // quyết định nghiệp vụ riêng.
  async usdRateOrQuoteForFile(fileId: number, quoteItemId: number): Promise<UsdRateOrQuoteResult> {
    const base = await this.usdRateForFile(fileId);
    if (base.rate > 0) return { ...base, tam: false };

    const qid = Number(quoteItemId ?? 0);
    if (!(qid > 0)) return { ...base, tam: false };

    const item = await this.prisma.quoteItem.findUnique({
      where: { id: qid },
      select: { quote: { select: { rateUsdVnd: true } } },
    });
    const rate = item?.quote ? Number(item.quote.rateUsdVnd) : 0;
    if (!(rate > 0)) return { ...base, tam: false };

    return { rate, src: 'quote_tam', date: null, tam: true };
  }

  async tachNenThue(declItemId: number, triGiaKhaiVnd: number): Promise<TachNenThueResult> {
    const tong = triGiaKhaiVnd;
    // Phía AN TOÀN — mọi nhánh "không tra được" ở dưới đều rơi về đây.
    const macDinh: TachNenThueResult = { hang: tong, cuoc: 0, cpk: 0, tong };

    if (declItemId <= 0 || tong <= 0) return macDinh;

    const declItem = await this.prisma.transportFileItem.findUnique({
      where: { id: declItemId },
      select: { quoteItemId: true },
    });
    if (!declItem || declItem.quoteItemId == null) return macDinh;

    const q = await this.prisma.quoteItem.findUnique({
      where: { id: declItem.quoteItemId },
      select: { amountVnd: true, shipToVnVnd: true, otherCost: true },
    });
    if (!q) return macDinh;

    const a = Number(q.amountVnd);
    const s = Number(q.shipToVnVnd);
    const c = Number(q.otherCost);
    const tt = a + s + c;
    if (tt <= 0) return macDinh;

    const hang = tong * (a / tt);
    const cuoc = tong * (s / tt);
    const cpk = tong - hang - cuoc; // PHẦN DƯ — giữ tổng khớp tuyệt đối
    return { hang, cuoc, cpk, tong };
  }
}
