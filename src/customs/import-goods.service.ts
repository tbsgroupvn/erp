// src/customs/import-goods.service.ts — #08 Task 4
//
// Tái hiện NGUYÊN VĂN `ImportGoodsUpsert($row)` (global/libs/gffunc.php:585)
// — hàm upsert 1 dòng vào tbl_import_goods, dùng khi tờ khai chuyển "đã
// thông quan" (write-back làm giàu dữ liệu) hoặc gọi thủ công (đồng bộ Lark
// lịch sử, upload file...).
//
// goods_key = mb_strtolower(product_name).."|"..mb_strtolower(spec), cắt
// còn 500 ký tự (varchar(500)) — DÙNG ĐỂ SO KHỚP đã tồn tại hay chưa, KHÔNG
// dùng id. Quy tắc ON DUPLICATE KEY UPDATE gốc:
//   - hsCode/declaredNameVi/En/Cn/declaredUnit: chỉ ghi đè khi giá trị MỚI
//     khác rỗng (IF(VALUES(x)<>'', VALUES(x), x)) — tránh 1 lần ghi thiếu
//     trường xoá mất dữ liệu đã có.
//   - importDutyRate/consumptionTaxRate/vatRate: LUÔN ghi đè bằng giá trị
//     mới (mặc định 0 nếu không truyền).
//   - min/max_declared_price_usd: LEAST/GREATEST tích luỹ — dải giá khai
//     LỊCH SỬ, không phải giá lần này.
//   - last_declared_price_usd: COALESCE(giá mới, giá cũ) — giá LẦN GẦN
//     NHẤT, khác max.
//   - source: giữ nguyên nếu đang là 'manual' (ai đó XÁC NHẬN bằng tay thì
//     đồng bộ tự động sau không được ghi đè); ngược lại lấy nguồn mới nhất.
//   - times_used += 1 mỗi lần upsert.
//
// ⚠⚠ KHOÁ HỒ SƠ ĐÃ DUYỆT (hs_status=2, gffunc.php:625-634, cùng ngày với
// cls.goods_hoso.php 25/08/2026): nếu dòng đã duyệt thì upsert CHỈ được cập
// nhật times_used + dải giá khai lịch sử (số liệu quan trắc), TUYỆT ĐỐI
// không sửa nội dung hồ sơ (hs_code/tên khai/thuế suất...). §4.8 — đo prod
// 23/09/2026: hs_status=0 trên TOÀN BỘ 690/690 dòng, nghĩa là NHÁNH NÀY
// CHƯA TỪNG CHẠY THẬT trên dữ liệu hiện có. Vẫn giữ trong service vì đây là
// một phần của CHÍNH HÀM upsert được copy nguyên văn — Task 4 KHÔNG dựng
// thêm service/endpoint duyệt HS mới (trình duyệt, pending_json...), đúng
// yêu cầu brief.
//
// ⚠⚠⚠ fix-round-1 (Task 4, 23/09/2026): schema đã khôi phục đúng prod —
// goods_key NOT NULL + UNIQUE(uq_goods_key), và 7 cột
// origin/status/created_by,at/updated_by,at/last_used_at. Đồng thời khai
// thác thật UNIQUE(goods_key) để upsert ATOMICALLY thay vì
// findFirst+create/update (check-then-act, có race — 2 lượt gọi đồng thời
// cùng goods_key trước đây có thể CẢ HAI cùng thấy "chưa có" rồi CẢ HAI
// cùng insert).
//
// ⚠⚠⚠ D3 (review cuối #08, 23/09/2026) — SỬA MỘT KHẲNG ĐỊNH SAI VỀ CHÍNH
// HÀM GỐC. Ở đây từng viết rằng upsert() không ghi 7 cột kia vì "không nơi
// nào trong ImportGoodsUpsert($row) gốc đụng tới chúng". ĐỌC LẠI mã prod
// (global/libs/gffunc.php:585-662): hàm gốc ĐỤNG TỚI SÁU trong bảy cột, và
// KHÁC NHAU giữa nhánh INSERT và nhánh UPDATE:
//
//   INSERT                    : origin · last_used_at=NOW() · created_by=$username · created_at=NOW()
//   ON DUPLICATE KEY UPDATE   : origin=IF(VALUES(origin)<>'',VALUES(origin),origin)
//                               · last_used_at=NOW() · updated_by=$username · updated_at=NOW()
//   nhánh KHOÁ (hs_status=2)  : times_used+1 · last_used_at=NOW() · dải giá
//                               (KHÔNG đụng origin/updated_by/updated_at —
//                                đó là một UPDATE RIÊNG chạy rồi `return`
//                                TRƯỚC câu INSERT, nên các cột kia không thể
//                                bị ghi ở nhánh này)
//
// `created_*` CHỈ ở nhánh insert, `updated_*` CHỈ ở nhánh update — đúng
// nghĩa của hai cặp cột, không phải chi tiết vụn.
//
// ⚠⚠ `origin` là cột NGUY HIỂM NHẤT trong sáu: cột Postgres có
// `DEFAULT 'CN'`, nên nếu câu INSERT KHÔNG liệt kê nó, một mặt hàng xuất xứ
// Thái Lan sẽ được ghi thành hàng Trung Quốc — SAI LẶNG LẼ, không exception,
// không NULL để ai đó nhận ra. Xuất xứ là một tiêu chí khai hải quan và là
// đầu vào của phép kiểm ưu đãi Form E / ACFTA (cls.container.php:1873).
// Bản PHP gốc LUÔN liệt kê `origin` trong câu INSERT với giá trị
// `trim($row['origin'] ?? '')` — tức CHUỖI RỖNG khi không truyền, KHÔNG BAO
// GIỜ rơi vào DEFAULT. Bản port dưới đây làm y hệt: `origin` luôn có mặt
// trong danh sách cột INSERT. Đừng bỏ nó ra "cho gọn".
//
// Cơ chế: 1 câu `INSERT ... ON CONFLICT (goods_key) DO UPDATE` — TƯƠNG ĐƯƠNG
// đúng cơ chế MySQL `INSERT ... ON DUPLICATE KEY UPDATE` của hàm gốc, không
// phải một cách khác đi. Toàn bộ nhánh rẽ (khoá hs_status=2 vs merge
// thường, IF<>'' giữ non-empty, LEAST/GREATEST dải giá, giữ 'manual')
// được biểu diễn bằng CASE ngay trong SET — Postgres thực thi MỘT statement
// nguyên tử, không có cửa sổ đọc-rồi-quyết-rồi-ghi nào lộ ra cho race.
// `(xmax = 0)` là idiom chuẩn của Postgres để phân biệt INSERT/UPDATE trong
// RETURNING của 1 câu ON CONFLICT — có ca test riêng xác nhận nhãn trả về
// đúng ('inserted'/'merged'/'locked'), không chỉ tin suông vào idiom.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ImportGoodsUpsertInput {
  productName: string;
  spec?: string | null;
  hsCode?: string | null;
  declaredNameVi?: string | null;
  declaredNameEn?: string | null;
  declaredNameCn?: string | null;
  declaredUnit?: string | null;
  /**
   * ⚠⚠⚠ D3 — XUẤT XỨ. Cột `origin` có `DEFAULT 'CN'` ở tầng CSDL; nếu tham
   * số này vắng mặt khỏi câu INSERT thì một mặt hàng Thái Lan sẽ được ghi
   * thành hàng Trung Quốc mà không một lỗi nào nổ ra. Không truyền -> ghi
   * CHUỖI RỖNG (đúng hành vi `trim($row['origin'] ?? '')` của PHP gốc),
   * KHÔNG rơi vào DEFAULT.
   */
  origin?: string | null;
  /**
   * Người thao tác — đi vào `created_by` (nhánh insert) hoặc `updated_by`
   * (nhánh merge), đúng như `$row['username']` của `ImportGoodsUpsert`.
   * Không truyền -> chuỗi rỗng, y như PHP gốc (`addslashes($row['username']
   * ?? '')`), chứ không phải NULL.
   */
  username?: string | null;
  importDutyRate?: number | null;
  consumptionTaxRate?: number | null;
  vatRate?: number | null;
  /** Giá khai USD của lần ghi nhận này (nullable — không phải lần nào cũng có giá). */
  priceUsd?: number | null;
  source?: 'manual' | 'from_declaration' | 'lark_import';
  policyNotes?: string | null;
}

export type ImportGoodsUpsertResult = 'inserted' | 'merged' | 'locked' | false;

export type PriceWarningLevel = 'below_min' | 'above_max' | null;

/**
 * ⚠⚠ Review cuối #08, Ruling 3 — NGUỒN của dải giá, không phải mức nghiêm
 * trọng. `'goods'` = dải giá của ĐÚNG MỘT mặt hàng (tra theo id);
 * `'hs'` = dải giá GỘP của mọi mặt hàng cùng mã HS; `null` = không tìm
 * thấy gì để so.
 *
 * Bắt buộc phải có vì prod chấm điểm HAI NGUỒN NÀY KHÁC NHAU:
 * `libs/cls.pipeline.php` cho "khớp đúng mặt hàng" mức ĐỎ và "chỉ khớp theo
 * HS" mức VÀNG. Nếu kết quả chỉ trả `[min,max] + level` thì bên gọi KHÔNG
 * THỂ biết mình vừa nhận dải nào ⇒ không thể tái hiện cách chấm của prod.
 * `canhBaoGiaKhai()` cố ý KHÔNG tự chấm màu (hai nơi trên prod dùng hai
 * chính sách khác nhau — xem ghi chú ở thân hàm), nên nó phải trả đủ THÔNG
 * TIN để bên gọi chấm.
 */
export type PriceWarningMatchedBy = 'goods' | 'hs' | null;

export interface PriceWarning {
  level: PriceWarningLevel;
  matchedBy: PriceWarningMatchedBy;
  min: number | null;
  max: number | null;
}

const HS_STATUS_DA_DUYET = 2; // CLS_GOODS_HOSO::DA_DUYET

@Injectable()
export class ImportGoodsService {
  constructor(private prisma: PrismaService) {}

  // Nguyên văn: addslashes(mb_substr(mb_strtolower($name).'|'.mb_strtolower($spec), 0, 500))
  // — addslashes chỉ cần khi tự dựng SQL thô (PHP), Prisma tham số hoá sẵn
  // nên bỏ, còn lại giữ đúng: hạ chữ thường, nối '|', cắt 500 ký tự.
  static buildGoodsKey(productName: string, spec: string | null | undefined): string {
    const name = (productName ?? '').trim().toLowerCase();
    const s = (spec ?? '').trim().toLowerCase();
    return `${name}|${s}`.slice(0, 500);
  }

  async upsert(input: ImportGoodsUpsertInput): Promise<ImportGoodsUpsertResult> {
    const productName = (input.productName ?? '').trim();
    if (productName === '') return false; // $name==='' -> return false (gffunc.php:597)

    const goodsKey = ImportGoodsService.buildGoodsKey(productName, input.spec);
    const price =
      input.priceUsd != null && !Number.isNaN(input.priceUsd) ? input.priceUsd : null;
    const source = input.source ?? 'from_declaration';
    const spec = (input.spec ?? '').trim();
    const hsCode = (input.hsCode ?? '').trim();
    const declaredNameVi = (input.declaredNameVi ?? '').trim();
    const declaredNameEn = (input.declaredNameEn ?? '').trim();
    const declaredNameCn = (input.declaredNameCn ?? '').trim();
    const declaredUnit = (input.declaredUnit ?? '').trim();
    // ⚠ D3 — nguyên văn `$origin = trim($row['origin'] ?? '')`: KHÔNG truyền
    // nghĩa là CHUỖI RỖNG, không phải "để DB tự điền 'CN'".
    const origin = (input.origin ?? '').trim();
    // Nguyên văn `$username = addslashes($row['username'] ?? '')`.
    const username = (input.username ?? '').trim();
    const importDutyRate = input.importDutyRate ?? 0;
    const consumptionTaxRate = input.consumptionTaxRate ?? 0;
    const vatRate = input.vatRate ?? 0;
    const policyNotes = (input.policyNotes ?? '').trim();

    // 1 câu INSERT...ON CONFLICT nguyên tử — xem giải thích cơ chế ở đầu
    // file. CASE nhánh KHOÁ (hs_status=2) giữ nguyên mọi cột hồ sơ, CHỈ
    // times_used + dải giá được cập nhật — đúng gffunc.php:625-634.
    // policy_notes CỐ Ý vắng mặt khỏi SET: nguyên văn PHP chỉ ghi lúc TẠO
    // MỚI, không ghi đè bản ghi đã có (comment gốc: "chi ghi khi tao moi").
    const rows = await this.prisma.$queryRaw<
      Array<{ id: number; wasInsert: boolean; hsStatusAfter: number }>
    >`
      INSERT INTO tbl_import_goods (
        goods_key, product_name, spec, hs_code,
        declared_name_vi, declared_name_en, declared_name_cn, declared_unit,
        origin,
        import_duty_rate, consumption_tax_rate, vat_rate,
        min_declared_price_usd, max_declared_price_usd, last_declared_price_usd,
        policy_notes, source, times_used, hs_status,
        last_used_at, created_by, created_at
      ) VALUES (
        ${goodsKey}, ${productName}, ${spec}, ${hsCode},
        ${declaredNameVi}, ${declaredNameEn}, ${declaredNameCn}, ${declaredUnit},
        ${origin},
        ${importDutyRate}::numeric, ${consumptionTaxRate}::numeric, ${vatRate}::numeric,
        ${price}::numeric, ${price}::numeric, ${price}::numeric,
        ${policyNotes}, ${source}::"ImportGoodsSource", 1, 0,
        NOW(), ${username}, NOW()
      )
      ON CONFLICT (goods_key) DO UPDATE SET
        hs_code = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.hs_code
          WHEN ${hsCode} <> '' THEN ${hsCode}
          ELSE tbl_import_goods.hs_code END,
        declared_name_vi = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.declared_name_vi
          WHEN ${declaredNameVi} <> '' THEN ${declaredNameVi}
          ELSE tbl_import_goods.declared_name_vi END,
        declared_name_en = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.declared_name_en
          WHEN ${declaredNameEn} <> '' THEN ${declaredNameEn}
          ELSE tbl_import_goods.declared_name_en END,
        declared_name_cn = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.declared_name_cn
          WHEN ${declaredNameCn} <> '' THEN ${declaredNameCn}
          ELSE tbl_import_goods.declared_name_cn END,
        declared_unit = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.declared_unit
          WHEN ${declaredUnit} <> '' THEN ${declaredUnit}
          ELSE tbl_import_goods.declared_unit END,
        import_duty_rate = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.import_duty_rate
          ELSE ${importDutyRate}::numeric END,
        consumption_tax_rate = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.consumption_tax_rate
          ELSE ${consumptionTaxRate}::numeric END,
        vat_rate = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.vat_rate
          ELSE ${vatRate}::numeric END,
        min_declared_price_usd = CASE
          WHEN ${price}::numeric IS NULL THEN tbl_import_goods.min_declared_price_usd
          ELSE LEAST(COALESCE(tbl_import_goods.min_declared_price_usd, ${price}::numeric), ${price}::numeric) END,
        max_declared_price_usd = CASE
          WHEN ${price}::numeric IS NULL THEN tbl_import_goods.max_declared_price_usd
          ELSE GREATEST(COALESCE(tbl_import_goods.max_declared_price_usd, ${price}::numeric), ${price}::numeric) END,
        last_declared_price_usd = COALESCE(${price}::numeric, tbl_import_goods.last_declared_price_usd),
        source = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.source
          WHEN tbl_import_goods.source = 'manual' THEN tbl_import_goods.source
          ELSE ${source}::"ImportGoodsSource" END,
        -- D3: nguyên văn origin = IF(VALUES(origin)<>'', VALUES(origin), origin)
        -- ở nhánh merge — xuất xứ MỚI chỉ ghi đè khi khác rỗng (một lần đồng
        -- bộ thiếu trường không được xoá xuất xứ đã biết). Nhánh KHOÁ
        -- (hs_status=2) giữ nguyên: UPDATE riêng của PHP gốc không đụng cột
        -- này.
        origin = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.origin
          WHEN ${origin} <> '' THEN ${origin}
          ELSE tbl_import_goods.origin END,
        times_used = tbl_import_goods.times_used + 1,
        -- D3: last_used_at = NOW() ở CẢ HAI nhánh (merge VÀ khoá) — đây là
        -- số liệu QUAN TRẮC ("lần cuối dùng đến mặt hàng này"), không phải
        -- nội dung hồ sơ, nên hồ sơ đã duyệt vẫn được cập nhật. Đúng
        -- gffunc.php:628, nơi UPDATE nhánh khoá đặt
        -- times_used=times_used+1, last_used_at=NOW().
        last_used_at = NOW(),
        -- D3: updated_by/updated_at CHỈ ở nhánh merge. Nhánh khoá KHÔNG ghi
        -- (UPDATE riêng của PHP gốc không có hai cột này), và
        -- created_by/created_at KHÔNG xuất hiện ở đây chút nào — chúng chỉ
        -- thuộc nhánh INSERT phía trên, đúng như MySQL ON DUPLICATE KEY
        -- UPDATE của hàm gốc.
        updated_by = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.updated_by
          ELSE ${username} END,
        updated_at = CASE
          WHEN tbl_import_goods.hs_status = ${HS_STATUS_DA_DUYET} THEN tbl_import_goods.updated_at
          ELSE NOW() END
      RETURNING id, (xmax = 0) AS "wasInsert", hs_status AS "hsStatusAfter"
    `;

    const row = rows[0];
    if (row.wasInsert) return 'inserted';
    if (row.hsStatusAfter === HS_STATUS_DA_DUYET) return 'locked';
    return 'merged';
  }

  // §4.10 — cảnh báo khi giá khai NGOÀI dải [min,max] lịch sử của hàng.
  // hsOrGoodsId là number -> tra ĐÚNG 1 dòng ImportGoods theo id (dải giá
  // riêng của chính mặt hàng đó). Là string -> tra theo hs_code, GỘP dải
  // giá của MỌI mặt hàng cùng mã HS (MIN-của-các-min / MAX-của-các-max) —
  // cùng tinh thần fallback "đối chiếu theo mã HS, chỉ tham khảo" của
  // cls.pipeline.php khi không có mặt hàng khớp CHÍNH XÁC.
  //
  // ⚠ Đây là phần "biên" ngoài dải theo ĐÚNG nghĩa tên cột (giá < min HOẶC
  // giá > max). Prod có HAI cách tính khác nhau dùng dải này cho hai mục
  // đích khác nhau — không cái nào là "canhBaoGiaKhai" dùng chung:
  //   - ajaxs/container/process_ai_check.php: nới biên 0.5x/2x để giảm
  //     nhiễu cho severity của module AI-check (ngoài phạm vi #08 Task 4).
  //   - libs/cls.pipeline.php: so trực tiếp với min/max NHƯNG phân biệt
  //     "khớp đúng mặt hàng" (severity đỏ) và "chỉ khớp theo HS" (vàng) —
  //     đó là severity của module risk-dashboard PO pipeline (§4.9, ngoài
  //     phạm vi đợt 1, xem plan "Ngoài phạm vi, có số đo").
  // canhBaoGiaKhai() ở đây chỉ trả biên [min,max] thô + which side — việc
  // gắn màu/độ nghiêm trọng là của lớp gọi (Task 5/UI), tránh cài lại 1
  // trong hai bộ luật trên và lỡ chọn nhầm cho use-case còn lại.
  async canhBaoGiaKhai(hsOrGoodsId: number | string, giaUsd: number): Promise<PriceWarning> {
    if (!(giaUsd > 0)) return { level: null, matchedBy: null, min: null, max: null };

    let min: number | null = null;
    let max: number | null = null;
    // ⚠ Ruling 3 (review cuối #08): bên gọi PHẢI phân biệt được dải giá đến
    // từ ĐÚNG mặt hàng hay từ tổng hợp theo mã HS — prod chấm hai nguồn này
    // hai mức khác nhau. `matchedBy` nói lên CÓ TÌM THẤY MẶT HÀNG hay không,
    // độc lập với việc mặt hàng đó có dải giá hay chưa (min/max có thể NULL
    // mà vẫn là một lần khớp goods/hs thật).
    let matchedBy: PriceWarningMatchedBy = null;

    if (typeof hsOrGoodsId === 'number') {
      const row = await this.prisma.importGoods.findUnique({ where: { id: hsOrGoodsId } });
      if (row) {
        matchedBy = 'goods';
        min = row.minDeclaredPriceUsd != null ? Number(row.minDeclaredPriceUsd) : null;
        max = row.maxDeclaredPriceUsd != null ? Number(row.maxDeclaredPriceUsd) : null;
      }
    } else {
      const hs = (hsOrGoodsId ?? '').trim();
      if (hs !== '') {
        const agg = await this.prisma.importGoods.aggregate({
          where: { hsCode: hs },
          _count: { _all: true },
          _min: { minDeclaredPriceUsd: true },
          _max: { maxDeclaredPriceUsd: true },
        });
        if (agg._count._all > 0) matchedBy = 'hs';
        min = agg._min.minDeclaredPriceUsd != null ? Number(agg._min.minDeclaredPriceUsd) : null;
        max = agg._max.maxDeclaredPriceUsd != null ? Number(agg._max.maxDeclaredPriceUsd) : null;
      }
    }

    if (min !== null && min > 0 && giaUsd < min) return { level: 'below_min', matchedBy, min, max };
    if (max !== null && max > 0 && giaUsd > max) return { level: 'above_max', matchedBy, min, max };
    return { level: null, matchedBy, min, max };
  }
}
