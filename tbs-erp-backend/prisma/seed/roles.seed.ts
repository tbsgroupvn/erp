import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedRoles(prisma: PrismaClient) {
  console.log('  → Seeding default admin user...');

  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@tbs.vn' },
    update: {},
    create: {
      email: 'admin@tbs.vn',
      fullName: 'Admin TBS',
      passwordHash,
      role: 'COO',
      branch: 'HN',
      isActive: true,
    },
  });

  // Seed KT Tổng hợp
  await prisma.user.upsert({
    where: { email: 'ketoan@tbs.vn' },
    update: {},
    create: {
      email: 'ketoan@tbs.vn',
      fullName: 'Kế toán Tổng hợp',
      passwordHash,
      role: 'CHIEF_ACCOUNTANT',
      branch: 'HN',
      isActive: true,
    },
  });

  // Seed GĐ Kinh doanh
  await prisma.user.upsert({
    where: { email: 'gdkd@tbs.vn' },
    update: {},
    create: {
      email: 'gdkd@tbs.vn',
      fullName: 'GĐ Kinh doanh',
      passwordHash,
      role: 'SALES_DIRECTOR',
      branch: 'HN',
      isActive: true,
    },
  });

  console.log('  ✅ Default users seeded');
}
