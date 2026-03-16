import { Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages';

const logger = new Logger('AIToolRegistry');

// -------------------------------------------------------------------
// Dinh nghia cac tool cho Claude API (function calling / tool_use)
// Moi tool la 1 truy van read-only vao DB, co gioi han so luong ket qua
// -------------------------------------------------------------------

export const AI_TOOLS: Tool[] = [
  {
    name: 'query_orders',
    description:
      'Tra cuu danh sach don hang. Ho tro loc theo trang thai, loai dich vu, khach hang, sale phu trach. ' +
      'Tra ve toi da 20 don moi nhat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Loc theo trang thai: DRAFT, CONFIRMED, DEPOSITED, IN_TRANSIT, ARRIVED, CUSTOMS, DELIVERING, COMPLETED, CANCELLED, ISSUE',
        },
        serviceType: {
          type: 'string',
          description: 'Loc theo loai dich vu: VCT, MHH, KIEM_HANG, PHO_HANG',
        },
        customerCode: {
          type: 'string',
          description: 'Loc theo ma khach hang (VD: ERP-KH-000001)',
        },
        search: {
          type: 'string',
          description: 'Tim theo ma don hang hoac ma khach hang',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'count_orders',
    description:
      'Dem so don hang theo dieu kien. Dung khi user hoi "bao nhieu don", "tong so don".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Loc theo trang thai' },
        serviceType: { type: 'string', description: 'Loc theo loai dich vu' },
        dateFrom: { type: 'string', description: 'Tu ngay (ISO 8601, VD: 2026-03-01)' },
        dateTo: { type: 'string', description: 'Den ngay (ISO 8601)' },
      },
      required: [],
    },
  },
  {
    name: 'query_customers',
    description:
      'Tra cuu danh sach khach hang. Ho tro loc theo hang (tier), tim kiem theo ten/ma. ' +
      'Tra ve toi da 20 khach hang.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tier: {
          type: 'string',
          description: 'Loc theo hang KH: STANDARD, SILVER, GOLD, PLATINUM, VIP',
        },
        search: {
          type: 'string',
          description: 'Tim theo ten, ma, email, SDT khach hang',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_containers',
    description:
      'Tra cuu danh sach container. Ho tro loc theo trang thai van chuyen. ' +
      'Tra ve toi da 20 container moi nhat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Loc theo trang thai: PLANNING, LOADING, IN_TRANSIT, ARRIVED, CUSTOMS, COMPLETED, ON_HOLD_BORDER',
        },
        search: {
          type: 'string',
          description: 'Tim theo ma container',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_finance',
    description:
      'Tra cuu thong tin tai chinh: cong no phai thu (AR), phieu thu/chi, tong doanh thu. ' +
      'Dung khi user hoi ve tien, no, thanh toan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          description: 'Loai truy van: ar_summary (tong cong no), ar_overdue (no qua han), revenue_summary (doanh thu), voucher_pending (phieu cho duyet)',
        },
        customerCode: {
          type: 'string',
          description: 'Loc theo ma khach hang (cho ar_summary)',
        },
        dateFrom: { type: 'string', description: 'Tu ngay (ISO 8601)' },
        dateTo: { type: 'string', description: 'Den ngay (ISO 8601)' },
      },
      required: ['type'],
    },
  },
  {
    name: 'query_packages',
    description:
      'Tra cuu kien hang tai kho TQ hoac kho VN. Ho tro loc theo trang thai kho. ' +
      'Tra ve toi da 20 kien hang.',
    input_schema: {
      type: 'object' as const,
      properties: {
        warehouse: {
          type: 'string',
          description: 'Chon kho: CN (Trung Quoc) hoac VN (Viet Nam)',
        },
        status: {
          type: 'string',
          description: 'Trang thai kho TQ: RECEIVED, CHECKED, PACKED, SHIPPED. Kho VN: RECEIVED, SORTED, READY, DELIVERED',
        },
        search: {
          type: 'string',
          description: 'Tim theo ma kien, ma van don, ma don hang',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_deliveries',
    description:
      'Tra cuu lich su giao hang den tay khach (last-mile delivery). Ho tro loc theo trang thai, tai xe, ' +
      'khoang thoi gian. DRIVER chi xem duoc cac chuyen giao do minh phu trach.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Trang thai giao hang: PENDING, ASSIGNED, IN_PROGRESS, DELIVERED, FAILED, RETURNED',
        },
        driverId: {
          type: 'string',
          description: 'Loc theo ID tai xe (mac dinh lay cua chinh minh neu la DRIVER)',
        },
        dateFrom: {
          type: 'string',
          description: 'Tu ngay giao (ISO 8601, VD: 2026-03-01)',
        },
        dateTo: {
          type: 'string',
          description: 'Den ngay giao (ISO 8601)',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_complaints',
    description:
      'Tra cuu khieu nai / yeu cau ho tro cua khach hang. Ho tro loc theo trang thai, muc do uu tien, ' +
      'khach hang. CSKH chi xem don trong pham vi phan cong cua minh.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Trang thai: OPEN, INVESTIGATING, PENDING_RESOLUTION, RESOLVED, CLOSED',
        },
        priority: {
          type: 'string',
          description: 'Muc do uu tien: LOW, MEDIUM, HIGH, CRITICAL',
        },
        customerCode: {
          type: 'string',
          description: 'Loc theo ma khach hang',
        },
        search: {
          type: 'string',
          description: 'Tim theo tieu de hoac ma khieu nai',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_warehouse_stats',
    description:
      'Thong ke tong quan ve kho hang: tong so kien tai kho TQ, kho VN, so kien dang cho xu ly, ' +
      'ty le su dung kho. Tra ve so lieu tong hop, khong can phan quyen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        warehouse: {
          type: 'string',
          description: 'Loc theo kho: CN (Trung Quoc), VN (Viet Nam), hoac bo qua de lay ca hai',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_commissions',
    description:
      'Tra cuu hoa hong ban hang cua nhan vien sale. Ho tro loc theo trang thai, thang/nam, sale phu trach. ' +
      'SALE chi xem duoc hoa hong cua chinh minh.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Trang thai hoa hong: PENDING, APPROVED, PAID, CANCELLED',
        },
        saleId: {
          type: 'string',
          description: 'Loc theo ID nhan vien sale (SALE tu dong loc theo chinh minh)',
        },
        month: {
          type: 'number',
          description: 'Thang can tra cuu (1-12)',
        },
        year: {
          type: 'number',
          description: 'Nam can tra cuu (VD: 2026)',
        },
        limit: {
          type: 'number',
          description: 'So luong ket qua (mac dinh 10, toi da 20)',
        },
      },
      required: [],
    },
  },
];

// -------------------------------------------------------------------
// Thuc thi tool — goi Prisma read-only query
// -------------------------------------------------------------------

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  prisma: PrismaService,
  userId: string,
  userRole: string,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 20);

  try {
    switch (toolName) {
      case 'query_orders':
        return await queryOrders(prisma, input, userId, userRole, limit);
      case 'count_orders':
        return await countOrders(prisma, input, userId, userRole);
      case 'query_customers':
        return await queryCustomers(prisma, input, userId, userRole, limit);
      case 'query_containers':
        return await queryContainers(prisma, input, limit);
      case 'query_finance':
        return await queryFinance(prisma, input, userId, userRole);
      case 'query_packages':
        return await queryPackages(prisma, input, limit);
      case 'query_deliveries':
        return await queryDeliveries(prisma, input, userId, userRole, limit);
      case 'query_complaints':
        return await queryComplaints(prisma, input, userId, userRole, limit);
      case 'query_warehouse_stats':
        return await queryWarehouseStats(prisma, input);
      case 'query_commissions':
        return await queryCommissions(prisma, input, userId, userRole, limit);
      default:
        return JSON.stringify({ error: `Tool "${toolName}" khong ton tai` });
    }
  } catch (error) {
    logger.error(`Tool ${toolName} that bai: ${error}`);
    return JSON.stringify({ error: 'Truy van that bai, vui long thu lai' });
  }
}

// -------------------------------------------------------------------
// Query handlers
// -------------------------------------------------------------------

async function queryOrders(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
  limit: number,
): Promise<string> {
  const where: Record<string, unknown> = {};

  // RBAC: SALE chi xem don cua minh
  if (userRole === 'SALE') {
    where.saleId = userId;
  } else if (userRole === 'SALES_LEADER') {
    // SALES_LEADER chi xem don cua thanh vien trong nhom minh quan ly
    const teamMembers = await prisma.user.findMany({
      where: { leaderId: userId },
      select: { id: true },
    });
    const teamIds = teamMembers.map((m) => m.id);
    // Bao gom ca ban than leader
    where.saleId = { in: [userId, ...teamIds] };
  }

  if (input.status) where.status = input.status;
  if (input.serviceType) where.serviceType = input.serviceType;
  if (input.customerCode) {
    where.customer = { code: input.customerCode };
  }
  if (input.search) {
    where.OR = [
      { code: { contains: String(input.search), mode: 'insensitive' } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      code: true,
      status: true,
      serviceType: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      customer: { select: { fullName: true, code: true } },
    },
  });

  return JSON.stringify({
    count: orders.length,
    orders: orders.map((o) => ({
      ma: o.code,
      trangThai: o.status,
      dichVu: o.serviceType,
      tongTien: o.totalAmount ? Number(o.totalAmount) : 0,
      tienTe: o.currency,
      khachHang: o.customer?.fullName || '---',
      maKH: o.customer?.code || '---',
      ngayTao: o.createdAt,
    })),
  });
}

async function countOrders(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
): Promise<string> {
  const where: Record<string, unknown> = {};

  if (userRole === 'SALE') where.saleId = userId;
  if (input.status) where.status = input.status;
  if (input.serviceType) where.serviceType = input.serviceType;
  if (input.dateFrom || input.dateTo) {
    where.createdAt = {};
    if (input.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(String(input.dateFrom));
    if (input.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(String(input.dateTo));
  }

  const [count, sumResult] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
  ]);

  return JSON.stringify({
    tongSoDon: count,
    tongGiaTri: sumResult._sum.totalAmount ? Number(sumResult._sum.totalAmount) : 0,
  });
}

async function queryCustomers(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
  limit: number,
): Promise<string> {
  const where: Record<string, unknown> = {};

  if (userRole === 'SALE') where.saleId = userId;
  if (input.tier) where.tier = input.tier;
  if (input.search) {
    where.OR = [
      { fullName: { contains: String(input.search), mode: 'insensitive' } },
      { code: { contains: String(input.search), mode: 'insensitive' } },
      { phone: { contains: String(input.search) } },
      { email: { contains: String(input.search), mode: 'insensitive' } },
    ];
  }

  // CRM roles duoc xem day du thong tin lien he (phone, email, bankAccount)
  const isCrmRole = ['CEO', 'COO', 'CFO', 'DIRECTOR_OPERATIONS', 'SALES_DIRECTOR',
    'SALES_LEADER', 'SALE', 'CSKH', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT_AR'].includes(userRole);

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      code: true,
      fullName: true,
      companyName: true,
      tier: true,
      // Chi tra ve phone/email cho CRM roles
      phone: isCrmRole,
      email: isCrmRole,
      totalOrders: true,
      totalRevenue: true,
      isActive: true,
      wallet: { select: { balance: true } },
    },
  });

  return JSON.stringify({
    count: customers.length,
    khachHang: customers.map((c) => ({
      ma: c.code,
      ten: c.fullName,
      congTy: c.companyName || '---',
      hang: c.tier,
      ...(isCrmRole && { sdt: (c as { phone?: string }).phone || '---' }),
      ...(isCrmRole && { email: (c as { email?: string }).email || '---' }),
      tongDon: c.totalOrders,
      tongDoanhThu: c.totalRevenue ? Number(c.totalRevenue) : 0,
      soDuVi: c.wallet?.balance ? Number(c.wallet.balance) : 0,
      hoatDong: c.isActive,
    })),
  });
}

async function queryContainers(
  prisma: PrismaService,
  input: Record<string, unknown>,
  limit: number,
): Promise<string> {
  const where: Record<string, unknown> = {};

  if (input.status) where.status = input.status;
  if (input.search) {
    where.code = { contains: String(input.search), mode: 'insensitive' };
  }

  const containers = await prisma.container.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      code: true,
      status: true,
      shippingRoute: true,
      totalWeight: true,
      totalPackages: true,
      fillRate: true,
      estimatedDepartureAt: true,
      estimatedArrivalAt: true,
      actualDepartureAt: true,
      actualArrivalAt: true,
    },
  });

  return JSON.stringify({
    count: containers.length,
    containers: containers.map((c) => ({
      ma: c.code,
      trangThai: c.status,
      tuyen: c.shippingRoute || '---',
      tongCanNang: c.totalWeight ? Number(c.totalWeight) : 0,
      soKien: c.totalPackages,
      tiLeLap: c.fillRate ? Number(c.fillRate) : 0,
      ngayXuatDuKien: c.estimatedDepartureAt,
      ngayXuatThucTe: c.actualDepartureAt,
      ngayDenDuKien: c.estimatedArrivalAt,
      ngayDenThucTe: c.actualArrivalAt,
    })),
  });
}

async function queryFinance(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
): Promise<string> {
  // Chi finance roles duoc xem day du: CFO, CHIEF_ACCOUNTANT, ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST
  // CEO, COO, DIRECTOR_OPERATIONS cung duoc xem revenue_summary
  const FULL_FINANCE_ROLES = ['CFO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'ACCOUNTANT_AR', 'ACCOUNTANT_COST'];
  const REVENUE_ROLES = ['CEO', 'COO', 'DIRECTOR_OPERATIONS', 'SALES_DIRECTOR'];
  const isFullFinance = FULL_FINANCE_ROLES.includes(userRole);
  const canViewRevenue = isFullFinance || REVENUE_ROLES.includes(userRole) || userRole === 'SALE';

  const queryType = String(input.type || 'ar_summary');

  // Roles khong thuoc finance chi duoc xem revenue_summary (doanh thu don hang cua minh)
  if (!isFullFinance && !['revenue_summary'].includes(queryType) && !canViewRevenue) {
    return JSON.stringify({ error: 'Khong co quyen xem du lieu tai chinh chi tiet. Lien he phong Ke toan.' });
  }
  if (!isFullFinance && ['ar_summary', 'ar_overdue', 'voucher_pending'].includes(queryType)) {
    return JSON.stringify({ error: 'Khong co quyen xem cong no va phieu thu/chi. Vui long lien he phong Ke toan.' });
  }

  switch (queryType) {
    case 'ar_summary': {
      const where: Record<string, unknown> = { status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] } };
      if (input.customerCode) where.customer = { code: input.customerCode };

      const [count, sum] = await Promise.all([
        prisma.accountReceivable.count({ where }),
        prisma.accountReceivable.aggregate({ where, _sum: { amount: true, paidAmount: true } }),
      ]);

      const tongNo = Number(sum._sum.amount || 0);
      const daThu = Number(sum._sum.paidAmount || 0);

      return JSON.stringify({
        loai: 'Tong hop cong no phai thu',
        soPhieu: count,
        tongCongNo: tongNo,
        daThu: daThu,
        conLai: tongNo - daThu,
      });
    }

    case 'ar_overdue': {
      const overdueARs = await prisma.accountReceivable.findMany({
        where: { status: 'OVERDUE' },
        orderBy: { dueDate: 'asc' },
        take: 20,
        select: {
          code: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
          customer: { select: { fullName: true, code: true } },
        },
      });

      return JSON.stringify({
        loai: 'Cong no qua han',
        soPhieu: overdueARs.length,
        danhSach: overdueARs.map((ar) => ({
          maPhieu: ar.code,
          tongTien: Number(ar.amount),
          daThu: Number(ar.paidAmount || 0),
          hanThu: ar.dueDate,
          khachHang: ar.customer?.fullName || '---',
          maKH: ar.customer?.code || '---',
        })),
      });
    }

    case 'revenue_summary': {
      const dateWhere: Record<string, unknown> = {};
      if (input.dateFrom || input.dateTo) {
        dateWhere.createdAt = {};
        if (input.dateFrom) (dateWhere.createdAt as Record<string, unknown>).gte = new Date(String(input.dateFrom));
        if (input.dateTo) (dateWhere.createdAt as Record<string, unknown>).lte = new Date(String(input.dateTo));
      }

      const where: Record<string, unknown> = {
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        ...dateWhere,
      };

      if (userRole === 'SALE') where.saleId = userId;

      const result = await prisma.order.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: true,
      });

      return JSON.stringify({
        loai: 'Tong hop doanh thu',
        soDon: result._count,
        tongDoanhThu: Number(result._sum.totalAmount || 0),
      });
    }

    case 'voucher_pending': {
      const vouchers = await prisma.paymentVoucher.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          code: true,
          type: true,
          amount: true,
          currency: true,
          beneficiary: true,
          reason: true,
          createdAt: true,
        },
      });

      return JSON.stringify({
        loai: 'Phieu thu/chi cho duyet',
        soPhieu: vouchers.length,
        danhSach: vouchers.map((v) => ({
          maPhieu: v.code,
          loaiPhieu: v.type,
          soTien: Number(v.amount),
          tienTe: v.currency,
          nguoiThuHuong: v.beneficiary,
          lyDo: v.reason,
          ngayTao: v.createdAt,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Loai truy van "${queryType}" khong hop le` });
  }
}

async function queryPackages(
  prisma: PrismaService,
  input: Record<string, unknown>,
  limit: number,
): Promise<string> {
  const where: Record<string, unknown> = {};
  const warehouse = String(input.warehouse || 'CN').toUpperCase();

  if (warehouse === 'CN') {
    if (input.status) where.warehouseCNStatus = input.status;
    else where.warehouseCNStatus = { not: null };
  } else {
    if (input.status) where.warehouseVNStatus = input.status;
    else where.warehouseVNStatus = { not: null };
  }

  if (input.search) {
    where.OR = [
      { code: { contains: String(input.search), mode: 'insensitive' } },
      { trackingNumberCN: { contains: String(input.search), mode: 'insensitive' } },
    ];
  }

  const packages = await prisma.package.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      code: true,
      warehouseCNStatus: true,
      warehouseVNStatus: true,
      actualWeight: true,
      chargeableWeight: true,
      trackingNumberCN: true,
      orderId: true,
    },
  });

  return JSON.stringify({
    count: packages.length,
    kho: warehouse,
    kienHang: packages.map((p) => ({
      ma: p.code,
      trangThaiTQ: p.warehouseCNStatus || '---',
      trangThaiVN: p.warehouseVNStatus || '---',
      canNang: p.actualWeight ? Number(p.actualWeight) : 0,
      canTinhPhi: p.chargeableWeight ? Number(p.chargeableWeight) : 0,
      trackingTQ: p.trackingNumberCN || '---',
      maDonHang: p.orderId || '---',
    })),
  });
}

// -------------------------------------------------------------------
// Tool: query_deliveries — Tra cuu giao hang last-mile
// RBAC: DRIVER chi xem chuyen giao cua chinh minh
// -------------------------------------------------------------------

async function queryDeliveries(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
  limit: number,
): Promise<string> {
  // Package model chi co warehouseVNStatus de loc giao hang.
  // driverId, scheduledAt, status la cac field khong ton tai tren Package.
  // RBAC cho DRIVER: hien thi kien hang cua don hang trong pham vi KH cua driver.
  // Do Package khong co driverId truc tiep, loc qua orderId hoac customerId neu co.

  const pkgWhere: Record<string, unknown> = {};

  // Loc theo trang thai giao hang (map sang warehouseVNStatus)
  if (input.status) {
    // Map status tu tool schema sang warehouseVNStatus
    const statusMap: Record<string, string> = {
      PENDING: 'SORTED',
      ASSIGNED: 'SORTED',
      IN_PROGRESS: 'READY',
      DELIVERED: 'DELIVERED',
      FAILED: 'READY',
      RETURNED: 'RECEIVED',
    };
    const mappedStatus = statusMap[String(input.status)] ?? String(input.status);
    pkgWhere.warehouseVNStatus = mappedStatus;
  } else {
    pkgWhere.warehouseVNStatus = { in: ['READY', 'DELIVERED'] };
  }

  // Loc theo ngay cap nhat (thay cho scheduledAt)
  if (input.dateFrom || input.dateTo) {
    pkgWhere.updatedAt = {};
    if (input.dateFrom) (pkgWhere.updatedAt as Record<string, unknown>).gte = new Date(String(input.dateFrom));
    if (input.dateTo) (pkgWhere.updatedAt as Record<string, unknown>).lte = new Date(String(input.dateTo));
  }

  const packages = await prisma.package.findMany({
    where: pkgWhere,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      code: true,
      warehouseVNStatus: true,
      actualWeight: true,
      updatedAt: true,
      order: {
        select: {
          code: true,
          // Khong tra ve phone cua khach hang vi ly do bao mat / quyen rieng tu
          customer: { select: { fullName: true } },
        },
      },
    },
  });

  return JSON.stringify({
    count: packages.length,
    giaoHang: packages.map((p) => ({
      maKien: p.code,
      trangThai: p.warehouseVNStatus || '---',
      canNang: p.actualWeight ? Number(p.actualWeight) : 0,
      maDonHang: p.order?.code || '---',
      khachHang: p.order?.customer?.fullName || '---',
      capNhatLuc: p.updatedAt,
    })),
  });
}

// -------------------------------------------------------------------
// Tool: query_complaints — Tra cuu khieu nai
// RBAC: CSKH chi xem khieu nai phan cong cho minh
// -------------------------------------------------------------------

async function queryComplaints(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
  limit: number,
): Promise<string> {
  const where: Record<string, unknown> = {};

  // RBAC: CSKH chi xem khieu nai duoc phan cong (handlerId)
  if (userRole === 'CSKH') {
    where.handlerId = userId;
  }

  if (input.status) where.status = input.status;
  // Complaint dung truong severity (LOW/MEDIUM/HIGH/CRITICAL)
  if (input.priority) where.severity = input.priority;
  if (input.customerCode) {
    where.customer = { code: input.customerCode };
  }
  if (input.search) {
    where.OR = [
      { description: { contains: String(input.search), mode: 'insensitive' } },
      { code: { contains: String(input.search), mode: 'insensitive' } },
    ];
  }

  const complaints = await prisma.complaint.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      code: true,
      description: true,
      status: true,
      severity: true,
      type: true,
      createdAt: true,
      resolvedAt: true,
      customer: { select: { fullName: true, code: true } },
      order: { select: { code: true } },
    },
  });

  return JSON.stringify({
    count: complaints.length,
    khieuNai: complaints.map((c) => ({
      ma: c.code,
      moTa: c.description,
      trangThai: c.status,
      mucDo: c.severity,
      loai: c.type,
      khachHang: c.customer?.fullName || '---',
      maKH: c.customer?.code || '---',
      maDonHang: c.order?.code || '---',
      ngayTao: c.createdAt,
      ngayGiaiQuyet: c.resolvedAt || null,
    })),
  });
}

// -------------------------------------------------------------------
// Tool: query_warehouse_stats — Thong ke kho tong hop (khong can RBAC)
// -------------------------------------------------------------------

async function queryWarehouseStats(
  prisma: PrismaService,
  input: Record<string, unknown>,
): Promise<string> {
  const warehouse = input.warehouse ? String(input.warehouse).toUpperCase() : null;

  const [cnStats, vnStats] = await Promise.all([
    // Thong ke kho TQ
    warehouse === 'VN'
      ? null
      : Promise.all([
          prisma.package.count({ where: { warehouseCNStatus: { not: null } } }),
          prisma.package.count({ where: { warehouseCNStatus: 'RECEIVED' } }),
          prisma.package.count({ where: { warehouseCNStatus: 'PACKED' } }),
          prisma.package.count({ where: { warehouseCNStatus: 'SHIPPED' } }),
          prisma.package.aggregate({
            where: { warehouseCNStatus: { not: null } },
            _sum: { actualWeight: true },
          }),
        ]),
    // Thong ke kho VN
    warehouse === 'CN'
      ? null
      : Promise.all([
          prisma.package.count({ where: { warehouseVNStatus: { not: null } } }),
          prisma.package.count({ where: { warehouseVNStatus: 'RECEIVED' } }),
          prisma.package.count({ where: { warehouseVNStatus: 'READY' } }),
          prisma.package.count({ where: { warehouseVNStatus: 'DELIVERED' } }),
          prisma.package.aggregate({
            where: { warehouseVNStatus: { not: null } },
            _sum: { actualWeight: true },
          }),
        ]),
  ]);

  const result: Record<string, unknown> = { loai: 'Thong ke kho hang' };

  if (cnStats) {
    const [tongTQ, nhanTQ, dongGoiTQ, daGuiTQ, canTQ] = cnStats;
    result.khoTrungQuoc = {
      tongKien: tongTQ,
      dangNhanHang: nhanTQ,
      daDongGoi: dongGoiTQ,
      daGui: daGuiTQ,
      tongCanNang: canTQ._sum.actualWeight ? Number(canTQ._sum.actualWeight) : 0,
    };
  }

  if (vnStats) {
    const [tongVN, nhanVN, sanSangVN, daGiaoVN, canVN] = vnStats;
    result.khoVietNam = {
      tongKien: tongVN,
      dangNhanHang: nhanVN,
      sanSangGiao: sanSangVN,
      daGiao: daGiaoVN,
      tongCanNang: canVN._sum.actualWeight ? Number(canVN._sum.actualWeight) : 0,
    };
  }

  return JSON.stringify(result);
}

// -------------------------------------------------------------------
// Tool: query_commissions — Tra cuu hoa hong sale
// RBAC: SALE chi xem hoa hong cua chinh minh
// -------------------------------------------------------------------

async function queryCommissions(
  prisma: PrismaService,
  input: Record<string, unknown>,
  userId: string,
  userRole: string,
  limit: number,
): Promise<string> {
  const where: Record<string, unknown> = {};

  // RBAC: SALE chi xem hoa hong cua minh (saleId)
  if (userRole === 'SALE') {
    where.saleId = userId;
  } else if (input.saleId) {
    where.saleId = String(input.saleId);
  }

  if (input.status) where.status = input.status;

  // Loc theo thang/nam dua tren createdAt (CommissionRecord khong co periodStart/periodEnd)
  if (input.month || input.year) {
    const year = Number(input.year) || new Date().getFullYear();
    const month = Number(input.month);
    if (month >= 1 && month <= 12) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    } else if (input.year) {
      where.createdAt = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      };
    }
  }

  const commissions = await prisma.commissionRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      commissionAmount: true,
      commissionRate: true,
      orderRevenue: true,
      paidAt: true,
      createdAt: true,
      sale: { select: { email: true } },
      order: { select: { code: true } },
    },
  });

  const totalAmount = commissions.reduce((acc, c) => acc + Number(c.commissionAmount || 0), 0);

  return JSON.stringify({
    count: commissions.length,
    tongHoaHong: Math.round(totalAmount * 100) / 100,
    hoaHong: commissions.map((c) => ({
      id: c.id,
      trangThai: c.status,
      soTienHoaHong: Number(c.commissionAmount || 0),
      tiLeHoaHong: Number(c.commissionRate || 0),
      doanhThuDon: Number(c.orderRevenue || 0),
      ngayTra: c.paidAt || null,
      sale: c.sale?.email || '---',
      maDonHang: c.order?.code || '---',
      ngayTao: c.createdAt,
    })),
  });
}
