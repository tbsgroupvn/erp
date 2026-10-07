// src/customs/customs-declaration.service.ts — #08 Task 3
//
// ⚠⚠⚠ Tái hiện NGUYÊN VĂN `recalcItemTax(itemId)` (libs/cls.container.php:726).
// Xem F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-08-haiquan-plan.md
// mục "⚠⚠⚠ CÔNG THỨC — chép từ mã prod, KHÔNG suy từ spec".
//
// ⛔⛔ RÀNG BUỘC CỨNG: `ImportTaxService` của #05 (src/quote/import-tax.
// service.ts) là bản cài đặt DUY NHẤT của 5 sắc thuế nhập khẩu. File này
// CẤM cài lại công thức đó — lỗi lịch sử y hệt (báo giá và tờ khai mỗi bên
// một bản) đã gây lệch 4.674.583 đ/dòng ở container 17858. Gọi thẳng
// `ImportTaxService.calc5`.
//
// ⚠⚠ ĐƠN VỊ THUẾ SUẤT NGƯỢC #05: `TransportFileItem.importDutyRate` /
// `consumptionTaxRate` / `antidumpingPct` / `vatRate` đã LÀ PHẦN TRĂM (đo
// prod: import_duty_rate=5.00 nghĩa là 5%) — truyền THẲNG vào `calc5`,
// TUYỆT ĐỐI KHÔNG ×100 (khác #05 quote-calc.ts, nơi báo giá lưu PHÂN SỐ nên
// phải ×100 trước khi gọi cùng hàm `calc5`).
//
// ⚠ `freight_alloc` (phí CIF phân bổ) KHÔNG bao giờ được đọc ở đây — nó
// không đi vào nền thuế NK (huytbs chốt 02/09/2026). Cố tình KHÔNG có biến
// nào đọc `item.freightAlloc` trong file này.
//
// ⚠⚠⚠ `tax_base` CỐ Ý lưu TRỊ GIÁ KHAI quy VND (declaredValue × tygia),
// KHÔNG phải nen.hang (nền hàng sau khi tách cước) — để cột này còn đối
// chiếu được trực tiếp với declared_value × tỷ giá trên lưới báo cáo. Đây
// là quyết định nghiệp vụ đã chốt (cổng gác THUE5-01/02/03 ở bản PHP),
// KHÔNG phải bug — đừng "sửa cho nhất quán" với nen.hang.
//
// ⚠ Nguyên văn cảnh báo trong mã prod: "03/09 khối này ĐÃ BỊ MỘT PHIÊN
// KHÁC ghi đè mất một lần (họ chép file từ bản cũ rồi lưu đè). Nếu thấy
// recalcItemTax quay về tự tính tăng thuế = đã tái diễn."
//
// ⚠ VỀ THAM SỐ `tygia` (cập nhật #08 fix-round-1, 23/09/2026): bản PHP đọc
// tỷ giá của cont qua `_tygiaForFile` = `tbs_decl_usd_rate($file_id)` — nay
// đã có bản port NGUYÊN VĂN ở `DeclSourceService.usdRateForFile()` (thang
// cont -> treasury_closed -> treasury_today -> none). `tygia` ở đây vẫn là
// THAM SỐ TUỲ CHỌN: không truyền thì tự tra qua `usdRateForFile(item.fileId)`;
// có truyền (kể cả 0 hay âm) thì LUÔN là OVERRIDE, bỏ qua thang tra hoàn
// toàn — giữ đúng ý nghĩa các ca test đã viết trước bản vá này (chúng đều
// truyền tygia tường minh để cô lập phép tính thuế khỏi việc tra tỷ giá).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeclSourceService } from './decl-source.service';
import { ImportTaxService } from '../quote/import-tax.service';
import { phpRound } from '../common/money';

export interface RecalcItemTaxOk {
  ok: true;
  msg: string;
  taxBase: number;
  dutyNkAmt: number;
  dutyTtdbAmt: number;
  dutyCbpgAmt: number;
  envtaxVnd: number;
  dutyVatAmt: number;
  totalTax: number;
  // ⚠ CONFIRMED prod 23/09/2026 (coordinator's fix-round-1 measurement of
  // libs/cls.container.php): tax_rate_used IS the exchange rate applied —
  // prod writes `tax_rate_used = round($tygia, 4)` on the success path and
  // `tax_rate_used = 0` alongside the other zeroed columns on `no_rate`
  // ("để lưới biết mà báo 'chưa có tỷ giá', không phải 'hàng miễn thuế'").
  // Not a blended/average tax rate — don't re-derive this from
  // totalTax/taxBase.
  taxRateUsed: number;
}
export interface RecalcItemTaxErr {
  ok: false;
  msg: string;
  error: 'no_rate' | 'not_found';
}
export type RecalcItemTaxResult = RecalcItemTaxOk | RecalcItemTaxErr;

// ⚠⚠⚠ IMPORTANT 3 (fix-round-2, 23/09/2026) — dùng phpRound() dùng chung
// (src/common/money.ts), KHÔNG tự cài `Math.round(v*100)/100` — đó KHÔNG
// khớp PHP round() thật (đo trên prod: round(1.005,2)=1.01 nhưng
// Math.round(1.005*100)/100=1.00; round(-0.125,2)=-0.13 nhưng naive cho
// -0.12). Bản fix-round-1 từng copy-paste công thức naive từ
// src/po/quote-po-diff.service.ts — nay chuyển sang helper dùng chung để
// không tiếp tục nhân bản một công thức sai. Xem phpRound() để biết chi
// tiết + test/money.spec.ts để biết ca kiểm chứng.
function round2(v: number): number {
  return phpRound(v, 2);
}

// Prod lưu tax_rate_used = round($tygia, 4) — khớp @db.Decimal(12,4).
function round4(v: number): number {
  return phpRound(v, 4);
}

@Injectable()
export class CustomsDeclarationService {
  constructor(
    private prisma: PrismaService,
    private declSource: DeclSourceService,
    private importTax: ImportTaxService,
  ) {}

  async recalcItemTax(declItemId: number, tygiaOverride?: number): Promise<RecalcItemTaxResult> {
    const item = await this.prisma.transportFileItem.findUnique({ where: { id: declItemId } });
    if (!item) return { ok: false, msg: 'Không tìm thấy dòng khai ' + declItemId, error: 'not_found' };

    // `tygiaOverride === undefined` -> tự tra qua thang usdRateForFile. Có
    // truyền (kể cả 0/âm) -> dùng ĐÚNG giá trị đó, không đụng tới resolver.
    const tygia = tygiaOverride !== undefined ? tygiaOverride : (await this.declSource.usdRateForFile(item.fileId)).rate;

    // ⚠ Không có tỷ giá thì KHÔNG tính bừa — zero SẠCH mọi cột thuế rồi báo
    // lỗi, KHÔNG để nguyên số của lần tính trước (đó sẽ là số CŨ trông như
    // số ĐÚNG).
    if (tygia <= 0) {
      await this.prisma.transportFileItem.update({
        where: { id: declItemId },
        data: {
          taxBase: 0,
          dutyNkAmt: 0,
          dutyTtdbAmt: 0,
          dutyCbpgAmt: 0,
          envtaxVnd: 0,
          dutyVatAmt: 0,
          totalTax: 0,
          taxRateUsed: 0,
        },
      });
      return { ok: false, msg: 'Không có tỷ giá — đã zero sạch cột thuế của dòng khai', error: 'no_rate' };
    }

    const declaredValue = Number(item.declaredValue ?? 0); // USD
    const quantity = Number(item.quantity ?? 0);
    const pctNk = Number(item.importDutyRate ?? 0); // PHẦN TRĂM — truyền thẳng
    const pctTtdb = Number(item.consumptionTaxRate ?? 0); // PHẦN TRĂM — truyền thẳng
    // ⚠⚠⚠ QUY ƯỚC `antidumpingPct` — ĐỌC TRƯỚC KHI ĐỘNG VÀO DÒNG NÀY.
    // Cột `antidumping_pct decimal(6,4)` mang HÌNH DẠNG phân số (giống mọi
    // cột `*Pct` của #05, nơi 0.05 nghĩa là 5%), nhưng được TIÊU THỤ như
    // PHẦN TRĂM: prod `recalcItemTax` (cls.container.php:726) truyền THẲNG
    // vào hàm 5 sắc thuế, hàm đó nhận phần trăm. Nghĩa là **`5` nghĩa là
    // 5%**, KHÔNG phải 0,05 và KHÔNG phải 500%.
    // ⚠ Đo prod 23/09/2026: `0.0000` ở **145/145 dòng** ⇒ quy ước này CHƯA
    // TỪNG bị dữ liệu thật kiểm chứng theo hướng nào — không có một dòng nào
    // để đối chiếu nếu ai đó "sửa cho nhất quán" với #05. Vì vậy nó được
    // ghim bằng TEST, không chỉ bằng comment: ca "⚠⚠⚠ CỔNG GÁC QUY ƯỚC"
    // trong test/customs/recalc-item-tax.spec.ts khẳng định
    // `antidumpingPct = 5` cho `cbpg = 50.000` trên nền 1.000.000, và loại
    // trừ TƯỜNG MINH cả hai hướng sai (500 kiểu phân số · 5.000.000 kiểu
    // ×100). Ca đó đã được mutation-test bằng `* 100` và `/ 100` — cả hai
    // đều bị bắt đỏ.
    const pctCbpg = Number(item.antidumpingPct ?? 0); // PHẦN TRĂM — truyền thẳng, KHÔNG ×100, KHÔNG ÷100
    const mucBvmt = Number(item.envtaxAmount ?? 0); // tuyệt đối theo lượng
    const pctVat = Number(item.vatRate ?? 0); // PHẦN TRĂM — truyền thẳng

    const tgk = declaredValue * tygia; // trị giá khai quy VND
    const nen = await this.declSource.tachNenThue(declItemId, tgk);

    // ⛔⛔ Gọi THẲNG ImportTaxService.calc5 — cấm cài lại công thức 5 sắc
    // thuế ở đây. Không có phép nhân 100 nào ở dưới: các *Rate/*Pct của
    // dòng khai đã là phần trăm sẵn.
    const t5 = this.importTax.calc5(nen.hang, nen.cuoc, quantity, pctNk, pctTtdb, pctCbpg, mucBvmt, pctVat);

    const taxBase = round2(tgk); // CỐ Ý là trị giá khai, không phải nen.hang
    const dutyNkAmt = round2(t5.nk);
    const dutyTtdbAmt = round2(t5.ttdb);
    const dutyCbpgAmt = round2(t5.cbpg);
    const envtaxVnd = round2(t5.bvmt);
    const dutyVatAmt = round2(t5.vat);
    const totalTax = round2(t5.tong);
    const taxRateUsed = round4(tygia);

    await this.prisma.transportFileItem.update({
      where: { id: declItemId },
      data: { taxBase, dutyNkAmt, dutyTtdbAmt, dutyCbpgAmt, envtaxVnd, dutyVatAmt, totalTax, taxRateUsed },
    });

    return { ok: true, msg: 'OK', taxBase, dutyNkAmt, dutyTtdbAmt, dutyCbpgAmt, envtaxVnd, dutyVatAmt, totalTax, taxRateUsed };
  }
}
