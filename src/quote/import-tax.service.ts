// src/quote/import-tax.service.ts
//
// ⚠⚠ NGUỒN DUY NHẤT cho 5 sắc thuế nhập khẩu. Module #08 (tờ khai hải
// quan) sẽ gọi CHÍNH service này — TUYỆT ĐỐI không copy công thức sang
// nơi khác. Một bản triển khai trước đây tồn tại ở HAI nơi và bị lệch,
// gây chênh lệch 4.674.583 VND trên một dòng hàng ở container 17858.
//
// ⚠ NGOẠI LỆ CHỦ Ý với luật "tiền không dùng float" của dự án (xem
// CLAUDE.md mục Tiền nong): hàm này dùng `number` (float64) cho toàn bộ
// phép tính trung gian, KHÔNG dùng Decimal — giống hệt PHP legacy
// (CLS_QUOTE::calcItem). PHP float và JS number đều là IEEE-754 double,
// nên cùng dãy phép tính cho cùng kết quả bit-để-bit. Quyết định này do
// huytq8995 chốt 23/09/2026: Decimal "đúng toán học hơn" nhưng làm lệch
// vài đồng so với 411 báo giá + 55 PO đã duyệt trên prod. KHÔNG "sửa
// cho chuẩn hơn" bằng Decimal. Hàm này KHÔNG làm tròn — bên gọi tự
// round() tại đúng mốc PHP làm tròn.
//
// ⚠⚠ CƯỚC (cuoc) được cộng vào nền tính VAT nhưng KHÔNG được cộng vào
// nền tính thuế NK/TTĐB/CBPG. Điều này trái Luật Hải quan 54/2014 Đ.86
// và TT 39/2015 Đ.13 — nhưng là quyết định nghiệp vụ CỐ Ý, đã được
// project owner chốt giữ nguyên BA lần (03/09, 08/09, 23/09/2026) để
// khớp dữ liệu prod đang chạy. Xem test/quote/import-tax.spec.ts —
// ca "⚠ CƯỚC vào nền VAT nhưng KHÔNG vào nền NK/TTĐB/CBPG" là cổng gác
// cho hành vi này. ĐỪNG cộng `cuoc` vào nền `nk`.
//
// Xem: F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-05-bao-gia-plan.md
// mục "⚠ SỐ HỌC — đọc kỹ, đây là chỗ dễ sai nhất".
import { Injectable } from '@nestjs/common';

export interface ImportTax5 {
  nk: number;
  ttdb: number;
  cbpg: number;
  bvmt: number;
  vat: number;
  nenVat: number;
  tong: number;
}

@Injectable()
export class ImportTaxService {
  /**
   * Tính 5 sắc thuế nhập khẩu. `pctNk`, `pctTtdb`, `pctCbpg`, `pctVat`
   * nhận PHẦN TRĂM (8.0 nghĩa là 8%), không phải phân số. `mucBvmt` là
   * số tiền tuyệt đối trên mỗi đơn vị số lượng. Không làm tròn — bên
   * gọi tự round() ở đúng mốc PHP làm tròn.
   */
  calc5(
    nenHang: number,
    cuoc: number,
    sl: number,
    pctNk: number,
    pctTtdb: number,
    pctCbpg: number,
    mucBvmt: number,
    pctVat: number,
  ): ImportTax5 {
    const nk = (nenHang * pctNk) / 100;
    const ttdb = ((nenHang + nk) * pctTtdb) / 100; // CỘNG DỒN sau thuế NK
    const cbpg = (nenHang * pctCbpg) / 100; // SONG SONG — không lồng vào ttdb
    const bvmt = sl * mucBvmt; // tuyệt đối theo lượng, không phải %
    const nenVat = nenHang + cuoc + nk + ttdb + cbpg + bvmt;
    const vat = (nenVat * pctVat) / 100;
    const tong = nk + ttdb + cbpg + bvmt + vat;
    return { nk, ttdb, cbpg, bvmt, vat, nenVat, tong };
  }
}
