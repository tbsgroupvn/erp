import { PrismaClient } from '@prisma/client';

export async function seedSampleData(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') {
    console.log('  → Skipping sample data in production');
    return;
  }

  console.log('  → Seeding sample data (dev only)...');

  // Sample exchange rates
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

  // ── Sample customers ──────────────────────────────────────────────
  console.log('  → Seeding sample customers...');

  // Look up the admin user (seeded in roles.seed.ts) to assign as sale
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@tbs.vn' },
  });

  const sampleCustomers = [
    {
      code: 'TBS-KH-000001',
      fullName: 'Nguyễn Văn An',
      companyName: 'Công ty TNHH Thương mại An Phát',
      phone: '0912345001',
      email: 'an.nguyen@anphat.vn',
      tier: 'NEW' as const,
      branch: 'HN' as const,
      isActive: true,
      depositRate: 100,
      creditLimit: 0,
      saleId: adminUser?.id ?? null,
    },
    {
      code: 'TBS-KH-000002',
      fullName: 'Trần Thị Bình',
      companyName: 'Công ty CP Xuất nhập khẩu Bình Minh',
      phone: '0912345002',
      email: 'binh.tran@binhminh.vn',
      tier: 'REGULAR' as const,
      branch: 'HN' as const,
      isActive: true,
      depositRate: 70,
      creditLimit: 50_000_000,
      saleId: adminUser?.id ?? null,
    },
    {
      code: 'TBS-KH-000003',
      fullName: 'Lê Hoàng Cường',
      companyName: 'Công ty TNHH Logistics Cường Thịnh',
      phone: '0912345003',
      email: 'cuong.le@cuongthinh.vn',
      tier: 'VIP' as const,
      branch: 'HCM' as const,
      isActive: true,
      depositRate: 50,
      creditLimit: 200_000_000,
      saleId: null,
    },
    {
      code: 'TBS-KH-000004',
      fullName: 'Phạm Đức Dũng',
      companyName: 'Cửa hàng Dũng Phát',
      phone: '0912345004',
      email: 'dung.pham@dungphat.vn',
      tier: 'NEW' as const,
      branch: 'HCM' as const,
      isActive: true,
      depositRate: 100,
      creditLimit: 0,
      saleId: null,
    },
  ];

  for (const data of sampleCustomers) {
    const customer = await prisma.customer.upsert({
      where: { code: data.code },
      update: {
        fullName: data.fullName,
        companyName: data.companyName,
        phone: data.phone,
        email: data.email,
        tier: data.tier,
        branch: data.branch,
        isActive: data.isActive,
        depositRate: data.depositRate,
        creditLimit: data.creditLimit,
        saleId: data.saleId,
      },
      create: {
        code: data.code,
        fullName: data.fullName,
        companyName: data.companyName,
        phone: data.phone,
        email: data.email,
        tier: data.tier,
        branch: data.branch,
        isActive: data.isActive,
        depositRate: data.depositRate,
        creditLimit: data.creditLimit,
        saleId: data.saleId,
      },
    });

    // Upsert wallet for each customer (unique on customerId)
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

  console.log('  ✅ Sample data seeded');
}
