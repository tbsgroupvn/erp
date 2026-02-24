import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Demo seed data — Creates sample accounts and data for demo/trial deployments.
 * Only runs when DEMO_MODE=true.
 */
export async function seedDemoData(prisma: PrismaClient) {
  if (process.env.DEMO_MODE !== 'true') {
    console.log('  → Skipping demo seed (DEMO_MODE is not true)');
    return;
  }

  console.log('  → Seeding demo data...');

  const emailDomain = process.env.SEED_EMAIL_DOMAIN || 'demo.example.com';
  const codePrefix = process.env.CUSTOMER_CODE_PREFIX || 'ERP-KH-';
  const companyName = process.env.COMPANY_NAME || 'Demo ERP';
  const passwordHash = await bcrypt.hash('demo123', 10);

  // ── Demo Users ──────────────────────────────────────────────
  const demoUsers = [
    {
      email: `admin@${emailDomain}`,
      fullName: `Admin ${companyName}`,
      role: 'COO' as const,
      branch: 'HN' as const,
    },
    {
      email: `giamdoc@${emailDomain}`,
      fullName: 'Giám đốc',
      role: 'SALES_DIRECTOR' as const,
      branch: 'HN' as const,
    },
    {
      email: `ketoan@${emailDomain}`,
      fullName: 'Kế toán Tổng hợp',
      role: 'CHIEF_ACCOUNTANT' as const,
      branch: 'HN' as const,
    },
    {
      email: `kho@${emailDomain}`,
      fullName: 'Quản lý Kho',
      role: 'WAREHOUSE_MANAGER' as const,
      branch: 'HN' as const,
    },
    {
      email: `kinhdoanh@${emailDomain}`,
      fullName: 'Nhân viên Kinh doanh',
      role: 'SALE' as const,
      branch: 'HN' as const,
    },
    {
      email: `viewer@${emailDomain}`,
      fullName: 'Viewer (Chỉ xem)',
      role: 'CSKH' as const,
      branch: 'HN' as const,
    },
  ];

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        fullName: user.fullName,
        passwordHash,
        role: user.role,
        branch: user.branch,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ ${demoUsers.length} demo users created (password: demo123)`);

  // ── Demo Customers ──────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({
    where: { email: `kinhdoanh@${emailDomain}` },
  });

  const demoCustomers = [
    {
      code: `${codePrefix}000001`,
      fullName: 'Nguyễn Văn An',
      companyName: 'Công ty TNHH Thương mại An Phát',
      phone: '0912345001',
      email: 'an.nguyen@demo.vn',
      tier: 'NEW' as const,
      branch: 'HN' as const,
      depositRate: 100,
      creditLimit: 0,
    },
    {
      code: `${codePrefix}000002`,
      fullName: 'Trần Thị Bình',
      companyName: 'Công ty CP XNK Bình Minh',
      phone: '0912345002',
      email: 'binh.tran@demo.vn',
      tier: 'REGULAR' as const,
      branch: 'HN' as const,
      depositRate: 70,
      creditLimit: 50_000_000,
    },
    {
      code: `${codePrefix}000003`,
      fullName: 'Lê Hoàng Cường',
      companyName: 'Công ty TNHH Logistics Cường Thịnh',
      phone: '0912345003',
      email: 'cuong.le@demo.vn',
      tier: 'VIP' as const,
      branch: 'HCM' as const,
      depositRate: 50,
      creditLimit: 200_000_000,
    },
    {
      code: `${codePrefix}000004`,
      fullName: 'Phạm Đức Dũng',
      companyName: 'Cửa hàng Dũng Phát',
      phone: '0912345004',
      email: 'dung.pham@demo.vn',
      tier: 'NEW' as const,
      branch: 'HCM' as const,
      depositRate: 100,
      creditLimit: 0,
    },
    {
      code: `${codePrefix}000005`,
      fullName: 'Hoàng Minh Tú',
      companyName: 'Công ty TNHH Minh Tú Trading',
      phone: '0912345005',
      email: 'tu.hoang@demo.vn',
      tier: 'STRATEGIC' as const,
      branch: 'HN' as const,
      depositRate: 30,
      creditLimit: 500_000_000,
    },
  ];

  for (const data of demoCustomers) {
    const customer = await prisma.customer.upsert({
      where: { code: data.code },
      update: {},
      create: {
        ...data,
        isActive: true,
        saleId: adminUser?.id ?? null,
      },
    });

    await prisma.wallet.upsert({
      where: { customerId: customer.id },
      update: {},
      create: {
        customerId: customer.id,
        balance: 0,
        currency: 'VND',
      },
    });
  }
  console.log(`  ✅ ${demoCustomers.length} demo customers created`);

  // ── Demo Exchange Rates ──────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.exchangeRate.upsert({
    where: { from_to_date: { from: 'CNY', to: 'VND', date: today } },
    update: { rate: 3500 },
    create: { from: 'CNY', to: 'VND', rate: 3500, date: today },
  });

  await prisma.exchangeRate.upsert({
    where: { from_to_date: { from: 'USD', to: 'VND', date: today } },
    update: { rate: 25400 },
    create: { from: 'USD', to: 'VND', rate: 25400, date: today },
  });

  console.log('  ✅ Demo exchange rates created');
  console.log('  ✅ Demo seed complete!');
}
