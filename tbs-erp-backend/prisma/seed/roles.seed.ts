import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export async function seedRoles(prisma: PrismaClient) {
  console.log('  → Seeding users (30 across all roles)...');

  const emailDomain = process.env.SEED_EMAIL_DOMAIN || 'example.com';
  const seedPassword = process.env.SEED_PASSWORD || crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  if (!process.env.SEED_PASSWORD) {
    console.log(`  [SEED] Generated password: ${seedPassword} - CHANGE IMMEDIATELY after first login`);
  }

  const users = [
    // BGD
    { email: `ceo@${emailDomain}`, fullName: 'Tổng Giám đốc', role: 'CEO' as const, branch: 'HN' as const },
    { email: `admin@${emailDomain}`, fullName: 'Giám đốc Điều hành', role: 'COO' as const, branch: 'HN' as const },
    { email: `cfo@${emailDomain}`, fullName: 'Giám đốc Tài chính', role: 'CFO' as const, branch: 'HN' as const },
    { email: `dops@${emailDomain}`, fullName: 'GĐ Vận hành', role: 'DIRECTOR_OPERATIONS' as const, branch: 'HN' as const },

    // Kinh doanh
    { email: `gdkd@${emailDomain}`, fullName: 'GĐ Kinh doanh', role: 'SALES_DIRECTOR' as const, branch: 'HN' as const },
    { email: `leader.hn@${emailDomain}`, fullName: 'Leader KD Hà Nội', role: 'SALES_LEADER' as const, branch: 'HN' as const },
    { email: `leader.hcm@${emailDomain}`, fullName: 'Leader KD HCM', role: 'SALES_LEADER' as const, branch: 'HCM' as const },
    { email: `sale01@${emailDomain}`, fullName: 'Nhân viên KD 01', role: 'SALE' as const, branch: 'HN' as const, saleCode: 'NV001' },
    { email: `sale02@${emailDomain}`, fullName: 'Nhân viên KD 02', role: 'SALE' as const, branch: 'HN' as const, saleCode: 'NV002' },
    { email: `sale03@${emailDomain}`, fullName: 'Nhân viên KD 03', role: 'SALE' as const, branch: 'HCM' as const, saleCode: 'NV003' },
    { email: `sale04@${emailDomain}`, fullName: 'Nhân viên KD 04', role: 'SALE' as const, branch: 'HCM' as const, saleCode: 'NV004' },

    // Marketing & CSKH
    { email: `marketing@${emailDomain}`, fullName: 'NV Marketing', role: 'MARKETING_STAFF' as const, branch: 'HN' as const },
    { email: `cskh@${emailDomain}`, fullName: 'NV CSKH', role: 'CSKH' as const, branch: 'HN' as const },

    // Kế toán
    { email: `ketoan@${emailDomain}`, fullName: 'Kế toán Tổng hợp', role: 'CHIEF_ACCOUNTANT' as const, branch: 'HN' as const },
    { email: `ketoantt@${emailDomain}`, fullName: 'Kế toán Thanh toán', role: 'ACCOUNTANT_AR' as const, branch: 'HN' as const },
    { email: `ketoancp@${emailDomain}`, fullName: 'Kế toán Chi phí', role: 'ACCOUNTANT_COST' as const, branch: 'HN' as const },
    { email: `ketoan.hcm@${emailDomain}`, fullName: 'Kế toán HCM', role: 'ACCOUNTANT' as const, branch: 'HCM' as const },

    // HR
    { email: `hr@${emailDomain}`, fullName: 'Trưởng phòng Nhân sự', role: 'HR_MANAGER' as const, branch: 'HN' as const },

    // Logistics
    { email: `logistics@${emailDomain}`, fullName: 'Trưởng phòng Logistics', role: 'LOGISTICS_MANAGER' as const, branch: 'HN' as const },

    // XNK
    { email: `xnk@${emailDomain}`, fullName: 'Trưởng phòng XNK', role: 'XNK_MANAGER' as const, branch: 'HN' as const },
    { email: `xnk01@${emailDomain}`, fullName: 'NV XNK 01', role: 'XNK_STAFF' as const, branch: 'HN' as const },
    { email: `xnk02@${emailDomain}`, fullName: 'NV XNK 02', role: 'XNK_STAFF' as const, branch: 'HN' as const },

    // Kho TQ
    { email: `khotq01@${emailDomain}`, fullName: 'Agent Kho TQ 01', role: 'WAREHOUSE_CN_AGENT' as const, branch: 'HN' as const },
    { email: `khotq02@${emailDomain}`, fullName: 'Agent Kho TQ 02', role: 'WAREHOUSE_CN_AGENT' as const, branch: 'HCM' as const },

    // Kho VN
    { email: `khovn@${emailDomain}`, fullName: 'Trưởng kho VN', role: 'WAREHOUSE_VN_MANAGER' as const, branch: 'HN' as const },
    { email: `kho.hcm@${emailDomain}`, fullName: 'Trưởng kho HCM', role: 'WAREHOUSE_MANAGER' as const, branch: 'HCM' as const },
    { email: `khovn01@${emailDomain}`, fullName: 'NV Kho VN 01', role: 'WAREHOUSE_VN_STAFF' as const, branch: 'HN' as const },
    { email: `khovn02@${emailDomain}`, fullName: 'NV Kho VN 02', role: 'WAREHOUSE_VN_STAFF' as const, branch: 'HCM' as const },

    // Tài xế
    { email: `taixe01@${emailDomain}`, fullName: 'Tài xế 01', role: 'DRIVER' as const, branch: 'HN' as const },
    { email: `taixe02@${emailDomain}`, fullName: 'Tài xế 02', role: 'DRIVER' as const, branch: 'HCM' as const },
  ];

  // Pass 1: Upsert all users
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        branch: u.branch,
        saleCode: u.saleCode ?? null,
        isActive: true,
      },
    });
  }

  // Pass 2: Set leaderId for sales hierarchy
  const hierarchy: { child: string; parent: string }[] = [
    { child: `leader.hn@${emailDomain}`, parent: `gdkd@${emailDomain}` },
    { child: `leader.hcm@${emailDomain}`, parent: `gdkd@${emailDomain}` },
    { child: `sale01@${emailDomain}`, parent: `leader.hn@${emailDomain}` },
    { child: `sale02@${emailDomain}`, parent: `leader.hn@${emailDomain}` },
    { child: `sale03@${emailDomain}`, parent: `leader.hcm@${emailDomain}` },
    { child: `sale04@${emailDomain}`, parent: `leader.hcm@${emailDomain}` },
  ];

  for (const h of hierarchy) {
    const parent = await prisma.user.findUnique({ where: { email: h.parent } });
    if (parent) {
      await prisma.user.update({
        where: { email: h.child },
        data: { leaderId: parent.id },
      });
    }
  }

  console.log(`  ✅ ${users.length} users seeded with sales hierarchy`);
}
