import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedRoles(prisma: PrismaClient) {
  console.log('  → Seeding default admin user...');

  const emailDomain = process.env.SEED_EMAIL_DOMAIN || 'example.com';
  const companyName = process.env.COMPANY_NAME || 'ERP';
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { email: `admin@${emailDomain}` },
    update: {},
    create: {
      email: `admin@${emailDomain}`,
      fullName: `Admin ${companyName}`,
      passwordHash,
      role: 'COO',
      branch: 'HN',
      isActive: true,
    },
  });

  // Seed KT Tổng hợp
  await prisma.user.upsert({
    where: { email: `ketoan@${emailDomain}` },
    update: {},
    create: {
      email: `ketoan@${emailDomain}`,
      fullName: 'Kế toán Tổng hợp',
      passwordHash,
      role: 'CHIEF_ACCOUNTANT',
      branch: 'HN',
      isActive: true,
    },
  });

  // Seed GĐ Kinh doanh
  await prisma.user.upsert({
    where: { email: `gdkd@${emailDomain}` },
    update: {},
    create: {
      email: `gdkd@${emailDomain}`,
      fullName: 'GĐ Kinh doanh',
      passwordHash,
      role: 'SALES_DIRECTOR',
      branch: 'HN',
      isActive: true,
    },
  });

  console.log('  ✅ Default users seeded');
}
