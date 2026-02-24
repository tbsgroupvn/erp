import { PrismaClient } from '@prisma/client';

/**
 * Seeds the HSCodeLibrary with common HS codes used in CN-VN trade.
 * Covers the most frequently imported categories for TBS's business.
 */
export async function seedHSCodes(prisma: PrismaClient) {
  const hsCodes = [
    // Chapter 39: Plastics
    { code: '3926.90.99', descriptionVi: 'Sản phẩm khác bằng nhựa', descriptionEn: 'Other articles of plastics', chapter: 39, heading: '3926', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG' },
    { code: '3926.90.92', descriptionVi: 'Phụ kiện điện thoại bằng nhựa', descriptionEn: 'Plastic phone accessories', chapter: 39, heading: '3926', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG' },
    { code: '3923.10.00', descriptionVi: 'Hộp, túi bằng nhựa', descriptionEn: 'Boxes, cases, crates of plastics', chapter: 39, heading: '3923', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG' },
    { code: '3924.90.90', descriptionVi: 'Đồ gia dụng bằng nhựa khác', descriptionEn: 'Other household articles of plastics', chapter: 39, heading: '3924', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG' },

    // Chapter 42: Leather goods, travel goods
    { code: '4202.32.00', descriptionVi: 'Ví, bóp bằng nhựa hoặc vải', descriptionEn: 'Wallets, purses of plastic sheeting or textile', chapter: 42, heading: '4202', importDutyRate: 0.25, vatRate: 0.10, unit: 'PCS' },
    { code: '4202.92.90', descriptionVi: 'Túi xách bằng vải', descriptionEn: 'Bags of textile materials', chapter: 42, heading: '4202', importDutyRate: 0.25, vatRate: 0.10, unit: 'PCS' },

    // Chapter 61-62: Clothing
    { code: '6109.10.00', descriptionVi: 'Áo thun cotton dệt kim', descriptionEn: 'T-shirts of cotton, knitted', chapter: 61, heading: '6109', importDutyRate: 0.20, vatRate: 0.10, unit: 'PCS' },
    { code: '6110.30.00', descriptionVi: 'Áo len sợi nhân tạo', descriptionEn: 'Sweaters of man-made fibres, knitted', chapter: 61, heading: '6110', importDutyRate: 0.20, vatRate: 0.10, unit: 'PCS' },
    { code: '6204.62.00', descriptionVi: 'Quần nữ cotton', descriptionEn: 'Women trousers of cotton', chapter: 62, heading: '6204', importDutyRate: 0.20, vatRate: 0.10, unit: 'PCS' },
    { code: '6203.42.00', descriptionVi: 'Quần nam cotton', descriptionEn: 'Men trousers of cotton', chapter: 62, heading: '6203', importDutyRate: 0.20, vatRate: 0.10, unit: 'PCS' },

    // Chapter 64: Footwear
    { code: '6402.99.90', descriptionVi: 'Giày dép bằng cao su/nhựa', descriptionEn: 'Other footwear of rubber or plastics', chapter: 64, heading: '6402', importDutyRate: 0.30, vatRate: 0.10, unit: 'DOI' },
    { code: '6404.19.90', descriptionVi: 'Giày dép đế cao su mũ vải', descriptionEn: 'Footwear with rubber soles, textile uppers', chapter: 64, heading: '6404', importDutyRate: 0.30, vatRate: 0.10, unit: 'DOI' },

    // Chapter 73: Iron/steel articles
    { code: '7323.99.90', descriptionVi: 'Đồ gia dụng bằng thép không gỉ', descriptionEn: 'Stainless steel household articles', chapter: 73, heading: '7323', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG' },
    { code: '7326.90.99', descriptionVi: 'Sản phẩm khác bằng sắt/thép', descriptionEn: 'Other articles of iron or steel', chapter: 73, heading: '7326', importDutyRate: 0.15, vatRate: 0.10, unit: 'KG' },

    // Chapter 84: Machinery
    { code: '8471.30.00', descriptionVi: 'Máy tính xách tay', descriptionEn: 'Portable digital computers', chapter: 84, heading: '8471', importDutyRate: 0.00, vatRate: 0.10, unit: 'PCS' },
    { code: '8443.32.40', descriptionVi: 'Máy in', descriptionEn: 'Printers', chapter: 84, heading: '8443', importDutyRate: 0.00, vatRate: 0.10, unit: 'PCS' },

    // Chapter 85: Electronics
    { code: '8517.12.00', descriptionVi: 'Điện thoại di động', descriptionEn: 'Mobile phones', chapter: 85, heading: '8517', importDutyRate: 0.00, vatRate: 0.10, unit: 'PCS', requiresPermit: true, permitType: 'BTTTT_CERTIFICATE', restrictionNote: 'Cần giấy chứng nhận hợp quy Bộ TT&TT' },
    { code: '8518.30.00', descriptionVi: 'Tai nghe', descriptionEn: 'Headphones, earphones', chapter: 85, heading: '8518', importDutyRate: 0.05, vatRate: 0.10, unit: 'PCS' },
    { code: '8504.40.00', descriptionVi: 'Bộ sạc, adapter', descriptionEn: 'Static converters (chargers)', chapter: 85, heading: '8504', importDutyRate: 0.10, vatRate: 0.10, unit: 'PCS' },
    { code: '8523.51.00', descriptionVi: 'Thiết bị lưu trữ USB/thẻ nhớ', descriptionEn: 'USB flash drives, memory cards', chapter: 85, heading: '8523', importDutyRate: 0.00, vatRate: 0.10, unit: 'PCS' },
    { code: '8528.72.00', descriptionVi: 'Màn hình', descriptionEn: 'Monitors', chapter: 85, heading: '8528', importDutyRate: 0.05, vatRate: 0.10, unit: 'PCS' },

    // Chapter 91: Watches
    { code: '9102.12.00', descriptionVi: 'Đồng hồ đeo tay kỹ thuật số', descriptionEn: 'Digital wrist watches', chapter: 91, heading: '9102', importDutyRate: 0.20, vatRate: 0.10, unit: 'PCS' },

    // Chapter 94: Furniture
    { code: '9403.60.00', descriptionVi: 'Đồ nội thất bằng gỗ', descriptionEn: 'Wooden furniture', chapter: 94, heading: '9403', importDutyRate: 0.25, vatRate: 0.10, unit: 'KG' },
    { code: '9405.40.00', descriptionVi: 'Đèn trang trí', descriptionEn: 'Other electric lamps and lighting', chapter: 94, heading: '9405', importDutyRate: 0.25, vatRate: 0.10, unit: 'PCS' },

    // Chapter 95: Toys, games
    { code: '9503.00.90', descriptionVi: 'Đồ chơi khác', descriptionEn: 'Other toys', chapter: 95, heading: '9503', importDutyRate: 0.20, vatRate: 0.10, unit: 'PCS' },

    // Chapter 33: Cosmetics (restricted - requires permit)
    { code: '3304.99.90', descriptionVi: 'Mỹ phẩm chăm sóc da khác', descriptionEn: 'Other skin care preparations', chapter: 33, heading: '3304', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG', requiresPermit: true, permitType: 'MOH_COSMETICS', isRestricted: true, restrictionNote: 'Cần công bố mỹ phẩm theo quy định Bộ Y tế' },
    { code: '3305.10.00', descriptionVi: 'Dầu gội đầu', descriptionEn: 'Shampoos', chapter: 33, heading: '3305', importDutyRate: 0.20, vatRate: 0.10, unit: 'KG', requiresPermit: true, permitType: 'MOH_COSMETICS', isRestricted: true, restrictionNote: 'Cần công bố mỹ phẩm theo quy định Bộ Y tế' },

    // Chapter 30: Pharmaceuticals (restricted)
    { code: '3004.90.99', descriptionVi: 'Thuốc thành phẩm khác', descriptionEn: 'Other medicaments', chapter: 30, heading: '3004', importDutyRate: 0.05, vatRate: 0.05, unit: 'KG', requiresPermit: true, permitType: 'MOH_PHARMA', isRestricted: true, restrictionNote: 'Cần giấy phép nhập khẩu dược phẩm Bộ Y tế' },

    // Chapter 71: Jewelry
    { code: '7117.90.00', descriptionVi: 'Đồ trang sức giả', descriptionEn: 'Imitation jewellery', chapter: 71, heading: '7117', importDutyRate: 0.30, vatRate: 0.10, unit: 'KG' },

    // Chapter 96: Miscellaneous
    { code: '9608.10.00', descriptionVi: 'Bút bi', descriptionEn: 'Ball point pens', chapter: 96, heading: '9608', importDutyRate: 0.25, vatRate: 0.10, unit: 'PCS' },
    { code: '9615.11.00', descriptionVi: 'Lược, kẹp tóc', descriptionEn: 'Combs, hair-slides', chapter: 96, heading: '9615', importDutyRate: 0.25, vatRate: 0.10, unit: 'KG' },
  ];

  for (const hs of hsCodes) {
    await prisma.hSCodeLibrary.upsert({
      where: { code: hs.code },
      update: {
        descriptionVi: hs.descriptionVi,
        descriptionEn: hs.descriptionEn,
        chapter: hs.chapter,
        heading: hs.heading,
        importDutyRate: hs.importDutyRate,
        vatRate: hs.vatRate,
        unit: hs.unit,
        requiresPermit: hs.requiresPermit ?? false,
        permitType: hs.permitType ?? null,
        isRestricted: hs.isRestricted ?? false,
        restrictionNote: hs.restrictionNote ?? null,
      },
      create: {
        code: hs.code,
        descriptionVi: hs.descriptionVi,
        descriptionEn: hs.descriptionEn,
        chapter: hs.chapter,
        heading: hs.heading,
        importDutyRate: hs.importDutyRate,
        vatRate: hs.vatRate,
        unit: hs.unit,
        requiresPermit: hs.requiresPermit ?? false,
        permitType: hs.permitType ?? null,
        isRestricted: hs.isRestricted ?? false,
        restrictionNote: hs.restrictionNote ?? null,
      },
    });
  }

  console.log(`Seeded ${hsCodes.length} HS codes`);
}
