import { PrismaClient } from '@prisma/client';

/**
 * Seeds 14 commission rule brackets across 4 service types.
 * Uses count-guard for idempotency (CommissionRule has no unique constraint).
 */
export async function seedCommissionRules(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') {
    console.log('  → Skipping commission rules in production');
    return;
  }

  console.log('  → Seeding commission rules (14 brackets)...');

  // Skip if already seeded
  const existingCount = await prisma.commissionRule.count();
  if (existingCount >= 14) {
    console.log(`  ✅ Commission rules already seeded (${existingCount} found)`);
    return;
  }

  const rules: {
    serviceType: 'VCT' | 'MHH' | 'UTXNK' | 'LCLCN';
    minProfit: number;
    maxProfit: number;
    rate: number;
    description: string;
  }[] = [
    // VCT - Vận chuyển thuần (4 tiers)
    { serviceType: 'VCT', minProfit: 0, maxProfit: 5_000_000, rate: 0.015, description: 'VCT: Lợi nhuận 0-5tr → 1.5%' },
    { serviceType: 'VCT', minProfit: 5_000_001, maxProfit: 20_000_000, rate: 0.025, description: 'VCT: Lợi nhuận 5-20tr → 2.5%' },
    { serviceType: 'VCT', minProfit: 20_000_001, maxProfit: 50_000_000, rate: 0.035, description: 'VCT: Lợi nhuận 20-50tr → 3.5%' },
    { serviceType: 'VCT', minProfit: 50_000_001, maxProfit: 999_999_999, rate: 0.045, description: 'VCT: Lợi nhuận >50tr → 4.5%' },

    // MHH - Mua hàng hộ (4 tiers)
    { serviceType: 'MHH', minProfit: 0, maxProfit: 5_000_000, rate: 0.02, description: 'MHH: Lợi nhuận 0-5tr → 2%' },
    { serviceType: 'MHH', minProfit: 5_000_001, maxProfit: 20_000_000, rate: 0.03, description: 'MHH: Lợi nhuận 5-20tr → 3%' },
    { serviceType: 'MHH', minProfit: 20_000_001, maxProfit: 50_000_000, rate: 0.04, description: 'MHH: Lợi nhuận 20-50tr → 4%' },
    { serviceType: 'MHH', minProfit: 50_000_001, maxProfit: 999_999_999, rate: 0.055, description: 'MHH: Lợi nhuận >50tr → 5.5%' },

    // UTXNK - Ủy thác XNK (3 tiers)
    { serviceType: 'UTXNK', minProfit: 0, maxProfit: 10_000_000, rate: 0.02, description: 'UTXNK: Lợi nhuận 0-10tr → 2%' },
    { serviceType: 'UTXNK', minProfit: 10_000_001, maxProfit: 50_000_000, rate: 0.03, description: 'UTXNK: Lợi nhuận 10-50tr → 3%' },
    { serviceType: 'UTXNK', minProfit: 50_000_001, maxProfit: 999_999_999, rate: 0.04, description: 'UTXNK: Lợi nhuận >50tr → 4%' },

    // LCLCN - LCL chính ngạch (3 tiers)
    { serviceType: 'LCLCN', minProfit: 0, maxProfit: 10_000_000, rate: 0.015, description: 'LCLCN: Lợi nhuận 0-10tr → 1.5%' },
    { serviceType: 'LCLCN', minProfit: 10_000_001, maxProfit: 50_000_000, rate: 0.025, description: 'LCLCN: Lợi nhuận 10-50tr → 2.5%' },
    { serviceType: 'LCLCN', minProfit: 50_000_001, maxProfit: 999_999_999, rate: 0.035, description: 'LCLCN: Lợi nhuận >50tr → 3.5%' },
  ];

  // Delete existing and re-create (clean slate)
  if (existingCount > 0) {
    await prisma.commissionRule.deleteMany({});
  }

  await prisma.commissionRule.createMany({
    data: rules.map((r) => ({
      ...r,
      isActive: true,
    })),
  });

  console.log(`  ✅ ${rules.length} commission rules seeded`);
}
