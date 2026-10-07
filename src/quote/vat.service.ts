// src/quote/vat.service.ts
//
// ⚠ NGOẠI LỆ CHỦ Ý với luật "tiền không dùng float" của dự án (xem
// CLAUDE.md mục Tiền nong): hàm này dùng `number` (float64) cho toàn bộ
// phép tính trung gian, KHÔNG dùng Decimal — giống hệt PHP legacy
// (CLS_QUOTE). PHP float và JS number đều là IEEE-754 double, nên cùng
// dãy phép tính cho cùng kết quả bit-để-bit. Quyết định này do
// huytq8995 chốt 23/09/2026: Decimal ở đây "đúng toán học hơn" nhưng
// làm lệch vài đồng so với 411 báo giá + 55 PO đã duyệt trên prod — mất
// khả năng đối chiếu 1:1 với dữ liệu cũ, là tiêu chí nghiệm thu thật.
// KHÔNG "sửa cho chuẩn hơn" bằng Decimal.
//
// Xem: F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-05-bao-gia-plan.md
// mục "⚠ SỐ HỌC — đọc kỹ, đây là chỗ dễ sai nhất".
import { Injectable } from '@nestjs/common';

export interface VatSplit {
  total: number;
  base: number;
  vat: number;
  rate: number;
}

@Injectable()
export class VatService {
  /**
   * Tách VAT ngược từ tổng đã bao gồm VAT.
   * `rate` nhận cả phần trăm (8) lẫn phân số (0.08) — > 1 thì tự chia 100.
   */
  split(totalIncl: number, rate: number): VatSplit {
    const total = Math.round(totalIncl); // làm tròn TRƯỚC khi tách
    let r = rate;
    if (r > 1) r = r / 100;
    if (r <= 0) return { total, base: total, vat: 0, rate: 0 };
    const base = Math.round(total / (1 + r));
    const vat = total - base; // KHÔNG tính độc lập — đảm bảo base+vat === total
    return { total, base, vat, rate: r };
  }

  /**
   * Gom danh sách dòng {totalIncl, rate} theo mức thuế (phân số, ví dụ
   * 0.08), bỏ qua dòng rate <= 0.
   */
  groupByRate(
    lines: { totalIncl: number; rate: number }[],
  ): { rate: number; base: number; vat: number; total: number }[] {
    const map = new Map<number, { base: number; vat: number; total: number }>();
    for (const line of lines) {
      const r = this.split(line.totalIncl, line.rate);
      if (r.rate <= 0) continue;
      const cur = map.get(r.rate) ?? { base: 0, vat: 0, total: 0 };
      cur.base += r.base;
      cur.vat += r.vat;
      cur.total += r.total;
      map.set(r.rate, cur);
    }
    return Array.from(map.entries()).map(([rate, v]) => ({ rate, ...v }));
  }
}
