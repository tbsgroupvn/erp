import { PrismaClient } from '@prisma/client';

/**
 * Seeds compliance rules for customs declaration validation.
 * Covers restricted, prohibited, and permit-required goods categories.
 */
export async function seedComplianceRules(prisma: PrismaClient) {
  const rules = [
    // Cosmetics
    {
      hsCodePattern: '3304.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOH_COSMETICS',
      message: 'Mỹ phẩm cần công bố theo quy định Bộ Y tế (Nghị định 93/2016/NĐ-CP)',
      authority: 'Bộ Y tế',
    },
    {
      hsCodePattern: '3305.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOH_COSMETICS',
      message: 'Sản phẩm chăm sóc tóc cần công bố mỹ phẩm Bộ Y tế',
      authority: 'Bộ Y tế',
    },

    // Pharmaceuticals
    {
      hsCodePattern: '3004.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOH_PHARMA',
      message: 'Dược phẩm cần giấy phép nhập khẩu của Bộ Y tế',
      authority: 'Bộ Y tế',
    },
    {
      hsCodePattern: '3003.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOH_PHARMA',
      message: 'Dược phẩm cần giấy phép nhập khẩu của Bộ Y tế',
      authority: 'Bộ Y tế',
    },

    // Telecommunications equipment
    {
      hsCodePattern: '8517.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'BTTTT_CERTIFICATE',
      message: 'Thiết bị viễn thông cần chứng nhận hợp quy Bộ TT&TT',
      authority: 'Bộ Thông tin & Truyền thông',
    },

    // Drones / UAV
    {
      hsCodePattern: '8806.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOD_UAV',
      message: 'Thiết bị bay không người lái (Flycam/Drone) cần giấy phép Bộ Quốc phòng',
      authority: 'Bộ Quốc phòng',
    },

    // Food supplements
    {
      hsCodePattern: '2106.90.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOH_FOOD_SUPPLEMENT',
      message: 'Thực phẩm chức năng/TPCN cần công bố theo quy định Bộ Y tế',
      authority: 'Bộ Y tế',
    },

    // Alcohol
    {
      hsCodePattern: '2208.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOIT_ALCOHOL',
      message: 'Rượu cần giấy phép nhập khẩu Bộ Công Thương',
      authority: 'Bộ Công Thương',
    },

    // Tobacco (prohibited for informal import)
    {
      hsCodePattern: '2402.*',
      ruleType: 'RESTRICTED',
      message: 'Thuốc lá - Hạn chế nhập khẩu, cần giấy phép đặc biệt',
      authority: 'Bộ Công Thương',
    },

    // Weapons / explosives (prohibited)
    {
      hsCodePattern: '9301.*',
      ruleType: 'PROHIBITED',
      message: 'Vũ khí - CẤM nhập khẩu',
      authority: 'Bộ Quốc phòng',
    },
    {
      hsCodePattern: '9302.*',
      ruleType: 'PROHIBITED',
      message: 'Vũ khí - CẤM nhập khẩu',
      authority: 'Bộ Quốc phòng',
    },
    {
      hsCodePattern: '3602.*',
      ruleType: 'PROHIBITED',
      message: 'Chất nổ - CẤM nhập khẩu',
      authority: 'Bộ Quốc phòng',
    },

    // Chemical precursors
    {
      hsCodePattern: '2914.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MOIT_CHEMICAL',
      message: 'Hóa chất công nghiệp cần giấy phép Bộ Công Thương',
      authority: 'Bộ Công Thương',
    },

    // Plants, seeds (quarantine)
    {
      hsCodePattern: '0602.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MARD_QUARANTINE',
      message: 'Cây trồng, hạt giống cần kiểm dịch thực vật',
      authority: 'Bộ Nông nghiệp & Phát triển Nông thôn',
    },

    // Animals, animal products
    {
      hsCodePattern: '0101.*',
      ruleType: 'PERMIT_REQUIRED',
      permitType: 'MARD_QUARANTINE',
      message: 'Động vật sống cần kiểm dịch',
      authority: 'Bộ Nông nghiệp & Phát triển Nông thôn',
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.complianceRule.findFirst({
      where: {
        hsCodePattern: rule.hsCodePattern,
        ruleType: rule.ruleType,
      },
    });

    if (!existing) {
      await prisma.complianceRule.create({
        data: {
          ...rule,
          createdBy: 'system',
        },
      });
    }
  }

  console.log(`Seeded ${rules.length} compliance rules`);
}
