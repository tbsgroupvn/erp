import { PrismaClient, OrderStatus } from '@prisma/client';

const PENALTY_CONFIGS = [
  {
    stage: OrderStatus.IN_TRANSIT,
    label: 'Vận chuyển',
    penaltyPercent: 10,
    reverseShippingPercent: 5,
  },
  {
    stage: OrderStatus.CUSTOMS,
    label: 'Thông quan',
    penaltyPercent: 15,
    reverseShippingPercent: 8,
  },
  {
    stage: OrderStatus.WAREHOUSE_VN,
    label: 'Nhập kho VN',
    penaltyPercent: 15,
    reverseShippingPercent: 8,
  },
  {
    stage: OrderStatus.DELIVERING,
    label: 'Giao hàng',
    penaltyPercent: 20,
    reverseShippingPercent: 10,
  },
  {
    stage: OrderStatus.SETTLEMENT,
    label: 'Quyết toán',
    penaltyPercent: 25,
    reverseShippingPercent: 10,
  },
];

export async function seedCancelPenaltyConfig(prisma: PrismaClient) {
  console.log('  Seeding cancel penalty configs...');

  for (const config of PENALTY_CONFIGS) {
    await prisma.cancelPenaltyConfig.upsert({
      where: { stage: config.stage },
      update: {
        label: config.label,
        penaltyPercent: config.penaltyPercent,
        reverseShippingPercent: config.reverseShippingPercent,
      },
      create: {
        stage: config.stage,
        label: config.label,
        penaltyPercent: config.penaltyPercent,
        reverseShippingPercent: config.reverseShippingPercent,
        isActive: true,
      },
    });
  }

  console.log(`  => ${PENALTY_CONFIGS.length} cancel penalty configs seeded`);
}
