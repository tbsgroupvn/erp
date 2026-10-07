import { Prisma } from '@prisma/client';
import { prisma } from './db';

/**
 * ⚠⚠ CASCADE KÉO THEO `tbl_transport_file_items`.
 * Từ #08 (cột `declaration_id` nối dòng khai về tờ khai), `CASCADE` ở đây
 * KHÔNG chỉ dọn 5 bảng liệt kê bên dưới — nó xoá luôn MỌI dòng khai đang
 * nối tới tờ khai. Hôm nay vô hại vì mọi spec đều gọi `resetWarehouse()`
 * trước, nhưng spec mới nào seed dòng khai RỒI mới gọi hàm này sẽ mất
 * sạch dữ liệu vừa seed mà KHÔNG có lỗi nào nổ — test sẽ đỏ ở một chỗ
 * chẳng liên quan gì. Seed xong mới reset là ngược thứ tự.
 * ⇒ Luôn `resetCustoms()` TRƯỚC khi seed, đừng gọi xen giữa.
 */
export async function resetCustoms() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_customs_declarations, tbl_import_goods, tbl_hs_tariff,
     tbl_customs_unit_rules, tbl_exchange_rates RESTART IDENTITY CASCADE`,
  );
}

/** Tờ khai hải quan — override khi cần. */
export async function seedCustomsDeclaration(
  overrides: Partial<Prisma.CustomsDeclarationUncheckedCreateInput> = {},
) {
  return prisma.customsDeclaration.create({
    data: {
      status: 0,
      ...overrides,
    },
  });
}

// fix-round-1 (Task 4, 23/09/2026): goods_key trên prod là NOT NULL +
// UNIQUE (uq_goods_key) — schema đã khôi phục đúng ràng buộc này. Test seed
// không truyền goodsKey không còn compile được nếu không có default ở đây;
// đếm tăng dần cho ra khoá DUY NHẤT mỗi lần gọi trong cùng 1 lượt chạy test
// (mỗi file test TRUNCATE...RESTART IDENTITY ở beforeEach nên không cần bền
// giữa các lượt chạy, chỉ cần không trùng TRONG một lượt).
let seedImportGoodsSeq = 0;

/** Hàng nhập (master HS/hàng) — override khi cần. */
export async function seedImportGoods(
  overrides: Partial<Prisma.ImportGoodsUncheckedCreateInput> = {},
) {
  seedImportGoodsSeq += 1;
  return prisma.importGoods.create({
    data: {
      hsStatus: 0,
      goodsKey: `zz-seed-import-goods-${seedImportGoodsSeq}`,
      ...overrides,
    },
  });
}

/** Dòng biểu thuế HS — override khi cần. */
export async function seedHsTariff(
  overrides: Partial<Prisma.HsTariffUncheckedCreateInput> = {},
) {
  return prisma.hsTariff.create({
    data: {
      ...overrides,
    },
  });
}

/** Quy tắc quy đổi đơn vị hải quan — override khi cần. */
export async function seedCustomsUnitRule(
  overrides: Partial<Prisma.CustomsUnitRuleUncheckedCreateInput> = {},
) {
  return prisma.customsUnitRule.create({
    data: {
      ...overrides,
    },
  });
}

/**
 * Dòng tỷ giá treasury (#08 fix-round-1, `tbl_exchange_rates`, nguồn cho
 * `tbs_decl_usd_rate`'s `getRate`) — KHÁC `MhRate`/`tbl_mh_tygia` (đó là tỷ
 * giá mua-hộ/ví). Đo prod 23/09/2026: bảng này 0 dòng — override khi cần.
 */
export async function seedExchangeRate(
  overrides: Partial<Prisma.ExchangeRateUncheckedCreateInput> = {},
) {
  return prisma.exchangeRate.create({
    data: {
      currency: 'USD',
      rateVnd: 25_000,
      rateDate: new Date('2026-01-01'),
      ...overrides,
    },
  });
}
