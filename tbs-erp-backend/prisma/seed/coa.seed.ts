import { PrismaClient } from '@prisma/client';

/**
 * Seeds the Chart of Accounts per Vietnamese Circular 200/2014/TT-BTC.
 * ~60 accounts covering Assets, Liabilities, Equity, Revenue, Expenses.
 */
export async function seedChartOfAccounts(prisma: PrismaClient) {
  console.log('  → Seeding Chart of Accounts (Circular 200/2014/TT-BTC)...');

  const accounts: {
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    parentCode?: string;
    level: number;
  }[] = [
    // ═══════════════════════════════════════
    // ASSETS (1xx - 2xx)
    // ═══════════════════════════════════════

    // TK 111 - Tiền mặt
    { code: '111', name: 'Tiền mặt', type: 'ASSET', level: 1 },
    { code: '111.1', name: 'Tiền Việt Nam', type: 'ASSET', parentCode: '111', level: 2 },
    { code: '111.2', name: 'Ngoại tệ', type: 'ASSET', parentCode: '111', level: 2 },

    // TK 112 - Tiền gửi ngân hàng
    { code: '112', name: 'Tiền gửi ngân hàng', type: 'ASSET', level: 1 },
    { code: '112.1', name: 'Tiền Việt Nam', type: 'ASSET', parentCode: '112', level: 2 },
    { code: '112.2', name: 'Ngoại tệ', type: 'ASSET', parentCode: '112', level: 2 },

    // TK 131 - Phải thu khách hàng
    { code: '131', name: 'Phải thu của khách hàng', type: 'ASSET', level: 1 },

    // TK 133 - Thuế GTGT được khấu trừ
    { code: '133', name: 'Thuế GTGT được khấu trừ', type: 'ASSET', level: 1 },
    { code: '133.1', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', type: 'ASSET', parentCode: '133', level: 2 },
    { code: '133.2', name: 'Thuế GTGT được khấu trừ của TSCĐ', type: 'ASSET', parentCode: '133', level: 2 },

    // TK 136 - Phải thu nội bộ
    { code: '136', name: 'Phải thu nội bộ', type: 'ASSET', level: 1 },

    // TK 138 - Phải thu khác
    { code: '138', name: 'Phải thu khác', type: 'ASSET', level: 1 },
    { code: '138.1', name: 'Tài sản thiếu chờ xử lý', type: 'ASSET', parentCode: '138', level: 2 },
    { code: '138.8', name: 'Phải thu khác', type: 'ASSET', parentCode: '138', level: 2 },

    // TK 141 - Tạm ứng
    { code: '141', name: 'Tạm ứng', type: 'ASSET', level: 1 },

    // TK 142 - Chi phí trả trước ngắn hạn
    { code: '142', name: 'Chi phí trả trước ngắn hạn', type: 'ASSET', level: 1 },

    // TK 152 - Nguyên liệu, vật liệu
    { code: '152', name: 'Nguyên liệu, vật liệu', type: 'ASSET', level: 1 },

    // TK 153 - Công cụ, dụng cụ
    { code: '153', name: 'Công cụ, dụng cụ', type: 'ASSET', level: 1 },

    // TK 156 - Hàng hóa
    { code: '156', name: 'Hàng hóa', type: 'ASSET', level: 1 },
    { code: '156.1', name: 'Giá mua hàng hóa', type: 'ASSET', parentCode: '156', level: 2 },
    { code: '156.2', name: 'Chi phí thu mua hàng hóa', type: 'ASSET', parentCode: '156', level: 2 },

    // TK 211 - Tài sản cố định hữu hình
    { code: '211', name: 'TSCĐ hữu hình', type: 'ASSET', level: 1 },

    // TK 213 - Tài sản cố định vô hình
    { code: '213', name: 'TSCĐ vô hình', type: 'ASSET', level: 1 },

    // TK 214 - Hao mòn TSCĐ
    { code: '214', name: 'Hao mòn TSCĐ', type: 'ASSET', level: 1 },

    // TK 242 - Chi phí trả trước dài hạn
    { code: '242', name: 'Chi phí trả trước dài hạn', type: 'ASSET', level: 1 },

    // ═══════════════════════════════════════
    // LIABILITIES (3xx)
    // ═══════════════════════════════════════

    // TK 331 - Phải trả cho người bán
    { code: '331', name: 'Phải trả cho người bán', type: 'LIABILITY', level: 1 },
    { code: '331.99', name: 'Tiền chờ phân bổ', type: 'LIABILITY', parentCode: '331', level: 2 },

    // TK 333 - Thuế và các khoản phải nộp NN
    { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', type: 'LIABILITY', level: 1 },
    { code: '333.1', name: 'Thuế GTGT phải nộp', type: 'LIABILITY', parentCode: '333', level: 2 },
    { code: '333.3', name: 'Thuế XNK', type: 'LIABILITY', parentCode: '333', level: 2 },
    { code: '333.4', name: 'Thuế TNDN', type: 'LIABILITY', parentCode: '333', level: 2 },
    { code: '333.5', name: 'Thuế TNCN', type: 'LIABILITY', parentCode: '333', level: 2 },

    // TK 334 - Phải trả người lao động
    { code: '334', name: 'Phải trả người lao động', type: 'LIABILITY', level: 1 },

    // TK 335 - Chi phí phải trả
    { code: '335', name: 'Chi phí phải trả', type: 'LIABILITY', level: 1 },

    // TK 338 - Phải trả, phải nộp khác
    { code: '338', name: 'Phải trả, phải nộp khác', type: 'LIABILITY', level: 1 },
    { code: '338.2', name: 'Kinh phí công đoàn', type: 'LIABILITY', parentCode: '338', level: 2 },
    { code: '338.3', name: 'BHXH', type: 'LIABILITY', parentCode: '338', level: 2 },
    { code: '338.4', name: 'BHYT', type: 'LIABILITY', parentCode: '338', level: 2 },
    { code: '338.6', name: 'BHTN', type: 'LIABILITY', parentCode: '338', level: 2 },
    { code: '338.8', name: 'Phải trả, phải nộp khác', type: 'LIABILITY', parentCode: '338', level: 2 },

    // TK 341 - Vay và nợ thuê tài chính
    { code: '341', name: 'Vay và nợ thuê tài chính', type: 'LIABILITY', level: 1 },

    // ═══════════════════════════════════════
    // EQUITY (4xx)
    // ═══════════════════════════════════════

    // TK 411 - Vốn đầu tư của chủ sở hữu
    { code: '411', name: 'Vốn đầu tư của chủ sở hữu', type: 'EQUITY', level: 1 },

    // TK 414 - Quỹ đầu tư phát triển
    { code: '414', name: 'Quỹ đầu tư phát triển', type: 'EQUITY', level: 1 },

    // TK 418 - Các quỹ khác thuộc vốn chủ sở hữu
    { code: '418', name: 'Các quỹ khác thuộc vốn chủ sở hữu', type: 'EQUITY', level: 1 },

    // TK 421 - Lợi nhuận sau thuế chưa phân phối
    { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', type: 'EQUITY', level: 1 },
    { code: '421.1', name: 'LNST chưa phân phối năm trước', type: 'EQUITY', parentCode: '421', level: 2 },
    { code: '421.2', name: 'LNST chưa phân phối năm nay', type: 'EQUITY', parentCode: '421', level: 2 },

    // ═══════════════════════════════════════
    // REVENUE (5xx)
    // ═══════════════════════════════════════

    // TK 511 - Doanh thu bán hàng và cung cấp dịch vụ
    { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', type: 'REVENUE', level: 1 },
    { code: '511.1', name: 'Doanh thu VCT', type: 'REVENUE', parentCode: '511', level: 2 },
    { code: '511.2', name: 'Doanh thu MHH', type: 'REVENUE', parentCode: '511', level: 2 },
    { code: '511.3', name: 'Doanh thu UTXNK', type: 'REVENUE', parentCode: '511', level: 2 },
    { code: '511.4', name: 'Doanh thu LCLCN', type: 'REVENUE', parentCode: '511', level: 2 },

    // TK 515 - Doanh thu hoạt động tài chính
    { code: '515', name: 'Doanh thu hoạt động tài chính', type: 'REVENUE', level: 1 },

    // TK 521 - Các khoản giảm trừ doanh thu
    { code: '521', name: 'Các khoản giảm trừ doanh thu', type: 'REVENUE', level: 1 },

    // ═══════════════════════════════════════
    // EXPENSES (6xx - 9xx)
    // ═══════════════════════════════════════

    // TK 632 - Giá vốn hàng bán
    { code: '632', name: 'Giá vốn hàng bán', type: 'EXPENSE', level: 1 },
    { code: '632.1', name: 'Giá vốn VCT (cước vận chuyển)', type: 'EXPENSE', parentCode: '632', level: 2 },
    { code: '632.2', name: 'Giá vốn MHH (giá mua + phí)', type: 'EXPENSE', parentCode: '632', level: 2 },
    { code: '632.3', name: 'Giá vốn UTXNK (phí thông quan)', type: 'EXPENSE', parentCode: '632', level: 2 },
    { code: '632.4', name: 'Giá vốn LCLCN', type: 'EXPENSE', parentCode: '632', level: 2 },

    // TK 635 - Chi phí tài chính
    { code: '635', name: 'Chi phí tài chính', type: 'EXPENSE', level: 1 },
    { code: '635.1', name: 'Lỗ chênh lệch tỷ giá', type: 'EXPENSE', parentCode: '635', level: 2 },
    { code: '635.2', name: 'Lãi vay', type: 'EXPENSE', parentCode: '635', level: 2 },

    // TK 641 - Chi phí bán hàng
    { code: '641', name: 'Chi phí bán hàng', type: 'EXPENSE', level: 1 },
    { code: '641.1', name: 'Chi phí nhân viên bán hàng', type: 'EXPENSE', parentCode: '641', level: 2 },
    { code: '641.2', name: 'Hoa hồng kinh doanh', type: 'EXPENSE', parentCode: '641', level: 2 },
    { code: '641.7', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE', parentCode: '641', level: 2 },

    // TK 642 - Chi phí quản lý doanh nghiệp
    { code: '642', name: 'Chi phí quản lý doanh nghiệp', type: 'EXPENSE', level: 1 },
    { code: '642.1', name: 'Chi phí nhân viên quản lý', type: 'EXPENSE', parentCode: '642', level: 2 },
    { code: '642.4', name: 'Chi phí khấu hao TSCĐ', type: 'EXPENSE', parentCode: '642', level: 2 },
    { code: '642.7', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE', parentCode: '642', level: 2 },
    { code: '642.8', name: 'Chi phí bằng tiền khác', type: 'EXPENSE', parentCode: '642', level: 2 },

    // TK 711 - Thu nhập khác
    { code: '711', name: 'Thu nhập khác', type: 'REVENUE', level: 1 },

    // TK 811 - Chi phí khác
    { code: '811', name: 'Chi phí khác', type: 'EXPENSE', level: 1 },

    // TK 821 - Chi phí thuế TNDN
    { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', type: 'EXPENSE', level: 1 },

    // TK 911 - Xác định kết quả kinh doanh
    { code: '911', name: 'Xác định kết quả kinh doanh', type: 'EXPENSE', level: 1 },
  ];

  for (const acct of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: acct.code },
      update: {
        name: acct.name,
        type: acct.type,
        parentCode: acct.parentCode ?? null,
        level: acct.level,
      },
      create: {
        code: acct.code,
        name: acct.name,
        type: acct.type,
        parentCode: acct.parentCode ?? null,
        level: acct.level,
        isActive: true,
      },
    });
  }

  console.log(`  ✅ ${accounts.length} chart of accounts seeded`);
}
