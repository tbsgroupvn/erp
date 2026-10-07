import { PrismaModule } from '../../src/prisma/prisma.module';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MasterDataModule } from '../../src/masterdata/masterdata.module';
import { MoneyModule } from '../../src/money/money.module';
import { CustomerService } from '../../src/masterdata/customer.service';
import { WalletService } from '../../src/money/wallet.service';
import { PermService } from '../../src/iam/perm.service';
import { prisma, resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { resetDb } from '../helpers/db';

// Task 11 — e2e vòng đời khách hàng: chứng minh MasterDataModule (#02) nối
// đúng vào IamModule (#01, phạm vi xem) VÀ vào MoneyModule (#03, ví) qua
// khoá CHUỖI Customer.code == Wallet.cusId — không phải qua DI (xem ghi chú
// trong masterdata.module.ts). Vì vậy test này tự import CẢ HAI module.
async function grant(uid: number, code: string, sc: 'own' | 'team' | 'dept' | 'dept_tree' | 'warehouse' | 'all' = 'own') {
  const role = await prisma.role.create({
    data: { code: 'r' + uid + '_' + code + '_' + sc + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ten: 'r' + uid },
  });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

let app: INestApplication;
let cus: CustomerService;
let wallet: WalletService;
let perm: PermService;
let uidSale1: number;
let uidSale2: number;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, MasterDataModule, MoneyModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  cus = mod.get(CustomerService);
  wallet = mod.get(WalletService);
  perm = mod.get(PermService);
});

beforeEach(async () => {
  await resetIam();
  await resetMasterdata();
  await resetDb();
  perm.clearCache(); // uid bị RESTART IDENTITY tái dùng -> cache "uid@version" của lượt trước phải bỏ

  const u1 = await seedUser({ username: 'sale1' });
  const u2 = await seedUser({ username: 'sale2' });
  uidSale1 = u1.id;
  uidSale2 = u2.id;
  await grant(uidSale1, 'customer_view', 'own');
  await grant(uidSale2, 'customer_view', 'own');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('MasterDataModule e2e — vòng đời khách hàng', () => {
  it('vòng đời KH: tạo -> có ví -> nạp tiền -> đổi sale -> phạm vi xem đúng', async () => {
    const r = await cus.create({ name: 'Công ty Alpha', saler: 'sale1' }, 'sale1');
    expect(r.ok).toBe(true);

    // ví dùng được ngay với #03 (khoá nối là code)
    const ap = await wallet.applyEntry(r.code!, 1_000_000, 0, 'nạp đầu', 'kt1');
    expect(ap.ok).toBe(true);
    expect(await wallet.getBalanceTrue(r.code!)).toBe(1_000_000n);

    // sale1 thấy; sale2 chưa thấy
    expect((await cus.listForUser('customer_view', uidSale1)).map((c) => c.code)).toContain(r.code);
    expect((await cus.listForUser('customer_view', uidSale2)).map((c) => c.code)).not.toContain(r.code);

    // chuyển sang sale2 làm chính, sale1 thành phụ -> CẢ HAI cùng thấy
    await cus.setSalers(r.code!, 'sale2', ['sale1'], 'admin');
    expect((await cus.listForUser('customer_view', uidSale2)).map((c) => c.code)).toContain(r.code);
    expect((await cus.listForUser('customer_view', uidSale1)).map((c) => c.code)).toContain(r.code);
  });

  it('mã KH không tái dùng qua nhiều lần tạo', async () => {
    const a = await cus.create({ name: 'A' }, 'sale1');
    const b = await cus.create({ name: 'B' }, 'sale1');
    expect(a.code).not.toBe(b.code);
    expect(Number(b.code!.slice(3))).toBeGreaterThan(Number(a.code!.slice(3)));
  });
});
