import { PrismaClient } from '@prisma/client';

/**
 * Seeds 30 Employee records linked 1:1 with Users.
 * Pass 1: Create all employees without managerId.
 * Pass 2: Set managerId for org hierarchy.
 */
export async function seedEmployees(prisma: PrismaClient) {
  console.log('  → Seeding employees (30)...');

  const emailDomain = process.env.SEED_EMAIL_DOMAIN || 'example.com';

  // Map email prefix → employee data
  const employees: {
    code: string;
    emailPrefix: string;
    fullName: string;
    phone: string;
    departmentCode: string;
    positionTitle: string;
    branch: 'HN' | 'HCM';
    salary: number;
  }[] = [
    // BGD
    { code: 'EMP-001', emailPrefix: 'ceo', fullName: 'Tổng Giám đốc', phone: '0900000001', departmentCode: 'BGD', positionTitle: 'Tổng Giám đốc', branch: 'HN', salary: 80_000_000 },
    { code: 'EMP-002', emailPrefix: 'admin', fullName: 'Giám đốc Điều hành', phone: '0900000002', departmentCode: 'BGD', positionTitle: 'Giám đốc Điều hành', branch: 'HN', salary: 70_000_000 },
    { code: 'EMP-003', emailPrefix: 'cfo', fullName: 'Giám đốc Tài chính', phone: '0900000003', departmentCode: 'BGD', positionTitle: 'Giám đốc Tài chính', branch: 'HN', salary: 65_000_000 },
    { code: 'EMP-004', emailPrefix: 'dops', fullName: 'GĐ Vận hành', phone: '0900000004', departmentCode: 'BGD', positionTitle: 'GĐ Vận hành', branch: 'HN', salary: 60_000_000 },

    // Kinh doanh
    { code: 'EMP-005', emailPrefix: 'gdkd', fullName: 'GĐ Kinh doanh', phone: '0900000005', departmentCode: 'KD', positionTitle: 'GĐ Kinh doanh', branch: 'HN', salary: 60_000_000 },
    { code: 'EMP-006', emailPrefix: 'leader.hn', fullName: 'Leader KD Hà Nội', phone: '0900000006', departmentCode: 'KD', positionTitle: 'Leader KD', branch: 'HN', salary: 25_000_000 },
    { code: 'EMP-007', emailPrefix: 'leader.hcm', fullName: 'Leader KD HCM', phone: '0900000007', departmentCode: 'KD', positionTitle: 'Leader KD', branch: 'HCM', salary: 25_000_000 },
    { code: 'EMP-008', emailPrefix: 'sale01', fullName: 'Nhân viên KD 01', phone: '0900000008', departmentCode: 'KD', positionTitle: 'Nhân viên KD', branch: 'HN', salary: 12_000_000 },
    { code: 'EMP-009', emailPrefix: 'sale02', fullName: 'Nhân viên KD 02', phone: '0900000009', departmentCode: 'KD', positionTitle: 'Nhân viên KD', branch: 'HN', salary: 12_000_000 },
    { code: 'EMP-010', emailPrefix: 'sale03', fullName: 'Nhân viên KD 03', phone: '0900000010', departmentCode: 'KD', positionTitle: 'Nhân viên KD', branch: 'HCM', salary: 12_000_000 },
    { code: 'EMP-011', emailPrefix: 'sale04', fullName: 'Nhân viên KD 04', phone: '0900000011', departmentCode: 'KD', positionTitle: 'Nhân viên KD', branch: 'HCM', salary: 12_000_000 },

    // Marketing & CSKH
    { code: 'EMP-012', emailPrefix: 'marketing', fullName: 'NV Marketing', phone: '0900000012', departmentCode: 'MKT', positionTitle: 'NV Marketing', branch: 'HN', salary: 15_000_000 },
    { code: 'EMP-013', emailPrefix: 'cskh', fullName: 'NV CSKH', phone: '0900000013', departmentCode: 'CSKH', positionTitle: 'NV CSKH', branch: 'HN', salary: 12_000_000 },

    // Kế toán
    { code: 'EMP-014', emailPrefix: 'ketoan', fullName: 'Kế toán Tổng hợp', phone: '0900000014', departmentCode: 'KT', positionTitle: 'TP Kế toán', branch: 'HN', salary: 30_000_000 },
    { code: 'EMP-015', emailPrefix: 'ketoantt', fullName: 'Kế toán Thanh toán', phone: '0900000015', departmentCode: 'KT', positionTitle: 'KT Thanh toán', branch: 'HN', salary: 15_000_000 },
    { code: 'EMP-016', emailPrefix: 'ketoancp', fullName: 'Kế toán Chi phí', phone: '0900000016', departmentCode: 'KT', positionTitle: 'KT Chi phí', branch: 'HN', salary: 15_000_000 },
    { code: 'EMP-017', emailPrefix: 'ketoan.hcm', fullName: 'Kế toán HCM', phone: '0900000017', departmentCode: 'KT', positionTitle: 'Kế toán', branch: 'HCM', salary: 14_000_000 },

    // HR
    { code: 'EMP-018', emailPrefix: 'hr', fullName: 'Trưởng phòng Nhân sự', phone: '0900000018', departmentCode: 'NS', positionTitle: 'TP Nhân sự', branch: 'HN', salary: 28_000_000 },

    // Logistics
    { code: 'EMP-019', emailPrefix: 'logistics', fullName: 'Trưởng phòng Logistics', phone: '0900000019', departmentCode: 'LOG', positionTitle: 'TP Logistics', branch: 'HN', salary: 28_000_000 },

    // XNK
    { code: 'EMP-020', emailPrefix: 'xnk', fullName: 'Trưởng phòng XNK', phone: '0900000020', departmentCode: 'XNK', positionTitle: 'TP XNK', branch: 'HN', salary: 28_000_000 },
    { code: 'EMP-021', emailPrefix: 'xnk01', fullName: 'NV XNK 01', phone: '0900000021', departmentCode: 'XNK', positionTitle: 'NV XNK', branch: 'HN', salary: 14_000_000 },
    { code: 'EMP-022', emailPrefix: 'xnk02', fullName: 'NV XNK 02', phone: '0900000022', departmentCode: 'XNK', positionTitle: 'NV XNK', branch: 'HN', salary: 14_000_000 },

    // Kho TQ
    { code: 'EMP-023', emailPrefix: 'khotq01', fullName: 'Agent Kho TQ 01', phone: '0900000023', departmentCode: 'KHO-TQ', positionTitle: 'Agent Kho TQ', branch: 'HN', salary: 12_000_000 },
    { code: 'EMP-024', emailPrefix: 'khotq02', fullName: 'Agent Kho TQ 02', phone: '0900000024', departmentCode: 'KHO-TQ', positionTitle: 'Agent Kho TQ', branch: 'HCM', salary: 12_000_000 },

    // Kho VN
    { code: 'EMP-025', emailPrefix: 'khovn', fullName: 'Trưởng kho VN', phone: '0900000025', departmentCode: 'KHO-VN', positionTitle: 'Trưởng kho VN', branch: 'HN', salary: 22_000_000 },
    { code: 'EMP-026', emailPrefix: 'kho.hcm', fullName: 'Trưởng kho HCM', phone: '0900000026', departmentCode: 'KHO-VN', positionTitle: 'Trưởng kho', branch: 'HCM', salary: 20_000_000 },
    { code: 'EMP-027', emailPrefix: 'khovn01', fullName: 'NV Kho VN 01', phone: '0900000027', departmentCode: 'KHO-VN', positionTitle: 'NV Kho', branch: 'HN', salary: 10_000_000 },
    { code: 'EMP-028', emailPrefix: 'khovn02', fullName: 'NV Kho VN 02', phone: '0900000028', departmentCode: 'KHO-VN', positionTitle: 'NV Kho', branch: 'HCM', salary: 10_000_000 },

    // Tài xế
    { code: 'EMP-029', emailPrefix: 'taixe01', fullName: 'Tài xế 01', phone: '0900000029', departmentCode: 'VT', positionTitle: 'Tài xế', branch: 'HN', salary: 10_000_000 },
    { code: 'EMP-030', emailPrefix: 'taixe02', fullName: 'Tài xế 02', phone: '0900000030', departmentCode: 'VT', positionTitle: 'Tài xế', branch: 'HCM', salary: 10_000_000 },
  ];

  // Pass 1: Create all employees (upsert by code)
  for (const emp of employees) {
    const user = await prisma.user.findUnique({
      where: { email: `${emp.emailPrefix}@${emailDomain}` },
    });

    if (!user) {
      console.log(`    ⚠ User ${emp.emailPrefix}@${emailDomain} not found, skipping ${emp.code}`);
      continue;
    }

    const existing = await prisma.employee.findUnique({ where: { code: emp.code } });

    if (!existing) {
      // Also check if this userId already has an employee
      const byUser = await prisma.employee.findUnique({ where: { userId: user.id } });
      if (byUser) {
        // Update code if needed
        await prisma.employee.update({
          where: { userId: user.id },
          data: { code: emp.code, fullName: emp.fullName, phone: emp.phone, departmentCode: emp.departmentCode, positionTitle: emp.positionTitle, branch: emp.branch, salary: emp.salary },
        });
      } else {
        await prisma.employee.create({
          data: {
            code: emp.code,
            userId: user.id,
            fullName: emp.fullName,
            email: `${emp.emailPrefix}@${emailDomain}`,
            phone: emp.phone,
            departmentCode: emp.departmentCode,
            positionTitle: emp.positionTitle,
            branch: emp.branch,
            joinDate: new Date('2024-01-15'),
            salary: emp.salary,
            status: 'ACTIVE',
          },
        });
      }
    } else {
      await prisma.employee.update({
        where: { code: emp.code },
        data: {
          fullName: emp.fullName,
          phone: emp.phone,
          departmentCode: emp.departmentCode,
          positionTitle: emp.positionTitle,
          branch: emp.branch,
          salary: emp.salary,
        },
      });
    }
  }

  // Pass 2: Set managerId for org hierarchy
  const managerMap: { employee: string; manager: string }[] = [
    // BGD → CEO
    { employee: 'EMP-002', manager: 'EMP-001' }, // COO → CEO
    { employee: 'EMP-003', manager: 'EMP-001' }, // CFO → CEO
    { employee: 'EMP-004', manager: 'EMP-001' }, // DOPS → CEO

    // Kinh doanh → GDKD → COO
    { employee: 'EMP-005', manager: 'EMP-002' }, // GDKD → COO
    { employee: 'EMP-006', manager: 'EMP-005' }, // Leader HN → GDKD
    { employee: 'EMP-007', manager: 'EMP-005' }, // Leader HCM → GDKD
    { employee: 'EMP-008', manager: 'EMP-006' }, // Sale01 → Leader HN
    { employee: 'EMP-009', manager: 'EMP-006' }, // Sale02 → Leader HN
    { employee: 'EMP-010', manager: 'EMP-007' }, // Sale03 → Leader HCM
    { employee: 'EMP-011', manager: 'EMP-007' }, // Sale04 → Leader HCM

    // Marketing, CSKH → COO
    { employee: 'EMP-012', manager: 'EMP-002' },
    { employee: 'EMP-013', manager: 'EMP-002' },

    // Kế toán → CFO
    { employee: 'EMP-014', manager: 'EMP-003' }, // TP KT → CFO
    { employee: 'EMP-015', manager: 'EMP-014' },
    { employee: 'EMP-016', manager: 'EMP-014' },
    { employee: 'EMP-017', manager: 'EMP-014' },

    // HR → COO
    { employee: 'EMP-018', manager: 'EMP-002' },

    // Logistics → DOPS
    { employee: 'EMP-019', manager: 'EMP-004' },

    // XNK → DOPS
    { employee: 'EMP-020', manager: 'EMP-004' },
    { employee: 'EMP-021', manager: 'EMP-020' },
    { employee: 'EMP-022', manager: 'EMP-020' },

    // Kho TQ → Logistics
    { employee: 'EMP-023', manager: 'EMP-019' },
    { employee: 'EMP-024', manager: 'EMP-019' },

    // Kho VN → Logistics
    { employee: 'EMP-025', manager: 'EMP-019' },
    { employee: 'EMP-026', manager: 'EMP-019' },
    { employee: 'EMP-027', manager: 'EMP-025' },
    { employee: 'EMP-028', manager: 'EMP-026' },

    // Tài xế → Kho VN
    { employee: 'EMP-029', manager: 'EMP-025' },
    { employee: 'EMP-030', manager: 'EMP-026' },
  ];

  for (const rel of managerMap) {
    const mgr = await prisma.employee.findUnique({ where: { code: rel.manager } });
    if (mgr) {
      await prisma.employee.update({
        where: { code: rel.employee },
        data: { managerId: mgr.id },
      });
    }
  }

  console.log(`  ✅ ${employees.length} employees seeded with org hierarchy`);
}
