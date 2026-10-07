import { ImportTaxService } from '../../src/quote/import-tax.service';

describe('ImportTaxService.calc5 (#05 báo giá — 5 sắc thuế, nguồn duy nhất dùng chung #08)', () => {
  const tax = new ImportTaxService();

  it('TTĐB cộng dồn SAU thuế NK', () => {
    const r = tax.calc5(1_000_000, 0, 1, 10, 10, 0, 0, 0);
    expect(r.nk).toBe(100_000);
    expect(r.ttdb).toBeCloseTo(110_000, 6); // (1.000.000+100.000)×10%, KHÔNG phải 100.000
  });

  it('CBPG song song, KHÔNG lồng TTĐB', () => {
    const r = tax.calc5(1_000_000, 0, 1, 10, 10, 5, 0, 0);
    expect(r.cbpg).toBe(50_000); // trên nền hàng, không trên (nền+NK)
  });

  it('BVMT tuyệt đối theo lượng', () => {
    expect(tax.calc5(1_000_000, 0, 7, 0, 0, 0, 1000, 0).bvmt).toBe(7000);
  });

  // ⚠⚠ CỔNG GÁC — quyết định nghiệp vụ CỐ Ý, KHÔNG phải bug.
  // Cước (cuoc) được cộng vào nền tính VAT nhưng KHÔNG được cộng vào nền
  // tính thuế NK/TTĐB/CBPG. Điều này trái Luật Hải quan 54/2014 Đ.86 và
  // TT 39/2015 Đ.13 (cả hai đều đưa cước vào trị giá tính thuế) — nhưng
  // project owner (huytq8995) đã chốt giữ nguyên hành vi này BA lần
  // (03/09, 08/09, 23/09/2026) để khớp dữ liệu prod đang chạy. Nếu ai đó
  // "sửa cho đúng luật hải quan" bằng cách cộng `cuoc` vào nền `nk`, ca
  // test này phải ĐỎ — đó chính là mục đích của nó. ĐỪNG "sửa" formula
  // trong import-tax.service.ts để làm ca này xanh trở lại.
  it('⚠ CƯỚC vào nền VAT nhưng KHÔNG vào nền NK/TTĐB/CBPG (chủ ý, chốt 3 lần)', () => {
    const a = tax.calc5(1_000_000, 500_000, 1, 10, 0, 0, 0, 8);
    expect(a.nk).toBe(100_000); // cước KHÔNG làm tăng NK
    expect(a.nenVat).toBe(1_600_000); // 1tr + 500k cước + 100k NK
    expect(a.vat).toBeCloseTo(128_000, 6);
  });

  it('không làm tròn bên trong — trả nguyên số thập phân', () => {
    const r = tax.calc5(1_000_000, 0, 3, 7.5, 0, 0, 0, 0);
    expect(r.nk).toBeCloseTo(75_000, 6);
  });

  it('tong = nk+ttdb+cbpg+bvmt+vat (không gồm nenHang/cuoc)', () => {
    const r = tax.calc5(1_000_000, 500_000, 1, 10, 10, 5, 1000, 8);
    const expectedTong = r.nk + r.ttdb + r.cbpg + r.bvmt + r.vat;
    expect(r.tong).toBeCloseTo(expectedTong, 6);
  });
});
