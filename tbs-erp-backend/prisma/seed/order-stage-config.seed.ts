import { PrismaClient, OrderStatus, UserRole } from '@prisma/client';

const STAGE_CONFIGS: {
  stage: OrderStatus;
  departmentCode: string;
  primaryRoles: UserRole[];
  slaHours: number;
  slaWarningHours: number | null;
  taskTitle: string;
  sortOrder: number;
}[] = [
  {
    stage: OrderStatus.CONSULTING,
    departmentCode: 'SALES',
    primaryRoles: [UserRole.SALE, UserRole.SALES_LEADER],
    slaHours: 2,
    slaWarningHours: 1,
    taskTitle: 'Tu van don {{code}}',
    sortOrder: 1,
  },
  {
    stage: OrderStatus.QUOTATION,
    departmentCode: 'SALES',
    primaryRoles: [UserRole.SALE, UserRole.SALES_LEADER],
    slaHours: 4,
    slaWarningHours: 2,
    taskTitle: 'Bao gia don {{code}}',
    sortOrder: 2,
  },
  {
    stage: OrderStatus.PENDING_DEPOSIT,
    departmentCode: 'FINANCE',
    primaryRoles: [UserRole.ACCOUNTANT_AR],
    slaHours: 72,
    slaWarningHours: 48,
    taskTitle: 'Xac nhan coc don {{code}}',
    sortOrder: 3,
  },
  {
    stage: OrderStatus.SOURCING,
    departmentCode: 'SALES',
    primaryRoles: [UserRole.SALE, UserRole.XNK_MANAGER],
    slaHours: 48,
    slaWarningHours: 24,
    taskTitle: 'Mua hang don {{code}}',
    sortOrder: 4,
  },
  {
    stage: OrderStatus.WAREHOUSE_CN,
    departmentCode: 'WAREHOUSE_CN',
    primaryRoles: [UserRole.WAREHOUSE_CN_AGENT],
    slaHours: 24,
    slaWarningHours: 12,
    taskTitle: 'Nhap kho TQ don {{code}}',
    sortOrder: 5,
  },
  {
    stage: OrderStatus.PACKING,
    departmentCode: 'WAREHOUSE_CN',
    primaryRoles: [UserRole.WAREHOUSE_CN_AGENT],
    slaHours: 12,
    slaWarningHours: 6,
    taskTitle: 'Dong goi don {{code}}',
    sortOrder: 6,
  },
  {
    stage: OrderStatus.CONSOLIDATION,
    departmentCode: 'LOGISTICS',
    primaryRoles: [UserRole.LOGISTICS_MANAGER],
    slaHours: 48,
    slaWarningHours: 24,
    taskTitle: 'Ghep cont don {{code}}',
    sortOrder: 7,
  },
  {
    stage: OrderStatus.IN_TRANSIT,
    departmentCode: 'LOGISTICS',
    primaryRoles: [UserRole.LOGISTICS_MANAGER],
    slaHours: 336,
    slaWarningHours: 240,
    taskTitle: 'Van chuyen don {{code}}',
    sortOrder: 8,
  },
  {
    stage: OrderStatus.CUSTOMS,
    departmentCode: 'XNK',
    primaryRoles: [UserRole.XNK_MANAGER, UserRole.XNK_STAFF],
    slaHours: 72,
    slaWarningHours: 48,
    taskTitle: 'Thong quan don {{code}}',
    sortOrder: 9,
  },
  {
    stage: OrderStatus.WAREHOUSE_VN,
    departmentCode: 'WAREHOUSE_VN',
    primaryRoles: [UserRole.WAREHOUSE_VN_MANAGER],
    slaHours: 24,
    slaWarningHours: 12,
    taskTitle: 'Nhap kho VN don {{code}}',
    sortOrder: 10,
  },
  {
    stage: OrderStatus.DELIVERING,
    departmentCode: 'WAREHOUSE_VN',
    primaryRoles: [UserRole.WAREHOUSE_VN_STAFF, UserRole.DRIVER],
    slaHours: 72,
    slaWarningHours: 48,
    taskTitle: 'Giao hang don {{code}}',
    sortOrder: 11,
  },
  {
    stage: OrderStatus.SETTLEMENT,
    departmentCode: 'FINANCE',
    primaryRoles: [UserRole.ACCOUNTANT_AR, UserRole.CHIEF_ACCOUNTANT],
    slaHours: 48,
    slaWarningHours: 24,
    taskTitle: 'Quyet toan don {{code}}',
    sortOrder: 12,
  },
  {
    stage: OrderStatus.COMPLETED,
    departmentCode: 'SYSTEM',
    primaryRoles: [],
    slaHours: 0,
    slaWarningHours: null,
    taskTitle: '',
    sortOrder: 13,
  },
];

export async function seedOrderStageConfigs(prisma: PrismaClient) {
  console.log('  Seeding order stage configs...');

  for (const config of STAGE_CONFIGS) {
    await prisma.orderStageConfig.upsert({
      where: { stage: config.stage },
      update: {
        departmentCode: config.departmentCode,
        primaryRoles: config.primaryRoles,
        slaHours: config.slaHours,
        slaWarningHours: config.slaWarningHours,
        taskTitle: config.taskTitle,
        sortOrder: config.sortOrder,
      },
      create: {
        stage: config.stage,
        departmentCode: config.departmentCode,
        primaryRoles: config.primaryRoles,
        slaHours: config.slaHours,
        slaWarningHours: config.slaWarningHours,
        taskTitle: config.taskTitle,
        sortOrder: config.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`  => ${STAGE_CONFIGS.length} order stage configs seeded`);
}
