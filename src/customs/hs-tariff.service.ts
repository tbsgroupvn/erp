// src/customs/hs-tariff.service.ts — #08 Task 4
//
// Tra biểu thuế nội bộ (tbl_hs_tariff, 15.119 dòng đo 23/09/2026). Nguyên
// văn cách tra của prod (cls.container.php:1864, ajaxs/goods/hs_info.php,
// process_hs_crosscheck.php — CẢ BA nơi cùng một mẫu):
//   1. Chuẩn hoá mã HS về CHỮ SỐ THUẦN (tbs_decl_hs_norm — decl_enrich.php:14)
//      vì tbl_transport_file_items/tbl_import_goods lưu "85158090" còn form
//      nhập tay có thể gõ "8515.80.90".
//   2. Tra WHERE hs_norm=norm AND hs_level=8 LIMIT 1 (dòng thuế THẬT).
//   3. Không có -> lùi về WHERE hs_norm=norm LIMIT 1 (bất kỳ cấp nào).
//
// ⚠⚠ Biểu thuế lưu thuế suất dạng VARCHAR, KHÔNG phải số — đo thật 23/09:
// đa số là số thuần ('0','20','5'...) nhưng RỖNG rất phổ biến (vd. bvmt:
// 14.985/15.119 dòng rỗng), và có giá trị "nhiều mức gộp trong 1 ô"
// ('8/10','*/5/8/10'), "miễn trừ theo nước" ('0 (-KH)'), "đặc biệt/dẫn
// chiếu văn bản" ('ĐB','Theo hướng dẫn tại khoản 1.1 Chương 98'), số thập
// phân dùng PHẨY kiểu VN ('12,5'), và cả '%' dính vào một cụm chữ khác
// ('150% thuế MFN' — có '%' nhưng KHÔNG PHẢI số thuần). parseRateString()
// CHỈ chuẩn hoá được số thuần (có thể kèm '%' hoặc phẩy thập phân) — mọi
// trường hợp còn lại trả null và callers PHẢI tự đọc "raw" nếu cần hiển
// thị/audit, KHÔNG được đoán lấy 1 số trong biểu thức nhiều-giá-trị vì sẽ
// sai đối tượng (đúng tinh thần cảnh báo trong plan: "chuẩn hoá ở BIÊN,
// KHÔNG đổi kiểu ở schema").
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HsRateField {
  /** Chuỗi gốc lưu trên tbl_hs_tariff — giữ nguyên để hiển thị/audit dù value=null. */
  raw: string | null;
  /** Số thuần đã chuẩn hoá (phần trăm), null nếu không parse an toàn được. */
  value: number | null;
}

export interface HsTariffLookup {
  hsNorm: string;
  hsLevel: number | null;
  descVi: string | null;
  descEn: string | null;
  unit: string | null;
  nkTt: HsRateField;
  nkUuDai: HsRateField;
  vat: HsRateField;
  acfta: HsRateField;
  rcep: HsRateField;
  ttdb: HsRateField;
  bvmt: HsRateField;
}

@Injectable()
export class HsTariffService {
  constructor(private prisma: PrismaService) {}

  // tbs_decl_hs_norm($hs) = preg_replace('/\D/', '', (string)$hs) — bỏ mọi
  // ký tự không phải chữ số (dấu chấm, khoảng trắng...).
  static normalizeHsCode(hs: string | null | undefined): string {
    return String(hs ?? '').replace(/\D/g, '');
  }

  // Chuẩn hoá 1 ô thuế suất dạng chuỗi sang số. Phía AN TOÀN: bất cứ điều
  // gì không phải "số thuần, có thể kèm % hoặc phẩy thập phân" đều trả về
  // null thay vì đoán — xem bộ ca đo thật trong test.
  static parseRateString(raw: string | null | undefined): number | null {
    if (raw == null) return null;
    let s = raw.trim();
    if (s === '') return null;
    if (s.endsWith('%')) s = s.slice(0, -1).trim();
    s = s.replace(',', '.'); // phẩy thập phân kiểu VN, vd '12,5' -> '12.5'
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }

  async tra(hsCode: string): Promise<HsTariffLookup | null> {
    const norm = HsTariffService.normalizeHsCode(hsCode);
    if (norm === '') return null; // phía AN TOÀN — không đụng DB với mã rỗng

    let row = await this.prisma.hsTariff.findFirst({
      where: { hsNorm: norm, hsLevel: 8 },
      orderBy: { id: 'asc' }, // đo thật: 78 mã hs_norm cấp 8 có >1 dòng (chương 98) —
      // prod LIMIT 1 không ORDER BY (không đảm bảo dòng nào); ở đây chọn id nhỏ nhất
      // để KẾT QUẢ ỔN ĐỊNH giữa các lần gọi, không phải hành vi prod đã "chốt".
    });
    if (!row) {
      row = await this.prisma.hsTariff.findFirst({
        where: { hsNorm: norm },
        orderBy: { id: 'asc' },
      });
    }
    if (!row) return null;

    const field = (r: string | null): HsRateField => ({ raw: r, value: HsTariffService.parseRateString(r) });

    return {
      hsNorm: row.hsNorm ?? norm,
      hsLevel: row.hsLevel,
      descVi: row.descVi,
      descEn: row.descEn,
      unit: row.unit,
      nkTt: field(row.nkTt),
      nkUuDai: field(row.nkUuDai),
      vat: field(row.vat),
      acfta: field(row.acfta),
      rcep: field(row.rcep),
      ttdb: field(row.ttdb),
      bvmt: field(row.bvmt),
    };
  }
}
