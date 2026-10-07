import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_wallet, tbl_wallet_detail, tbl_gl_entry, tbl_gl_line,
     tbl_gl_account, tbl_gl_mapping, tbl_mh_tygia, tbl_po_receipts RESTART IDENTITY CASCADE`,
  );
}

export async function seedAccounts() {
  await prisma.glAccount.createMany({
    data: [
      { code: '111', name: 'Tiền mặt', nature: 'debit' },
      { code: '131', name: 'Phải thu KH', nature: 'debit' },
      { code: '511', name: 'Doanh thu', nature: 'credit' },
      { code: '515', name: 'DT tài chính', nature: 'credit' },
      { code: '635', name: 'CP tài chính', nature: 'debit' },
      { code: '3387', name: 'Nhận trước', nature: 'credit' },
    ],
  });
}

export async function seedMapping(
  bizType: string,
  dr: string,
  cr: string,
  approved = true,
) {
  await prisma.glMapping.create({
    data: {
      bizType,
      bizLabel: bizType,
      debitAccount: dr,
      creditAccount: cr,
      isApproved: approved,
      active: true,
    },
  });
}
