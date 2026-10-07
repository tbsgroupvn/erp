import { Prisma } from '@prisma/client';
import { prisma } from './db';

export async function resetTreasury() {
  // 09b đợt 1 — model-only. Không FK giữa 2 bảng ở v2 (giống prod, §2.2/§9 đặc tả:
  // `tk_code` KHÔNG FK tới `tbl_accounts.code` — 39 dòng `CHI-TBS` không phải ví
  // hợp lệ) — TRUNCATE cả hai độc lập, RESTART IDENTITY để mỗi test có id sạch.
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_accounts, tbl_account_histories RESTART IDENTITY CASCADE`,
  );
}

/** Ví quỹ (`tbl_accounts`) với cột bắt buộc điền sẵn giá trị hợp lệ — override khi cần. */
export async function seedFundAccount(
  code: string,
  overrides: Partial<Prisma.FundAccountUncheckedCreateInput> = {},
) {
  return prisma.fundAccount.create({
    data: {
      code,
      name: code,
      ...overrides,
    },
  });
}

/** Dòng sổ quỹ (`tbl_account_histories`) — override khi cần. */
export async function seedTreasuryEntry(
  overrides: Partial<Prisma.TreasuryEntryUncheckedCreateInput> = {},
) {
  return prisma.treasuryEntry.create({
    data: {
      ...overrides,
    },
  });
}
