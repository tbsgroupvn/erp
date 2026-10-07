// test/customs/tach-nen-thue.spec.ts — #08 Task 2: DeclSourceService.tachNenThue()
//
// Tái hiện NGUYÊN VĂN `tbs_decl_tach_nen_thue(declItemId, triGiaKhaiVnd)`
// (libs/decl_source.php:203) — xem plan mục "⚠⚠⚠ CÔNG THỨC — chép từ mã
// prod, KHÔNG suy từ spec":
//
//   tong = triGiaKhaiVnd
//   mặc định: {hang: tong, cuoc: 0, cpk: 0, tong}          ← phía AN TOÀN
//   declItemId<=0 hoặc tong<=0 -> mặc định
//   tra dòng báo giá gốc qua transport_file_items.quote_item_id -> quote_items
//   không có dòng -> mặc định
//   a=amount_vnd · s=ship_to_vn_vnd · c=other_cost · tt=a+s+c
//   tt<=0 -> mặc định
//   hang = tong*(a/tt) · cuoc = tong*(s/tt) · cpk = tong - hang - cuoc (PHẦN DƯ)
import { PrismaService } from '../../src/prisma/prisma.service';
import { DeclSourceService } from '../../src/customs/decl-source.service';
import { prisma } from '../helpers/db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';
import { resetWarehouse, seedTransportFile } from '../helpers/warehouse-db';

describe('DeclSourceService.tachNenThue — #08 Task 2, tách nền thuế từ trị giá khai', () => {
  const svc = new DeclSourceService(prisma as unknown as PrismaService);

  beforeEach(async () => {
    await resetWarehouse();
    await resetQuote();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('declItemId <= 0 -> mặc định (phía an toàn), không đụng DB', async () => {
    const r = await svc.tachNenThue(0, 1_000_000);
    expect(r).toEqual({ hang: 1_000_000, cuoc: 0, cpk: 0, tong: 1_000_000 });

    const rNeg = await svc.tachNenThue(-5, 1_000_000);
    expect(rNeg).toEqual({ hang: 1_000_000, cuoc: 0, cpk: 0, tong: 1_000_000 });
  });

  it('tong <= 0 -> mặc định, kể cả khi declItemId hợp lệ và có báo giá', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-TACHNEN-01');
    const item = await seedItem(quote.id, { amountVnd: 800_000, shipToVnVnd: 150_000, otherCost: 50_000 });
    const declItem = await prisma.transportFileItem.create({
      data: { fileId: file.id, quoteItemId: item.id },
    });

    const rZero = await svc.tachNenThue(declItem.id, 0);
    expect(rZero).toEqual({ hang: 0, cuoc: 0, cpk: 0, tong: 0 });

    const rNeg = await svc.tachNenThue(declItem.id, -100);
    expect(rNeg).toEqual({ hang: -100, cuoc: 0, cpk: 0, tong: -100 });
  });

  it('⚠ phía AN TOÀN: không tra được dòng báo giá gốc (quoteItemId rỗng) -> hang===tong, cuoc===0 — KHÔNG phải khai thiếu, là nền NK RỘNG HƠN', async () => {
    const file = await seedTransportFile();
    const declItem = await prisma.transportFileItem.create({
      data: { fileId: file.id }, // quoteItemId để trống
    });

    const r = await svc.tachNenThue(declItem.id, 1_000_000);
    expect(r.hang).toBe(1_000_000);
    expect(r.cuoc).toBe(0);
    expect(r.cpk).toBe(0);
    expect(r.tong).toBe(1_000_000);
  });

  it('phía AN TOÀN: quoteItemId trỏ tới một dòng báo giá KHÔNG tồn tại -> mặc định', async () => {
    const file = await seedTransportFile();
    const declItem = await prisma.transportFileItem.create({
      data: { fileId: file.id, quoteItemId: 999_999 }, // không có QuoteItem nào id này
    });

    const r = await svc.tachNenThue(declItem.id, 1_000_000);
    expect(r).toEqual({ hang: 1_000_000, cuoc: 0, cpk: 0, tong: 1_000_000 });
  });

  it('tt <= 0 (a+s+c của báo giá gốc đều 0) -> mặc định', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-TACHNEN-02');
    const item = await seedItem(quote.id, { amountVnd: 0, shipToVnVnd: 0, otherCost: 0 });
    const declItem = await prisma.transportFileItem.create({
      data: { fileId: file.id, quoteItemId: item.id },
    });

    const r = await svc.tachNenThue(declItem.id, 1_000_000);
    expect(r).toEqual({ hang: 1_000_000, cuoc: 0, cpk: 0, tong: 1_000_000 });
  });

  it('ca tỷ trọng thật: a=800.000, s=150.000, c=50.000, tong=1.000.000 -> hang=800.000, cuoc=150.000, cpk=50.000', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-TACHNEN-03');
    const item = await seedItem(quote.id, { amountVnd: 800_000, shipToVnVnd: 150_000, otherCost: 50_000 });
    const declItem = await prisma.transportFileItem.create({
      data: { fileId: file.id, quoteItemId: item.id },
    });

    const r = await svc.tachNenThue(declItem.id, 1_000_000);
    expect(r.hang).toBe(800_000);
    expect(r.cuoc).toBe(150_000);
    expect(r.cpk).toBe(50_000);
    expect(r.tong).toBe(1_000_000);
  });

  // ⚠⚠⚠ fix-round-2 (23/09/2026) — bản GỐC của ca này dùng tỷ trọng ĐỐI
  // XỨNG (a=s=c=1). Reviewer đã chạy mutant thực tế "cpk = tong*(c/tt)"
  // (tính ĐỘC LẬP thay vì lấy phần dư) và CẢ 7 CA VẪN XANH — với a=s=c, hai
  // công thức cho ra CÙNG MỘT SỐ (đo bằng Node: 1000/3 cho cả ba phần theo
  // cả hai cách), nên không có dung sai nào phân biệt được; `toBeLessThan
  // (1e-6)` càng làm nó lỏng hơn nữa. Ca dưới đây SỬA cả hai lỗi: đổi sang
  // tỷ trọng LỆCH bất đối xứng (1:1:16) — đã đo tay bằng Node TRƯỚC khi
  // viết assertion:
  //   hang=cuoc=1000×(1/18)=55.55555555555555555… (cùng giá trị vì a=s)
  //   cpk-PHẦN-DƯ = 1000-hang-cuoc = 888.8888888888889 -> tổng ĐÚNG 1000
  //     bit-để-bit (hang+cuoc+cpk===1000, xác nhận bằng Node console.log)
  //   cpk-ĐỘC-LẬP = 1000×(16/18) = 888.8888888888888 (khác cpk-PHẦN-DƯ ở
  //     chữ số cuối) -> tổng = 999.9999999999999 ≠ 1000
  // và dùng `toBe` (KHÔNG tolerance) — dung sai bất kỳ, kể cả rất chặt, có
  // thể che một lỗi làm tròn-mỗi-phần tương tự nhưng nhỏ hơn; bất biến toán
  // học "phần dư" phải đúng TUYỆT ĐỐI hoặc không đúng gì cả.
  it('⚠⚠ CA THEN CHỐT — tỷ trọng LỆCH bất đối xứng (a=1,s=1,c=16) trên tong=1000: hang+cuoc+cpk phải bằng ĐÚNG tong BIT-ĐỂ-BIT (cpk là PHẦN DƯ, không tính độc lập)', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-TACHNEN-04');
    const item = await seedItem(quote.id, { amountVnd: 1, shipToVnVnd: 1, otherCost: 16 });
    const declItem = await prisma.transportFileItem.create({
      data: { fileId: file.id, quoteItemId: item.id },
    });

    const r = await svc.tachNenThue(declItem.id, 1000);

    // Bất biến trung tâm — KHÔNG tolerance. Một cpk tính độc lập
    // (tong*(c/tt)) cho tổng 999.9999999999999 ≠ 1000, sẽ FAIL ngay đây.
    expect(r.hang + r.cuoc + r.cpk).toBe(1000);
    expect(r.tong).toBe(1000);

    // cpk đúng nghĩa PHẦN DƯ — không phải 1000×(16/18) tính riêng.
    expect(r.cpk).toBe(1000 - r.hang - r.cuoc);

    // hang/cuoc tự thân vẫn đúng tỷ trọng (kiểm bằng chính công thức tỷ lệ,
    // độc lập với cách tính cpk — không tautological với assertion trên).
    expect(r.hang).toBe(1000 * (1 / 18));
    expect(r.cuoc).toBe(1000 * (1 / 18));
  });
});
