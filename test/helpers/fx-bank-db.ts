import { Prisma } from '@prisma/client';
import { prisma } from './db';

/**
 * #09c L1 — model-only. Không FK giữa các bảng này ở v2 (chép prod, §9 đặc tả:
 * `bank_tran_id`/`tran_id`/`fx_id`/`account_code`… đều KHÔNG FK cứng) — TRUNCATE
 * độc lập, RESTART IDENTITY để mỗi test có id sạch.
 */
export async function resetFxBank() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_fx_transfers, tbl_fx_adjustments, tbl_fx_fee_rates, tbl_account_changelog,
     tbl_bank_transaction, tbl_bank_transaction_detail, tbl_bank_chi_match, tbl_bank_reconcile_link
     RESTART IDENTITY CASCADE`,
  );
}

/** Phiếu chuyển đổi tệ (`tbl_fx_transfers`) — override khi cần. */
export async function seedFxTransfer(
  overrides: Partial<Prisma.FxTransferUncheckedCreateInput> = {},
) {
  return prisma.fxTransfer.create({
    data: {
      code: 'FX-2609-999',
      fromTk: 'TK01',
      toTk: 'TK09',
      ...overrides,
    },
  });
}

/** Lịch sử điều chỉnh FX (`tbl_fx_adjustments`) — override khi cần. */
export async function seedFxAdjustment(
  overrides: Partial<Prisma.FxAdjustmentUncheckedCreateInput> = {},
) {
  return prisma.fxAdjustment.create({
    data: {
      fxId: 1,
      reason: 'test',
      cuser: 'zztest',
      cdate: 0,
      ...overrides,
    },
  });
}

/** Cấu hình phí mặc định theo cặp tiền (`tbl_fx_fee_rates`) — override khi cần. */
export async function seedFxFeeRate(
  overrides: Partial<Prisma.FxFeeRateUncheckedCreateInput> = {},
) {
  return prisma.fxFeeRate.create({
    data: {
      fromCur: 'VND',
      toCur: 'USD',
      ...overrides,
    },
  });
}

/** Nhật ký sửa ví quỹ (`tbl_account_changelog`) — override khi cần. */
export async function seedFundAccountChangelog(
  overrides: Partial<Prisma.FundAccountChangelogUncheckedCreateInput> = {},
) {
  return prisma.fundAccountChangelog.create({
    data: {
      ...overrides,
    },
  });
}

/** Giao dịch ngân hàng đầu vào (`tbl_bank_transaction`) — override khi cần. */
export async function seedBankTransaction(
  overrides: Partial<Prisma.BankTransactionUncheckedCreateInput> = {},
) {
  return prisma.bankTransaction.create({
    data: {
      bankid: '',
      ...overrides,
    },
  });
}

/** Chi tiết phân bổ giao dịch ngân hàng (`tbl_bank_transaction_detail`) — override khi cần. */
export async function seedBankTransactionDetail(
  overrides: Partial<Prisma.BankTransactionDetailUncheckedCreateInput> = {},
) {
  return prisma.bankTransactionDetail.create({
    data: {
      ...overrides,
    },
  });
}

/** Khớp chi ngân hàng ↔ phiếu duyệt (`tbl_bank_chi_match`) — override khi cần. */
export async function seedBankChiMatch(
  overrides: Partial<Prisma.BankChiMatchUncheckedCreateInput> = {},
) {
  return prisma.bankChiMatch.create({
    data: {
      bankTxId: BigInt(1),
      requestId: 1,
      matchedBy: 'zztest',
      matchedAt: 0,
      ...overrides,
    },
  });
}

/** Neo đối soát ngân hàng ↔ chứng từ (`tbl_bank_reconcile_link`) — override khi cần. */
export async function seedBankReconcileLink(
  overrides: Partial<Prisma.BankReconcileLinkUncheckedCreateInput> = {},
) {
  return prisma.bankReconcileLink.create({
    data: {
      bankTranId: BigInt(1),
      ...overrides,
    },
  });
}
