import { PrismaClient } from '@prisma/client';

/**
 * Realistic Vietnamese business data seed.
 * Creates orders, containers, packages, deliveries, quotations, complaints, etc.
 * Only runs in dev/staging (not production).
 */
export async function seedRealisticData(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') {
    console.log('  -> Skipping realistic data in production');
    return;
  }

  console.log('  -> Seeding realistic business data...');

  const emailDomain = process.env.SEED_EMAIL_DOMAIN || 'example.com';

  // ── Lookup existing entities ─────────────────────────────────────
  const users = await prisma.user.findMany();
  const customers = await prisma.customer.findMany({ include: { wallet: true } });
  const vendors = await prisma.vendor.findMany();
  const vehicles = await prisma.vehicle.findMany();
  const drivers = await prisma.driver.findMany();

  if (users.length === 0 || customers.length === 0) {
    console.log('    ! No users/customers found. Run roles + sample-data seeds first.');
    return;
  }

  const findUser = (prefix: string) =>
    users.find((u) => u.email.startsWith(prefix + '@')) ?? users[0];
  const sale01 = findUser('sale01');
  const sale02 = findUser('sale02');
  const sale03 = findUser('sale03');
  const khotq01 = findUser('khotq01');
  const khovn01 = findUser('khovn01');
  const khovn = findUser('khovn');
  const logistics = findUser('logistics');
  const xnk = findUser('xnk');
  const ketoan = findUser('ketoan');

  // ── Helper: generate order code ──────────────────────────────────
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let orderSeq = 1;
  const nextOrderCode = () => `TBS-ORD-${ymd}-${String(orderSeq++).padStart(4, '0')}`;
  let pkgSeq = 1;
  const nextPkgCode = () => `TBS-PKG-${String(pkgSeq++).padStart(6, '0')}`;
  let cntSeq = 1;
  const nextCntCode = () => `TBS${ym}${String(cntSeq++).padStart(2, '0')}`;
  let delSeq = 1;
  const nextDelCode = () => `TBS-DEL-${ymd}-${String(delSeq++).padStart(4, '0')}`;
  let quoSeq = 1;
  const nextQuoCode = () => `QUO-${ym}-${String(quoSeq++).padStart(4, '0')}`;
  let cmpSeq = 1;
  const nextCmpCode = () => `CMP-${ym}-${String(cmpSeq++).padStart(4, '0')}`;
  let soSeq = 1;
  const nextSOCode = () => `SO-${ym}-${String(soSeq++).padStart(4, '0')}`;

  // ── Guard: skip if our specific seed data already exists ─────────
  const seedMarker = await prisma.order.findFirst({
    where: { code: { startsWith: `TBS-ORD-${ymd}-` } },
  });
  if (seedMarker) {
    console.log(`    ! Realistic seed data already exists (found ${seedMarker.code}), skipping`);
    return;
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. QUOTATIONS (5 bao gia)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Quotations...');

  const quotations = [
    {
      code: nextQuoCode(),
      customerId: customers[0].id,
      createdBy: sale01.id,
      serviceType: 'VCT' as const,
      branch: 'HN' as const,
      shippingRoute: 'ROAD' as const,
      status: 'APPROVED' as const,
      subtotal: 15_000_000,
      totalAmount: 15_000_000,
      validUntil: new Date(now.getTime() + 30 * 86400000),
      approvedBy: sale01.id,
      approvedAt: new Date(now.getTime() - 5 * 86400000),
    },
    {
      code: nextQuoCode(),
      customerId: customers[1].id,
      createdBy: sale02.id,
      serviceType: 'MHH' as const,
      branch: 'HN' as const,
      shippingRoute: 'ROAD' as const,
      status: 'PENDING_APPROVAL' as const,
      subtotal: 45_000_000,
      totalAmount: 45_000_000,
      validUntil: new Date(now.getTime() + 15 * 86400000),
    },
    {
      code: nextQuoCode(),
      customerId: customers[2].id,
      createdBy: sale03.id,
      serviceType: 'VCT' as const,
      branch: 'HCM' as const,
      shippingRoute: 'SEA' as const,
      status: 'CONVERTED' as const,
      subtotal: 120_000_000,
      totalAmount: 120_000_000,
      validUntil: new Date(now.getTime() + 30 * 86400000),
      approvedBy: sale03.id,
      approvedAt: new Date(now.getTime() - 10 * 86400000),
    },
    {
      code: nextQuoCode(),
      customerId: customers[0].id,
      createdBy: sale01.id,
      serviceType: 'MHH' as const,
      branch: 'HN' as const,
      status: 'DRAFT' as const,
      subtotal: 8_500_000,
      totalAmount: 8_500_000,
      validUntil: new Date(now.getTime() + 30 * 86400000),
    },
    {
      code: nextQuoCode(),
      customerId: customers[3]?.id ?? customers[0].id,
      createdBy: sale01.id,
      serviceType: 'VCT' as const,
      branch: 'HN' as const,
      shippingRoute: 'AIR' as const,
      status: 'EXPIRED' as const,
      subtotal: 5_200_000,
      totalAmount: 5_200_000,
      validUntil: new Date(now.getTime() - 10 * 86400000),
    },
  ];

  for (const q of quotations) {
    const existing = await prisma.quotation.findUnique({ where: { code: q.code } });
    if (!existing) {
      await prisma.quotation.create({ data: q });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. CONTAINERS (6 cont o cac trang thai khac nhau)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Containers...');

  const containerDefs = [
    {
      code: nextCntCode(),
      shippingRoute: 'ROAD' as const,
      status: 'COMPLETED' as const,
      origin: 'Kho Quang Chau, Quang Dong',
      destination: 'Kho Ha Noi',
      carrier: 'Tan Dai Phat Logistics',
      totalPackages: 45,
      totalWeight: 1250.5,
      maxCapacity: 2000,
      fillRate: 62.53,
      estimatedDepartureAt: new Date(now.getTime() - 20 * 86400000),
      actualDepartureAt: new Date(now.getTime() - 20 * 86400000),
      estimatedArrivalAt: new Date(now.getTime() - 15 * 86400000),
      actualArrivalAt: new Date(now.getTime() - 14 * 86400000),
      customsClearedAt: new Date(now.getTime() - 13 * 86400000),
      createdBy: logistics.id,
    },
    {
      code: nextCntCode(),
      shippingRoute: 'ROAD' as const,
      status: 'IN_TRANSIT' as const,
      origin: 'Kho Nghia O, Trung Quoc',
      destination: 'Kho Ha Noi',
      carrier: 'Hai Phong Trans',
      totalPackages: 38,
      totalWeight: 980.0,
      maxCapacity: 2000,
      fillRate: 49.0,
      estimatedDepartureAt: new Date(now.getTime() - 3 * 86400000),
      actualDepartureAt: new Date(now.getTime() - 3 * 86400000),
      estimatedArrivalAt: new Date(now.getTime() + 2 * 86400000),
      createdBy: logistics.id,
    },
    {
      code: nextCntCode(),
      shippingRoute: 'SEA' as const,
      status: 'CUSTOMS' as const,
      origin: 'Kho Quang Chau',
      destination: 'Kho HCM - Cat Lai',
      carrier: 'COSCO Shipping',
      bookingRef: 'COSCO-VN-2026-0312',
      sealNumber: 'SEAL-88421',
      vesselName: 'COSCO FORTUNE',
      totalPackages: 120,
      totalWeight: 4500.0,
      maxCapacity: 8000,
      fillRate: 56.25,
      estimatedDepartureAt: new Date(now.getTime() - 12 * 86400000),
      actualDepartureAt: new Date(now.getTime() - 12 * 86400000),
      estimatedArrivalAt: new Date(now.getTime() - 1 * 86400000),
      actualArrivalAt: new Date(now.getTime() - 1 * 86400000),
      createdBy: logistics.id,
    },
    {
      code: nextCntCode(),
      shippingRoute: 'ROAD' as const,
      status: 'LOADING' as const,
      origin: 'Kho Quang Chau',
      destination: 'Kho Ha Noi',
      carrier: 'Binh Minh Logistics',
      totalPackages: 12,
      totalWeight: 350.0,
      maxCapacity: 2000,
      fillRate: 17.5,
      estimatedDepartureAt: new Date(now.getTime() + 2 * 86400000),
      createdBy: logistics.id,
    },
    {
      code: nextCntCode(),
      shippingRoute: 'ROAD' as const,
      status: 'PLANNING' as const,
      origin: 'Kho Nghia O',
      destination: 'Kho Ha Noi',
      carrier: null,
      totalPackages: 0,
      totalWeight: 0,
      maxCapacity: 2000,
      createdBy: logistics.id,
    },
    {
      code: nextCntCode(),
      shippingRoute: 'AIR' as const,
      status: 'ARRIVED' as const,
      origin: 'Quang Chau Baiyun Airport',
      destination: 'Noi Bai Airport',
      carrier: 'Vietnam Airlines Cargo',
      bookingRef: 'VN-CARGO-2026-0098',
      totalPackages: 8,
      totalWeight: 85.5,
      maxCapacity: 200,
      fillRate: 42.75,
      estimatedDepartureAt: new Date(now.getTime() - 2 * 86400000),
      actualDepartureAt: new Date(now.getTime() - 2 * 86400000),
      estimatedArrivalAt: new Date(now.getTime() - 1 * 86400000),
      actualArrivalAt: new Date(now.getTime() - 1 * 86400000),
      createdBy: logistics.id,
    },
  ];

  const containers: any[] = [];
  for (const c of containerDefs) {
    const existing = await prisma.container.findUnique({ where: { code: c.code } });
    if (existing) {
      containers.push(existing);
    } else {
      const created = await prisma.container.create({ data: c });
      containers.push(created);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. ORDERS (25 don hang da dang trang thai)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Orders...');

  interface OrderDef {
    code: string;
    customerId: string;
    saleId: string;
    serviceType: 'VCT' | 'MHH' | 'UTXNK' | 'LCLCN';
    status: string;
    branch: 'HN' | 'HCM';
    totalAmount: number;
    depositRequired: number;
    depositPaid: number;
    isDepositPaid: boolean;
    shippingRoute?: 'SEA' | 'ROAD' | 'AIR';
    containerId?: string;
    note?: string;
    completedAt?: Date;
    cancelReason?: string;
  }

  const orderDefs: OrderDef[] = [
    // --- COMPLETED orders ---
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'COMPLETED', branch: 'HN',
      totalAmount: 8_500_000, depositRequired: 8_500_000, depositPaid: 8_500_000,
      isDepositPaid: true, shippingRoute: 'ROAD', containerId: containers[0]?.id,
      note: 'Hang dien tu - laptop Dell va phu kien', completedAt: new Date(now.getTime() - 10 * 86400000),
    },
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale02.id,
      serviceType: 'MHH', status: 'COMPLETED', branch: 'HN',
      totalAmount: 32_000_000, depositRequired: 22_400_000, depositPaid: 32_000_000,
      isDepositPaid: true, shippingRoute: 'ROAD', containerId: containers[0]?.id,
      note: 'Mua ho quan ao thu dong 500 bo', completedAt: new Date(now.getTime() - 8 * 86400000),
    },
    {
      code: nextOrderCode(), customerId: customers[2].id, saleId: sale03.id,
      serviceType: 'VCT', status: 'COMPLETED', branch: 'HCM',
      totalAmount: 120_000_000, depositRequired: 60_000_000, depositPaid: 120_000_000,
      isDepositPaid: true, shippingRoute: 'SEA', containerId: containers[0]?.id,
      note: 'Van chuyen noi that van phong - 2 container', completedAt: new Date(now.getTime() - 5 * 86400000),
    },

    // --- IN_TRANSIT orders ---
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'IN_TRANSIT', branch: 'HN',
      totalAmount: 12_500_000, depositRequired: 12_500_000, depositPaid: 12_500_000,
      isDepositPaid: true, shippingRoute: 'ROAD', containerId: containers[1]?.id,
      note: 'Linh kien dien tu - chip, board mach',
    },
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale02.id,
      serviceType: 'MHH', status: 'IN_TRANSIT', branch: 'HN',
      totalAmount: 18_000_000, depositRequired: 12_600_000, depositPaid: 12_600_000,
      isDepositPaid: true, shippingRoute: 'ROAD', containerId: containers[1]?.id,
      note: 'Mua ho giay dep xuat khau 200 doi',
    },

    // --- CUSTOMS orders ---
    {
      code: nextOrderCode(), customerId: customers[2].id, saleId: sale03.id,
      serviceType: 'LCLCN', status: 'CUSTOMS', branch: 'HCM',
      totalAmount: 85_000_000, depositRequired: 42_500_000, depositPaid: 42_500_000,
      isDepositPaid: true, shippingRoute: 'SEA', containerId: containers[2]?.id,
      note: 'LCL chinh ngach - may moc cong nghiep',
    },
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'CUSTOMS', branch: 'HN',
      totalAmount: 5_200_000, depositRequired: 5_200_000, depositPaid: 5_200_000,
      isDepositPaid: true, shippingRoute: 'AIR', containerId: containers[5]?.id,
      note: 'Hang mau gap - linh kien dien thoai',
    },

    // --- WAREHOUSE_VN ---
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'WAREHOUSE_VN', branch: 'HN',
      totalAmount: 6_800_000, depositRequired: 4_760_000, depositPaid: 4_760_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Do gia dung - noi com, binh nuoc nong',
    },

    // --- DELIVERING ---
    {
      code: nextOrderCode(), customerId: customers[2].id, saleId: sale03.id,
      serviceType: 'VCT', status: 'DELIVERING', branch: 'HCM',
      totalAmount: 15_600_000, depositRequired: 7_800_000, depositPaid: 7_800_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Van phong pham va do dung hoc tap',
    },

    // --- WAREHOUSE_CN ---
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'WAREHOUSE_CN', branch: 'HN',
      totalAmount: 9_200_000, depositRequired: 9_200_000, depositPaid: 9_200_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Phu kien dien thoai - op lung, cap sac',
    },
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale02.id,
      serviceType: 'MHH', status: 'WAREHOUSE_CN', branch: 'HN',
      totalAmount: 25_000_000, depositRequired: 17_500_000, depositPaid: 17_500_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Mua ho my pham Han Quoc 150 hop',
    },

    // --- PACKING ---
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'PACKING', branch: 'HN',
      totalAmount: 4_500_000, depositRequired: 4_500_000, depositPaid: 4_500_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Do choi tre em - lot 3',
    },

    // --- CONSOLIDATION ---
    {
      code: nextOrderCode(), customerId: customers[2].id, saleId: sale03.id,
      serviceType: 'VCT', status: 'CONSOLIDATION', branch: 'HCM',
      totalAmount: 22_000_000, depositRequired: 11_000_000, depositPaid: 11_000_000,
      isDepositPaid: true, shippingRoute: 'ROAD', containerId: containers[3]?.id,
      note: 'Hang tap hoa tong hop',
    },

    // --- SOURCING (MHH) ---
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale02.id,
      serviceType: 'MHH', status: 'SOURCING', branch: 'HN',
      totalAmount: 55_000_000, depositRequired: 38_500_000, depositPaid: 38_500_000,
      isDepositPaid: true,
      note: 'Mua ho do noi that - ban ghe go, tu ke',
    },

    // --- PENDING_DEPOSIT ---
    {
      code: nextOrderCode(), customerId: customers[3]?.id ?? customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'PENDING_DEPOSIT', branch: 'HN',
      totalAmount: 7_300_000, depositRequired: 7_300_000, depositPaid: 0,
      isDepositPaid: false, shippingRoute: 'ROAD',
      note: 'Hang thoi trang nu - vay, dam',
    },
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'MHH', status: 'PENDING_DEPOSIT', branch: 'HN',
      totalAmount: 13_200_000, depositRequired: 13_200_000, depositPaid: 0,
      isDepositPaid: false,
      note: 'Mua ho linh kien PC - VGA, RAM, SSD',
    },

    // --- QUOTATION ---
    {
      code: nextOrderCode(), customerId: customers[2].id, saleId: sale03.id,
      serviceType: 'UTXNK', status: 'QUOTATION', branch: 'HCM',
      totalAmount: 250_000_000, depositRequired: 75_000_000, depositPaid: 0,
      isDepositPaid: false,
      note: 'Uy thac nhap khau may CNC tu Quang Dong',
    },

    // --- CONSULTING ---
    {
      code: nextOrderCode(), customerId: customers[3]?.id ?? customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'CONSULTING', branch: 'HN',
      totalAmount: 0, depositRequired: 0, depositPaid: 0, isDepositPaid: false,
      note: 'Tu van van chuyen hang sieu truong sieu trong',
    },
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'MHH', status: 'CONSULTING', branch: 'HN',
      totalAmount: 0, depositRequired: 0, depositPaid: 0, isDepositPaid: false,
      note: 'Tu van mua ho hang nuoc hoa chinh hang',
    },

    // --- SETTLEMENT ---
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale02.id,
      serviceType: 'VCT', status: 'SETTLEMENT', branch: 'HN',
      totalAmount: 11_500_000, depositRequired: 8_050_000, depositPaid: 8_050_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Quyet toan - hang den tu Nghia O',
    },

    // --- ON_HOLD ---
    {
      code: nextOrderCode(), customerId: customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'ON_HOLD', branch: 'HN',
      totalAmount: 3_800_000, depositRequired: 3_800_000, depositPaid: 3_800_000,
      isDepositPaid: true, shippingRoute: 'ROAD',
      note: 'Tam giu - cho xac nhan lai dia chi giao hang',
    },

    // --- CANCELLED ---
    {
      code: nextOrderCode(), customerId: customers[3]?.id ?? customers[0].id, saleId: sale01.id,
      serviceType: 'VCT', status: 'CANCELLED', branch: 'HN',
      totalAmount: 2_100_000, depositRequired: 2_100_000, depositPaid: 0,
      isDepositPaid: false,
      note: 'Khach huy - thay doi ke hoach',
      cancelReason: 'Khach hang thay doi ke hoach kinh doanh',
    },

    // More MHH orders
    {
      code: nextOrderCode(), customerId: customers[2].id, saleId: sale03.id,
      serviceType: 'MHH', status: 'WAREHOUSE_CN', branch: 'HCM',
      totalAmount: 42_000_000, depositRequired: 21_000_000, depositPaid: 21_000_000,
      isDepositPaid: true,
      note: 'Mua ho hang dien tu gia dung - 50 cai may hut bui',
    },

    // Extra VCT for variety
    {
      code: nextOrderCode(), customerId: customers[1].id, saleId: sale02.id,
      serviceType: 'VCT', status: 'IN_TRANSIT', branch: 'HN',
      totalAmount: 7_600_000, depositRequired: 5_320_000, depositPaid: 5_320_000,
      isDepositPaid: true, shippingRoute: 'ROAD', containerId: containers[1]?.id,
      note: 'Bao bi thuc pham - hop nhua, tui zip',
    },
  ];

  const orders: any[] = [];
  for (const o of orderDefs) {
    const existing = await prisma.order.findUnique({ where: { code: o.code } });
    if (existing) {
      orders.push(existing);
    } else {
      const { cancelReason, ...rest } = o as any;
      const created = await prisma.order.create({
        data: {
          ...rest,
          cancelReason,
          currency: 'VND',
        },
      });
      orders.push(created);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. ORDER ITEMS
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Order items...');

  const itemDefs: { orderId: string; items: { productName: string; quantity: number; unitPrice: number; currency?: string; productUrl?: string }[] }[] = [
    {
      orderId: orders[0]?.id,
      items: [
        { productName: 'Laptop Dell Inspiron 15 3520', quantity: 5, unitPrice: 3800, currency: 'CNY', productUrl: 'https://1688.com/item/dell-3520' },
        { productName: 'Chuot Logitech MX Master 3S', quantity: 10, unitPrice: 280, currency: 'CNY' },
        { productName: 'Ban phim co Keychron K2', quantity: 8, unitPrice: 350, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[1]?.id,
      items: [
        { productName: 'Ao khoac nam thu dong - mau den', quantity: 200, unitPrice: 85, currency: 'CNY', productUrl: 'https://taobao.com/item/ao-khoac-nam' },
        { productName: 'Ao khoac nu thu dong - mau be', quantity: 150, unitPrice: 90, currency: 'CNY' },
        { productName: 'Quan jeans nam slim fit', quantity: 150, unitPrice: 65, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[2]?.id,
      items: [
        { productName: 'Ban lam viec go cong nghiep 1.2m', quantity: 50, unitPrice: 450, currency: 'CNY' },
        { productName: 'Ghe xoay van phong luoi', quantity: 80, unitPrice: 380, currency: 'CNY' },
        { productName: 'Tu ho so 3 ngan', quantity: 30, unitPrice: 520, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[3]?.id,
      items: [
        { productName: 'IC chip STM32F103C8T6', quantity: 500, unitPrice: 12, currency: 'CNY' },
        { productName: 'Board mach Arduino Mega 2560', quantity: 100, unitPrice: 45, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[4]?.id,
      items: [
        { productName: 'Giay the thao nam Xiaomi', quantity: 100, unitPrice: 120, currency: 'CNY' },
        { productName: 'Dep sandal nu mua he', quantity: 100, unitPrice: 55, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[5]?.id,
      items: [
        { productName: 'May cat CNC mini 3040', quantity: 2, unitPrice: 12000, currency: 'CNY' },
        { productName: 'Bo phu tung thay the CNC', quantity: 5, unitPrice: 800, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[9]?.id,
      items: [
        { productName: 'Op lung iPhone 15 Pro Max silicon', quantity: 500, unitPrice: 8, currency: 'CNY' },
        { productName: 'Cap sac USB-C 1m', quantity: 300, unitPrice: 5, currency: 'CNY' },
        { productName: 'Kinh cuong luc iPhone 15', quantity: 500, unitPrice: 3, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[10]?.id,
      items: [
        { productName: 'Son moi MAC Ruby Woo', quantity: 50, unitPrice: 65, currency: 'CNY' },
        { productName: 'Kem duong da SK-II 75ml', quantity: 30, unitPrice: 280, currency: 'CNY' },
        { productName: 'Nuoc hoa Dior Sauvage 100ml', quantity: 20, unitPrice: 350, currency: 'CNY' },
        { productName: 'Sua rua mat Cerave 355ml', quantity: 50, unitPrice: 45, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[13]?.id,
      items: [
        { productName: 'Ban ghe go huong - bo phong khach', quantity: 2, unitPrice: 5500, currency: 'CNY' },
        { productName: 'Tu ke sach go oc cho 5 tang', quantity: 4, unitPrice: 1800, currency: 'CNY' },
        { productName: 'Ke tivi go tu nhien 1.8m', quantity: 3, unitPrice: 2200, currency: 'CNY' },
      ],
    },
    {
      orderId: orders[22]?.id,
      items: [
        { productName: 'May hut bui robot Xiaomi', quantity: 50, unitPrice: 850, currency: 'CNY', productUrl: 'https://1688.com/item/xiaomi-vacuum' },
      ],
    },
  ];

  for (const def of itemDefs) {
    if (!def.orderId) continue;
    const existingItems = await prisma.orderItem.count({ where: { orderId: def.orderId } });
    if (existingItems > 0) continue;

    for (const item of def.items) {
      await prisma.orderItem.create({
        data: {
          orderId: def.orderId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currency: (item.currency as any) ?? 'CNY',
          totalPrice: item.quantity * item.unitPrice,
          productUrl: item.productUrl,
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. PACKAGES (kien hang)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Packages...');

  interface PkgDef {
    code: string;
    orderId: string;
    trackingNumberCN?: string;
    description?: string;
    actualWeight?: number;
    length?: number;
    width?: number;
    height?: number;
    volumetricWeight?: number;
    chargeableWeight?: number;
    warehouseCNStatus?: string;
    warehouseVNStatus?: string;
    containerId?: string;
    receivedCNAt?: Date;
    receivedCNBy?: string;
    packedAt?: Date;
    receivedVNAt?: Date;
    receivedVNBy?: string;
    deliveredAt?: Date;
  }

  const pkgDefs: PkgDef[] = [
    // Completed order packages (container[0])
    { code: nextPkgCode(), orderId: orders[0]?.id, trackingNumberCN: 'SF1234567890', description: 'Laptop Dell 5 cai', actualWeight: 18.5, length: 60, width: 45, height: 35, volumetricWeight: 18.9, chargeableWeight: 18.9, warehouseCNStatus: 'SHIPPED', warehouseVNStatus: 'DELIVERED', containerId: containers[0]?.id, receivedCNAt: new Date(now.getTime() - 25 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 23 * 86400000), receivedVNAt: new Date(now.getTime() - 14 * 86400000), receivedVNBy: khovn01.id, deliveredAt: new Date(now.getTime() - 10 * 86400000) },
    { code: nextPkgCode(), orderId: orders[0]?.id, trackingNumberCN: 'SF1234567891', description: 'Chuot va ban phim', actualWeight: 5.2, length: 40, width: 30, height: 25, volumetricWeight: 6.0, chargeableWeight: 6.0, warehouseCNStatus: 'SHIPPED', warehouseVNStatus: 'DELIVERED', containerId: containers[0]?.id, receivedCNAt: new Date(now.getTime() - 25 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 23 * 86400000), receivedVNAt: new Date(now.getTime() - 14 * 86400000), receivedVNBy: khovn01.id, deliveredAt: new Date(now.getTime() - 10 * 86400000) },
    { code: nextPkgCode(), orderId: orders[1]?.id, trackingNumberCN: 'YT9876543210', description: 'Ao khoac nam 200 cai', actualWeight: 85.0, length: 80, width: 60, height: 50, volumetricWeight: 48.0, chargeableWeight: 85.0, warehouseCNStatus: 'SHIPPED', warehouseVNStatus: 'DELIVERED', containerId: containers[0]?.id, receivedCNAt: new Date(now.getTime() - 24 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 22 * 86400000), receivedVNAt: new Date(now.getTime() - 14 * 86400000), receivedVNBy: khovn01.id, deliveredAt: new Date(now.getTime() - 8 * 86400000) },
    { code: nextPkgCode(), orderId: orders[1]?.id, trackingNumberCN: 'YT9876543211', description: 'Ao khoac nu + quan jeans', actualWeight: 65.0, length: 70, width: 55, height: 45, volumetricWeight: 34.65, chargeableWeight: 65.0, warehouseCNStatus: 'SHIPPED', warehouseVNStatus: 'DELIVERED', containerId: containers[0]?.id, receivedCNAt: new Date(now.getTime() - 24 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 22 * 86400000), receivedVNAt: new Date(now.getTime() - 14 * 86400000), receivedVNBy: khovn01.id, deliveredAt: new Date(now.getTime() - 8 * 86400000) },

    // In transit packages (container[1])
    { code: nextPkgCode(), orderId: orders[3]?.id, trackingNumberCN: 'ZTO111222333', description: 'Chip STM32 500 cai', actualWeight: 3.5, length: 30, width: 25, height: 15, volumetricWeight: 2.25, chargeableWeight: 3.5, warehouseCNStatus: 'SHIPPED', containerId: containers[1]?.id, receivedCNAt: new Date(now.getTime() - 8 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 5 * 86400000) },
    { code: nextPkgCode(), orderId: orders[3]?.id, trackingNumberCN: 'ZTO111222334', description: 'Arduino board 100 cai', actualWeight: 8.2, length: 45, width: 35, height: 20, volumetricWeight: 6.3, chargeableWeight: 8.2, warehouseCNStatus: 'SHIPPED', containerId: containers[1]?.id, receivedCNAt: new Date(now.getTime() - 8 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 5 * 86400000) },
    { code: nextPkgCode(), orderId: orders[4]?.id, trackingNumberCN: 'YD555666777', description: 'Giay the thao 100 doi', actualWeight: 42.0, length: 65, width: 50, height: 40, volumetricWeight: 26.0, chargeableWeight: 42.0, warehouseCNStatus: 'SHIPPED', containerId: containers[1]?.id, receivedCNAt: new Date(now.getTime() - 7 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 5 * 86400000) },

    // Warehouse CN packages
    { code: nextPkgCode(), orderId: orders[9]?.id, trackingNumberCN: 'JD888999000', description: 'Op lung iPhone 500 cai', actualWeight: 12.5, length: 50, width: 40, height: 30, volumetricWeight: 12.0, chargeableWeight: 12.5, warehouseCNStatus: 'RECEIVED', receivedCNAt: new Date(now.getTime() - 2 * 86400000), receivedCNBy: khotq01.id },
    { code: nextPkgCode(), orderId: orders[9]?.id, trackingNumberCN: 'JD888999001', description: 'Cap sac + kinh cuong luc', actualWeight: 8.0, length: 40, width: 30, height: 25, volumetricWeight: 6.0, chargeableWeight: 8.0, warehouseCNStatus: 'CHECKED', receivedCNAt: new Date(now.getTime() - 2 * 86400000), receivedCNBy: khotq01.id },
    { code: nextPkgCode(), orderId: orders[10]?.id, trackingNumberCN: 'SF222333444', description: 'My pham tong hop', actualWeight: 15.0, length: 45, width: 35, height: 30, volumetricWeight: 9.45, chargeableWeight: 15.0, warehouseCNStatus: 'RECEIVED', receivedCNAt: new Date(now.getTime() - 1 * 86400000), receivedCNBy: khotq01.id },

    // Warehouse VN packages
    { code: nextPkgCode(), orderId: orders[7]?.id, trackingNumberCN: 'YT444555666', description: 'Noi com dien + binh nuoc nong', actualWeight: 22.0, length: 55, width: 45, height: 35, volumetricWeight: 17.33, chargeableWeight: 22.0, warehouseCNStatus: 'SHIPPED', warehouseVNStatus: 'RECEIVED', containerId: containers[0]?.id, receivedCNAt: new Date(now.getTime() - 22 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 20 * 86400000), receivedVNAt: new Date(now.getTime() - 14 * 86400000), receivedVNBy: khovn01.id },

    // Packing status
    { code: nextPkgCode(), orderId: orders[11]?.id, trackingNumberCN: 'SF333444555', description: 'Do choi tre em lot 3', actualWeight: 18.5, length: 60, width: 45, height: 40, volumetricWeight: 21.6, chargeableWeight: 21.6, warehouseCNStatus: 'PACKED', receivedCNAt: new Date(now.getTime() - 5 * 86400000), receivedCNBy: khotq01.id, packedAt: new Date(now.getTime() - 1 * 86400000) },

    // MHH order packages
    { code: nextPkgCode(), orderId: orders[22]?.id, trackingNumberCN: 'ZTO999888777', description: 'May hut bui Xiaomi 50 cai', actualWeight: 125.0, length: 90, width: 70, height: 80, volumetricWeight: 100.8, chargeableWeight: 125.0, warehouseCNStatus: 'RECEIVED', receivedCNAt: new Date(now.getTime() - 1 * 86400000), receivedCNBy: khotq01.id },
  ];

  const packages: any[] = [];
  for (const p of pkgDefs) {
    if (!p.orderId) continue;
    const existing = await prisma.package.findUnique({ where: { code: p.code } });
    if (existing) {
      packages.push(existing);
    } else {
      const created = await prisma.package.create({ data: p as any });
      packages.push(created);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. SUPPLIER ORDERS (cho MHH)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Supplier orders...');

  const soDefs = [
    {
      code: nextSOCode(),
      orderId: orders[1]?.id,
      vendorId: vendors[0]?.id ?? null,
      supplierName: 'Guangzhou YiDa Trading',
      supplierPlatform: 'TAOBAO',
      supplierOrderNumber: 'TB-20260301-88421',
      status: 'RECEIVED_CN' as const,
      quotedPriceCNY: 28500,
      actualPriceCNY: 27800,
      shippingFeeCNY: 350,
      totalCNY: 28150,
      quantityOrdered: 500,
      quantityReceived: 500,
      orderedAt: new Date(now.getTime() - 30 * 86400000),
      confirmedAt: new Date(now.getTime() - 29 * 86400000),
      shippedAt: new Date(now.getTime() - 26 * 86400000),
      receivedAt: new Date(now.getTime() - 24 * 86400000),
      createdBy: sale02.id,
    },
    {
      code: nextSOCode(),
      orderId: orders[4]?.id,
      vendorId: vendors[2]?.id ?? null,
      supplierName: 'Yiwu MingFeng Commodity',
      supplierPlatform: '1688',
      supplierOrderNumber: '1688-20260228-12055',
      status: 'SHIPPED_CN' as const,
      quotedPriceCNY: 17500,
      actualPriceCNY: 17200,
      shippingFeeCNY: 280,
      totalCNY: 17480,
      quantityOrdered: 200,
      quantityReceived: 0,
      orderedAt: new Date(now.getTime() - 12 * 86400000),
      confirmedAt: new Date(now.getTime() - 11 * 86400000),
      shippedAt: new Date(now.getTime() - 8 * 86400000),
      createdBy: sale02.id,
    },
    {
      code: nextSOCode(),
      orderId: orders[10]?.id,
      vendorId: vendors[1]?.id ?? null,
      supplierName: 'Shenzhen HuaXin Electronics',
      supplierPlatform: 'PINDUODUO',
      status: 'RECEIVED_CN' as const,
      quotedPriceCNY: 20500,
      actualPriceCNY: 20000,
      shippingFeeCNY: 200,
      totalCNY: 20200,
      quantityOrdered: 150,
      quantityReceived: 150,
      orderedAt: new Date(now.getTime() - 8 * 86400000),
      confirmedAt: new Date(now.getTime() - 7 * 86400000),
      shippedAt: new Date(now.getTime() - 4 * 86400000),
      receivedAt: new Date(now.getTime() - 1 * 86400000),
      createdBy: sale02.id,
    },
    {
      code: nextSOCode(),
      orderId: orders[13]?.id,
      vendorId: vendors[3]?.id ?? null,
      supplierName: 'Foshan JiaHe Furniture',
      supplierPlatform: '1688',
      status: 'ORDERED' as const,
      quotedPriceCNY: 45000,
      actualPriceCNY: null,
      quantityOrdered: 9,
      quantityReceived: 0,
      orderedAt: new Date(now.getTime() - 3 * 86400000),
      createdBy: sale02.id,
    },
    {
      code: nextSOCode(),
      orderId: orders[22]?.id,
      vendorId: vendors[0]?.id ?? null,
      supplierName: 'Guangzhou YiDa Trading',
      supplierPlatform: '1688',
      supplierOrderNumber: '1688-20260302-50001',
      status: 'RECEIVED_CN' as const,
      quotedPriceCNY: 42500,
      actualPriceCNY: 41000,
      shippingFeeCNY: 500,
      totalCNY: 41500,
      quantityOrdered: 50,
      quantityReceived: 50,
      orderedAt: new Date(now.getTime() - 10 * 86400000),
      confirmedAt: new Date(now.getTime() - 9 * 86400000),
      shippedAt: new Date(now.getTime() - 5 * 86400000),
      receivedAt: new Date(now.getTime() - 1 * 86400000),
      createdBy: sale03.id,
    },
  ];

  for (const so of soDefs) {
    if (!so.orderId) continue;
    const existing = await prisma.supplierOrder.findUnique({ where: { code: so.code } });
    if (!existing) {
      await prisma.supplierOrder.create({ data: so as any });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 7. DELIVERIES
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Deliveries...');

  const delDefs = [
    {
      code: nextDelCode(),
      orderId: orders[0]?.id,
      driverId: drivers[0]?.id ?? null,
      vehicleId: vehicles[0]?.id ?? null,
      branch: 'HN' as const,
      recipientName: 'Nguyen Van An',
      recipientPhone: '0912345001',
      deliveryAddress: '88 Tran Hung Dao, Hoan Kiem, Ha Noi',
      status: 'DELIVERED' as const,
      scheduledAt: new Date(now.getTime() - 11 * 86400000),
      deliveredAt: new Date(now.getTime() - 10 * 86400000),
      codAmount: 0,
    },
    {
      code: nextDelCode(),
      orderId: orders[1]?.id,
      driverId: drivers[0]?.id ?? null,
      vehicleId: vehicles[0]?.id ?? null,
      branch: 'HN' as const,
      recipientName: 'Tran Thi Binh',
      recipientPhone: '0912345002',
      deliveryAddress: '156 Nguyen Thai Hoc, Ba Dinh, Ha Noi',
      status: 'DELIVERED' as const,
      scheduledAt: new Date(now.getTime() - 9 * 86400000),
      deliveredAt: new Date(now.getTime() - 8 * 86400000),
      codAmount: 9_600_000,
      codCollected: true,
      codCollectedAt: new Date(now.getTime() - 8 * 86400000),
    },
    {
      code: nextDelCode(),
      orderId: orders[8]?.id,
      driverId: drivers[1]?.id ?? null,
      vehicleId: vehicles[1]?.id ?? null,
      branch: 'HCM' as const,
      recipientName: 'Le Hoang Cuong',
      recipientPhone: '0912345003',
      deliveryAddress: '200 Vo Van Tan, Quan 3, TP.HCM',
      status: 'DELIVERING' as const,
      scheduledAt: new Date(now.getTime() - 1 * 86400000),
      codAmount: 7_800_000,
      codCollected: false,
    },
    {
      code: nextDelCode(),
      orderId: orders[7]?.id,
      branch: 'HN' as const,
      recipientName: 'Tran Thi Binh',
      recipientPhone: '0912345002',
      deliveryAddress: '156 Nguyen Thai Hoc, Ba Dinh, Ha Noi',
      status: 'PENDING' as const,
      scheduledAt: new Date(now.getTime() + 1 * 86400000),
      codAmount: 2_040_000,
    },
  ];

  for (const d of delDefs) {
    if (!d.orderId) continue;
    const existing = await prisma.delivery.findUnique({ where: { code: d.code } });
    if (!existing) {
      await prisma.delivery.create({ data: d as any });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. COMPLAINTS (khieu nai)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Complaints...');

  const complaintDefs = [
    {
      code: nextCmpCode(),
      orderId: orders[0]?.id,
      customerId: customers[0].id,
      type: 'DAMAGE' as const,
      severity: 'MEDIUM' as const,
      status: 'RESOLVED' as const,
      description: 'Hop laptop bi mop goc - Khi nhan hang phat hien 1 hop laptop bi mop goc, may ben trong khong anh huong. Yeu cau boi thuong hop.',
      resolutionType: 'CREDIT' as const,
      compensationAmount: 500_000,
      resolvedAt: new Date(now.getTime() - 7 * 86400000),
      createdBy: sale01.id,
    },
    {
      code: nextCmpCode(),
      orderId: orders[3]?.id,
      customerId: customers[0].id,
      type: 'DELAY' as const,
      severity: 'LOW' as const,
      status: 'OPEN' as const,
      description: 'Don hang cham 2 ngay so voi du kien - Don hang du kien giao ngay 03/03 nhung hien tai 05/03 van chua nhan duoc. Yeu cau cap nhat tinh trang.',
      createdBy: sale01.id,
    },
    {
      code: nextCmpCode(),
      orderId: orders[1]?.id,
      customerId: customers[1].id,
      type: 'QUALITY' as const,
      severity: 'HIGH' as const,
      status: 'INVESTIGATING' as const,
      description: '10 bo ao khoac bi loi duong chi - Trong 200 bo ao khoac nam, phat hien 10 bo bi loi duong chi o vai va tay ao. Yeu cau doi hang hoac giam gia.',
      createdBy: sale02.id,
    },
    {
      code: nextCmpCode(),
      orderId: orders[2]?.id,
      customerId: customers[2].id,
      type: 'MISSING' as const,
      severity: 'HIGH' as const,
      status: 'PENDING_RESOLUTION' as const,
      description: 'Thieu 5 cai ghe xoay trong don hang - Don hang 80 ghe nhung chi nhan duoc 75 cai. Yeu cau giao bo sung 5 ghe con lai.',
      createdBy: sale03.id,
    },
  ];

  for (const c of complaintDefs) {
    if (!c.orderId) continue;
    const existing = await prisma.complaint.findUnique({ where: { code: c.code } });
    if (!existing) {
      await prisma.complaint.create({ data: c as any });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 9. TRACKING EVENTS
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Tracking events...');

  // Add tracking events for completed order packages
  for (let i = 0; i < Math.min(4, packages.length); i++) {
    const pkg = packages[i];
    if (!pkg) continue;

    const existingEvents = await prisma.trackingEvent.count({ where: { packageId: pkg.id } });
    if (existingEvents > 0) continue;

    const baseTime = new Date(now.getTime() - 25 * 86400000);
    const events = [
      { eventType: 'IN_WAREHOUSE_CN' as const, location: 'Kho Quang Chau, Quang Dong, TQ', description: 'Nhan hang tai kho TQ', eventTimestamp: new Date(baseTime.getTime()) },
      { eventType: 'PACKED' as const, location: 'Kho Quang Chau', description: 'Da dong goi, chuan bi xep cont', eventTimestamp: new Date(baseTime.getTime() + 2 * 86400000) },
      { eventType: 'LOADED_CONTAINER' as const, location: 'Kho Quang Chau', description: `Xep vao container ${containers[0]?.code}`, eventTimestamp: new Date(baseTime.getTime() + 3 * 86400000) },
      { eventType: 'DEPARTED_CN' as const, location: 'Cua khau Huu Nghi', description: 'Xe xuat phat tu TQ', eventTimestamp: new Date(baseTime.getTime() + 5 * 86400000) },
      { eventType: 'IN_TRANSIT' as const, location: 'Dang van chuyen', description: 'Dang tren duong ve VN', eventTimestamp: new Date(baseTime.getTime() + 7 * 86400000) },
      { eventType: 'ARRIVED_PORT' as const, location: 'Cua khau Huu Nghi, Lang Son', description: 'Da den cua khau', eventTimestamp: new Date(baseTime.getTime() + 9 * 86400000) },
      { eventType: 'CUSTOMS_CLEARANCE' as const, location: 'Hai quan Lang Son', description: 'Da thong quan', eventTimestamp: new Date(baseTime.getTime() + 10 * 86400000) },
      { eventType: 'IN_WAREHOUSE_VN' as const, location: 'Kho Ha Noi', description: 'Da nhap kho VN', eventTimestamp: new Date(baseTime.getTime() + 11 * 86400000) },
      { eventType: 'OUT_FOR_DELIVERY' as const, location: 'Ha Noi', description: 'Dang giao hang', eventTimestamp: new Date(baseTime.getTime() + 14 * 86400000) },
      { eventType: 'DELIVERED' as const, location: 'Ha Noi', description: 'Da giao thanh cong', eventTimestamp: new Date(baseTime.getTime() + 15 * 86400000) },
    ];

    for (const ev of events) {
      await prisma.trackingEvent.create({
        data: {
          packageId: pkg.id,
          containerId: containers[0]?.id,
          ...ev,
          source: 'MANUAL',
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 10. ACCOUNTS RECEIVABLE (cong no phai thu)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Accounts receivable...');

  let arSeq = 1;
  const nextARCode = () => `TBS-AR-${String(arSeq++).padStart(6, '0')}`;

  const arDefs = [
    {
      code: nextARCode(),
      orderId: orders[0]?.id,
      customerId: customers[0].id,
      amount: 8_500_000,
      paidAmount: 8_500_000,
      currency: 'VND' as const,
      status: 'PAID' as const,
      dueDate: new Date(now.getTime() - 5 * 86400000),
      createdBy: ketoan.id,
    },
    {
      code: nextARCode(),
      orderId: orders[1]?.id,
      customerId: customers[1].id,
      amount: 32_000_000,
      paidAmount: 22_400_000,
      currency: 'VND' as const,
      status: 'PARTIAL' as const,
      dueDate: new Date(now.getTime() - 3 * 86400000),
      createdBy: ketoan.id,
    },
    {
      code: nextARCode(),
      orderId: orders[2]?.id,
      customerId: customers[2].id,
      amount: 120_000_000,
      paidAmount: 120_000_000,
      currency: 'VND' as const,
      status: 'PAID' as const,
      dueDate: new Date(now.getTime() + 15 * 86400000),
      createdBy: ketoan.id,
    },
    {
      code: nextARCode(),
      orderId: orders[3]?.id,
      customerId: customers[0].id,
      amount: 12_500_000,
      paidAmount: 12_500_000,
      currency: 'VND' as const,
      status: 'PAID' as const,
      dueDate: new Date(now.getTime() + 10 * 86400000),
      createdBy: ketoan.id,
    },
    {
      code: nextARCode(),
      orderId: orders[7]?.id,
      customerId: customers[1].id,
      amount: 6_800_000,
      paidAmount: 4_760_000,
      currency: 'VND' as const,
      status: 'PARTIAL' as const,
      dueDate: new Date(now.getTime() + 7 * 86400000),
      createdBy: ketoan.id,
    },
    {
      code: nextARCode(),
      orderId: orders[19]?.id,
      customerId: customers[1].id,
      amount: 11_500_000,
      paidAmount: 8_050_000,
      currency: 'VND' as const,
      status: 'PARTIAL' as const,
      dueDate: new Date(now.getTime() + 5 * 86400000),
      createdBy: ketoan.id,
    },
    {
      code: nextARCode(),
      orderId: orders[5]?.id,
      customerId: customers[2].id,
      amount: 85_000_000,
      paidAmount: 42_500_000,
      currency: 'VND' as const,
      status: 'PARTIAL' as const,
      dueDate: new Date(now.getTime() + 20 * 86400000),
      createdBy: ketoan.id,
    },
  ];

  for (const ar of arDefs) {
    if (!ar.orderId) continue;
    const existing = await prisma.accountReceivable.findUnique({
      where: { code: ar.code },
    });
    if (!existing) {
      await prisma.accountReceivable.create({ data: ar as any });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 11. NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Notifications...');

  const notifDefs = [
    { userId: sale01.id, title: 'Don hang moi tu khach VIP', body: `Khach hang ${customers[2]?.fullName ?? 'Le Hoang Cuong'} vua tao don hang moi. Vui long lien he tu van.`, type: 'ORDER' as const, priority: 'HIGH' as const },
    { userId: sale01.id, title: 'Don hang can quyet toan', body: `Don ${orders[19]?.code ?? 'TBS-ORD-xxx'} da giao xong, can quyet toan cong no con lai 3,450,000 VND.`, type: 'FINANCE' as const, priority: 'NORMAL' as const },
    { userId: khovn.id, title: 'Container sap ve kho', body: `Container ${containers[1]?.code ?? 'TBS-xxx'} du kien ve kho Ha Noi trong 2 ngay toi.`, type: 'WAREHOUSE' as const, priority: 'NORMAL' as const },
    { userId: xnk.id, title: 'Can xu ly thong quan', body: `Container ${containers[2]?.code ?? 'TBS-xxx'} da cap cang, can lam thu tuc thong quan.`, type: 'WAREHOUSE' as const, priority: 'HIGH' as const },
    { userId: ketoan.id, title: 'Cong no qua han', body: `Khach hang ${customers[1]?.fullName ?? 'Tran Thi Binh'} co cong no 9,600,000 VND da qua han 3 ngay.`, type: 'FINANCE' as const, priority: 'HIGH' as const },
    { userId: sale02.id, title: 'Khieu nai moi tu khach hang', body: `Khach ${customers[1]?.fullName ?? 'Tran Thi Binh'} khieu nai ve chat luong ao khoac. Can xu ly gap.`, type: 'ORDER' as const, priority: 'HIGH' as const },
    { userId: logistics.id, title: 'Container da xuat phat', body: `Container ${containers[1]?.code ?? 'TBS-xxx'} da xuat phat tu Nghia O, du kien 5 ngay toi ve Ha Noi.`, type: 'WAREHOUSE' as const, priority: 'NORMAL' as const },
    { userId: sale01.id, title: 'Bao gia het han', body: `Bao gia ${quotations[4]?.code ?? 'QUO-xxx'} da het han hieu luc. Can lien he khach de gia han hoac tao bao gia moi.`, type: 'ORDER' as const, priority: 'NORMAL' as const },
  ];

  for (const n of notifDefs) {
    await prisma.notification.create({
      data: {
        ...n,
        isRead: Math.random() > 0.5,
        channel: 'APP_PUSH',
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 12. WALLET TOPUP (nap vi cho mot so khach hang)
  // ══════════════════════════════════════════════════════════════════
  console.log('    -> Wallet topups...');

  for (const c of customers) {
    if (!c.wallet) continue;
    const topupAmounts: Record<string, number> = {
      [customers[0]?.id]: 10_000_000,
      [customers[1]?.id]: 25_000_000,
      [customers[2]?.id]: 100_000_000,
    };
    const amount = topupAmounts[c.id];
    if (amount && Number(c.wallet.balance) === 0) {
      await prisma.wallet.update({
        where: { id: c.wallet.id },
        data: { balance: amount },
      });
      await prisma.walletTransaction.create({
        data: {
          walletId: c.wallet.id,
          type: 'TOPUP',
          amount,
          reference: `BT-${ym}-${c.code}`,
          note: `Nap vi qua chuyen khoan ngan hang`,
        },
      });
    }
  }

  console.log('  -> Realistic data seeded successfully!');
  console.log(`     - ${quotations.length} bao gia`);
  console.log(`     - ${containers.length} containers`);
  console.log(`     - ${orders.length} don hang`);
  console.log(`     - ${packages.length} kien hang`);
  console.log(`     - ${soDefs.length} don NCC`);
  console.log(`     - ${delDefs.length} phieu giao hang`);
  console.log(`     - ${complaintDefs.length} khieu nai`);
  console.log(`     - ${arDefs.length} cong no phai thu`);
  console.log(`     - ${notifDefs.length} thong bao`);
}
