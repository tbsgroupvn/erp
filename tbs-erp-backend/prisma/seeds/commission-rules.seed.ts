import { PrismaClient, ServiceType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed commission rules with tiered rates based on profit margins.
 *
 * Commission Structure:
 * - Higher profit margins = Higher commission rates
 * - Different tiers for each service type
 *
 * Example Tiers:
 * - Low Profit: 0-10M VND → 3% commission
 * - Medium Profit: 10M-50M VND → 5% commission
 * - High Profit: 50M-100M VND → 7% commission
 * - Very High Profit: 100M+ VND → 10% commission
 */
async function seedCommissionRules() {
  console.log('🔧 Seeding Commission Rules...');

  // Delete existing rules (optional - for fresh start)
  await prisma.commissionRule.deleteMany({});

  const rules = [
    // VCT (Vận chuyển thuần) - Pure Transportation
    {
      serviceType: ServiceType.VCT,
      minProfit: 0,
      maxProfit: 5_000_000, // 0-5M VND
      rate: 0.02, // 2%
      description: 'VCT: Low profit tier (0-5M)',
    },
    {
      serviceType: ServiceType.VCT,
      minProfit: 5_000_000,
      maxProfit: 15_000_000, // 5M-15M VND
      rate: 0.04, // 4%
      description: 'VCT: Medium profit tier (5M-15M)',
    },
    {
      serviceType: ServiceType.VCT,
      minProfit: 15_000_000,
      maxProfit: 30_000_000, // 15M-30M VND
      rate: 0.06, // 6%
      description: 'VCT: High profit tier (15M-30M)',
    },
    {
      serviceType: ServiceType.VCT,
      minProfit: 30_000_000,
      maxProfit: 999_999_999, // 30M+ VND
      rate: 0.08, // 8%
      description: 'VCT: Very high profit tier (30M+)',
    },

    // MHH (Mua hàng hộ) - Purchasing Service
    {
      serviceType: ServiceType.MHH,
      minProfit: 0,
      maxProfit: 10_000_000, // 0-10M VND
      rate: 0.03, // 3%
      description: 'MHH: Low profit tier (0-10M)',
    },
    {
      serviceType: ServiceType.MHH,
      minProfit: 10_000_000,
      maxProfit: 30_000_000, // 10M-30M VND
      rate: 0.05, // 5%
      description: 'MHH: Medium profit tier (10M-30M)',
    },
    {
      serviceType: ServiceType.MHH,
      minProfit: 30_000_000,
      maxProfit: 60_000_000, // 30M-60M VND
      rate: 0.07, // 7%
      description: 'MHH: High profit tier (30M-60M)',
    },
    {
      serviceType: ServiceType.MHH,
      minProfit: 60_000_000,
      maxProfit: 999_999_999, // 60M+ VND
      rate: 0.10, // 10%
      description: 'MHH: Very high profit tier (60M+)',
    },

    // UTXNK (Ủy thác xuất nhập khẩu) - Import/Export Agency
    {
      serviceType: ServiceType.UTXNK,
      minProfit: 0,
      maxProfit: 20_000_000, // 0-20M VND
      rate: 0.025, // 2.5%
      description: 'UTXNK: Low profit tier (0-20M)',
    },
    {
      serviceType: ServiceType.UTXNK,
      minProfit: 20_000_000,
      maxProfit: 50_000_000, // 20M-50M VND
      rate: 0.045, // 4.5%
      description: 'UTXNK: Medium profit tier (20M-50M)',
    },
    {
      serviceType: ServiceType.UTXNK,
      minProfit: 50_000_000,
      maxProfit: 100_000_000, // 50M-100M VND
      rate: 0.065, // 6.5%
      description: 'UTXNK: High profit tier (50M-100M)',
    },
    {
      serviceType: ServiceType.UTXNK,
      minProfit: 100_000_000,
      maxProfit: 999_999_999, // 100M+ VND
      rate: 0.09, // 9%
      description: 'UTXNK: Very high profit tier (100M+)',
    },

    // LCLCN (LCL chính ngạch) - LCL Official Channel
    {
      serviceType: ServiceType.LCLCN,
      minProfit: 0,
      maxProfit: 8_000_000, // 0-8M VND
      rate: 0.03, // 3%
      description: 'LCLCN: Low profit tier (0-8M)',
    },
    {
      serviceType: ServiceType.LCLCN,
      minProfit: 8_000_000,
      maxProfit: 25_000_000, // 8M-25M VND
      rate: 0.05, // 5%
      description: 'LCLCN: Medium profit tier (8M-25M)',
    },
    {
      serviceType: ServiceType.LCLCN,
      minProfit: 25_000_000,
      maxProfit: 50_000_000, // 25M-50M VND
      rate: 0.07, // 7%
      description: 'LCLCN: High profit tier (25M-50M)',
    },
    {
      serviceType: ServiceType.LCLCN,
      minProfit: 50_000_000,
      maxProfit: 999_999_999, // 50M+ VND
      rate: 0.095, // 9.5%
      description: 'LCLCN: Very high profit tier (50M+)',
    },
  ];

  for (const rule of rules) {
    await prisma.commissionRule.create({
      data: rule,
    });
    console.log(
      `✓ Created: ${rule.serviceType} [${rule.minProfit / 1_000_000}M-${rule.maxProfit / 1_000_000}M] @ ${rule.rate * 100}%`,
    );
  }

  console.log(`✅ Successfully seeded ${rules.length} commission rules`);
}

seedCommissionRules()
  .catch((e) => {
    console.error('❌ Error seeding commission rules:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
