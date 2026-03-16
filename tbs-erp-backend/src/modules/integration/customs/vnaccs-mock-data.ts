/**
 * VNACCS Mock Data — Du lieu gia lap cho tich hop hai quan VNACCS/VCIS
 *
 * File nay chua:
 *   - Bang tra cuu ma HS pho bien trong logistics hang Trung Quoc
 *   - Logic gan kenh kiem tra (GREEN / YELLOW / RED)
 *   - Bang ty gia USD -> VND mac dinh (fallback khi chua co exchange rate service)
 *
 * DE LOI: Xoa file nay va thay bang client VNACCS that khi co chung thu so.
 *
 * Nguon tham khao:
 *   - Bieu thue xuat nhap khau 2024 (Nghi dinh 26/2023/ND-CP)
 *   - ACFTA (ASEAN-China FTA) uu dai: nhieu ma HS hang CN ve 0%
 *   - CPTPP: ap dung cho hang tu CA, AU, JP, MX, v.v.
 *   - VAT 10% mac dinh theo Luat Thue Gia Tri Gia Tang hien hanh
 */

// ============================================================
// LOAI HANG PHO BIEN TRONG LOGISTICS TRUNG QUOC -> VIET NAM
// ============================================================

export interface MockHSEntry {
  code: string;
  descriptionVi: string;
  descriptionEn: string;
  /** Thue nhap khau MFN (%), vi du 0.12 = 12% */
  dutyRateMfn: number;
  /** Thue nhap khau ACFTA (uu dai Trung Quoc), nhieu mat hang = 0 */
  dutyRateAcfta: number;
  vatRate: number;
  /** Thue tieu thu dac biet (TTDB), phan lon = 0 */
  specialTaxRate: number;
  /** Thue bao ve moi truong, VND/don vi (0 = khong ap dung) */
  environmentalTaxVnd: number;
  /** Thue chong ban pha gia (neu co), % */
  antiDumpingRate: number;
  unit: string;
  requiresPermit: boolean;
  permitType?: string;
  /** Tu khoa tim kiem (lowercase, khong dau) */
  keywords: string[];
}

/**
 * Bang HS Code mock — 25 nhom hang pho bien nhat trong logistics TQ->VN.
 * Du lieu dua tren bieu thue 2024, chi mang tinh chat tham khao demo.
 */
export const MOCK_HS_TABLE: MockHSEntry[] = [
  // NHOM 1: HANG DET MAY / QUAN AO
  {
    code: '6201.20.00',
    descriptionVi: 'Ao khoac dai (kể ca ao mua), ao va ao jacket - danh cho nam, tu bong',
    descriptionEn: "Men's overcoats, car-coats, capes - of cotton",
    dutyRateMfn: 0.12,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['quan ao', 'ao khoac', 'det may', 'ao', 'bong', 'nam', 'thoi trang', 'garment', 'textile', 'apparel', 'jacket', 'coat'],
  },
  {
    code: '6204.62.00',
    descriptionVi: 'Quan dai va quan shorts danh cho nu, tu bong',
    descriptionEn: "Women's trousers and shorts - of cotton",
    dutyRateMfn: 0.12,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['quan', 'quan dai', 'shorts', 'nu', 'det may', 'bong', 'thoi trang'],
  },
  {
    code: '6109.10.00',
    descriptionVi: 'Ao phong (T-shirt), ao may o trong va ao ba lo, tu bong, det kim',
    descriptionEn: 'T-shirts, singlets and other vests - of cotton, knitted',
    dutyRateMfn: 0.12,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['t-shirt', 'ao phong', 'ao thun', 'ao ba lo', 'det kim', 'bong', 'thoi trang'],
  },

  // NHOM 2: THIET BI DIEN TU / CONG NGHE
  {
    code: '8471.30.00',
    descriptionVi: 'May vi tinh xach tay (laptop, notebook, subnotebook)',
    descriptionEn: 'Portable automatic data processing machines (laptops, notebooks)',
    dutyRateMfn: 0.0,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['laptop', 'may tinh', 'notebook', 'may vi tinh', 'computer', 'macbook', 'pc', 'electronics'],
  },
  {
    code: '8517.12.00',
    descriptionVi: 'Dien thoai thong minh (smartphone)',
    descriptionEn: 'Telephones for cellular networks or for other wireless networks - smartphones',
    dutyRateMfn: 0.0,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['dien thoai', 'smartphone', 'iphone', 'android', 'mobile', 'phone', 'dien thoai thong minh'],
  },
  {
    code: '8543.70.99',
    descriptionVi: 'May phat wifi, bo phat song, thiet bi mang khong day khac',
    descriptionEn: 'Wireless routers, access points and other wireless network equipment',
    dutyRateMfn: 0.0,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['wifi', 'router', 'mang', 'network', 'bo phat song', 'modem', 'thiet bi mang'],
  },
  {
    code: '8528.72.30',
    descriptionVi: 'Man hinh LCD/LED dung cho may vi tinh, khong tich hop tu tiep nhan',
    descriptionEn: 'LCD/LED monitors for computers, without built-in receiver',
    dutyRateMfn: 0.0,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['man hinh', 'monitor', 'lcd', 'led', 'display', 'screen'],
  },

  // NHOM 3: DO NOI THAT / GIA DUNG
  {
    code: '9403.60.00',
    descriptionVi: 'Do noi that bang go khac (tu, ke sach, ban, ke trang tri)',
    descriptionEn: 'Other wooden furniture (cabinets, shelves, tables, display units)',
    dutyRateMfn: 0.25,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['do noi that', 'tu', 'ke sach', 'ban', 'go', 'furniture', 'wood', 'cabinet', 'shelf'],
  },
  {
    code: '9401.61.00',
    descriptionVi: 'Ghe ngoi co khung bang go (ghe van phong, ghe an)',
    descriptionEn: 'Seats with wooden frames (office chairs, dining chairs)',
    dutyRateMfn: 0.25,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['ghe', 'ghe ngoi', 'chair', 'seat', 'go', 'van phong', 'noi that'],
  },

  // NHOM 4: HANG GIA DUNG / DUNG CU NHA BEP
  {
    code: '7323.93.00',
    descriptionVi: 'Do dung nha bep, hang gia dung bang thep khong gi (inox)',
    descriptionEn: 'Kitchen utensils and household articles of stainless steel',
    dutyRateMfn: 0.3,
    dutyRateAcfta: 0.1,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['nha bep', 'inox', 'thep khong gi', 'gia dung', 'dung cu', 'kitchen', 'steel', 'stainless'],
  },
  {
    code: '3924.10.00',
    descriptionVi: 'Do dung ban an va nha bep bang nhua (bat, dia, hop, v.v.)',
    descriptionEn: 'Tableware and kitchenware of plastics (bowls, plates, containers)',
    dutyRateMfn: 0.2,
    dutyRateAcfta: 0.05,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['nhua', 'bat dia', 'hop nhua', 'gia dung', 'plastic', 'tableware', 'container'],
  },

  // NHOM 5: DO CHOI / THE THAO
  {
    code: '9503.00.90',
    descriptionVi: 'Do choi khac (mo hinh, thu nhoi bong, do choi dien tu)',
    descriptionEn: 'Other toys (models, stuffed animals, electronic toys)',
    dutyRateMfn: 0.3,
    dutyRateAcfta: 0.1,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['do choi', 'toy', 'mo hinh', 'thu nhoi bong', 'figure', 'game', 'tro choi'],
  },
  {
    code: '9506.91.00',
    descriptionVi: 'Dung cu the duc, the hinh va the thao (ta, bang keo, day nhua)',
    descriptionEn: 'Gymnasium, fitness and athletics equipment (weights, bands, ropes)',
    dutyRateMfn: 0.15,
    dutyRateAcfta: 0.05,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['the thao', 'the duc', 'the hinh', 'gym', 'dumbbell', 'ta', 'sport', 'fitness'],
  },

  // NHOM 6: MY PHAM / CHAM SOC CA NHAN
  {
    code: '3304.99.90',
    descriptionVi: 'My pham trang diem khac (ke mat, phan ma, son mong tay)',
    descriptionEn: 'Beauty preparations for make-up (eyeliner, blusher, nail polish)',
    dutyRateMfn: 0.25,
    dutyRateAcfta: 0.1,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['my pham', 'trang diem', 'phan', 'son', 'cosmetic', 'makeup', 'beauty'],
  },
  {
    code: '3305.10.00',
    descriptionVi: 'Dau goi dau (shampoo)',
    descriptionEn: 'Shampoos',
    dutyRateMfn: 0.22,
    dutyRateAcfta: 0.1,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['dau goi', 'shampoo', 'cham soc toc', 'toc', 'hair'],
  },

  // NHOM 7: THUC PHAM / DO UONG (co kiem soat)
  {
    code: '1806.32.00',
    descriptionVi: 'Socola dang khoi hoac thanh, khong co nhan (chocolate)',
    descriptionEn: 'Chocolate in blocks, slabs or bars, not filled',
    dutyRateMfn: 0.3,
    dutyRateAcfta: 0.15,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['socola', 'chocolate', 'keo', 'banh', 'thuc pham', 'food'],
  },
  {
    code: '2202.10.00',
    descriptionVi: 'Nuoc khoang va nuoc gaz co them duong hoac chat tao vi',
    descriptionEn: 'Mineral water and sparkling water, sweetened or flavored',
    dutyRateMfn: 0.4,
    dutyRateAcfta: 0.2,
    vatRate: 0.1,
    specialTaxRate: 0.1,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'L',
    requiresPermit: false,
    keywords: ['nuoc ngot', 'do uong', 'nuoc khoang', 'nuoc gaz', 'beverage', 'drink'],
  },

  // NHOM 8: LINH KIEN / PHU TUNG MAY MOC
  {
    code: '8473.30.00',
    descriptionVi: 'Linh kien va phu kien cua may tinh (khong bao gom vo boc va day cap)',
    descriptionEn: 'Parts and accessories of computers (excluding cases and cables)',
    dutyRateMfn: 0.0,
    dutyRateAcfta: 0.0,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['linh kien', 'phu tung', 'may tinh', 'component', 'spare part', 'ram', 'ssd', 'cpu', 'mainboard', 'nguon', 'psu'],
  },
  {
    code: '8544.42.90',
    descriptionVi: 'Day dien va day cap khac, co cap dien ap <= 1000V, co dau noi',
    descriptionEn: 'Electric conductors with connectors, voltage <= 1000V',
    dutyRateMfn: 0.2,
    dutyRateAcfta: 0.05,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'M',
    requiresPermit: false,
    keywords: ['day dien', 'cap dien', 'cable', 'wire', 'dau noi', 'connector', 'usb', 'hdmi'],
  },

  // NHOM 9: BAO BI / DONG GOI
  {
    code: '3923.21.00',
    descriptionVi: 'Tui, bao, tui xach va tui co nap bang polyetylen',
    descriptionEn: 'Sacks, bags and similar containers of polyethylene',
    dutyRateMfn: 0.2,
    dutyRateAcfta: 0.05,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['tui nhua', 'bao bi', 'tui', 'poly', 'polyethylene', 'packaging', 'bag'],
  },
  {
    code: '4819.10.00',
    descriptionVi: 'Hop, kien, thung carton bang giay (carton)',
    descriptionEn: 'Cartons, boxes and cases of corrugated paper or paperboard',
    dutyRateMfn: 0.2,
    dutyRateAcfta: 0.05,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'KG',
    requiresPermit: false,
    keywords: ['carton', 'thung giay', 'hop giay', 'bao bi', 'paperboard', 'box'],
  },

  // NHOM 10: PHU KIEN THOI TRANG / TUI XACH / GIAY DEP
  {
    code: '4202.22.00',
    descriptionVi: 'Tui xach tay cua nu, vo ngoai bang da thiet (da that hoac da tong hop)',
    descriptionEn: "Women's handbags with outer surface of leather or composition leather",
    dutyRateMfn: 0.3,
    dutyRateAcfta: 0.1,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PCS',
    requiresPermit: false,
    keywords: ['tui xach', 'tui da', 'handbag', 'phu kien', 'accessories', 'purse', 'da'],
  },
  {
    code: '6403.91.00',
    descriptionVi: 'Giay da co mui va mui giay cao tren 3 cm, de ngoai bang cao su hoac nhua',
    descriptionEn: 'Footwear with uppers of leather, ankle coverage, outer sole of rubber/plastics',
    dutyRateMfn: 0.3,
    dutyRateAcfta: 0.15,
    vatRate: 0.1,
    specialTaxRate: 0.0,
    environmentalTaxVnd: 0,
    antiDumpingRate: 0.0,
    unit: 'PAIR',
    requiresPermit: false,
    keywords: ['giay', 'dep', 'giay da', 'footwear', 'shoe', 'boot', 'sandal'],
  },
];

// ============================================================
// LOGIC GAN KENH KIEM TRA (GREEN / YELLOW / RED)
// ============================================================

export type CustomsChannel = 'GREEN' | 'YELLOW' | 'RED';

/**
 * Tinh kenh kiem tra dua tren hash don gian cua so to khai.
 *
 * Phan phoi thong ke:
 *   - GREEN  : 70% (thong quan tu dong)
 *   - YELLOW : 20% (kiem tra ho so giay to)
 *   - RED    : 10% (kiem tra thuc te hang hoa)
 *
 * Thuat toan: lay tong ASCII codes % 100 -> phan vung.
 * Nhat quan: cung input -> cung output (deterministic mock).
 */
export function assignMockChannel(declarationNumber: string): CustomsChannel {
  let hash = 0;
  for (let i = 0; i < declarationNumber.length; i++) {
    hash = (hash + declarationNumber.charCodeAt(i) * (i + 1)) % 100;
  }

  if (hash < 70) return 'GREEN';
  if (hash < 90) return 'YELLOW';
  return 'RED';
}

/**
 * Sinh so to khai VNACCS gia lap theo dinh dang thuc te.
 *
 * Dinh dang VNACCS that: {ma_hai_quan}{nam}{so_thu_tu_6chu}
 * Vi du that: 01HCM202600012345
 * Vi du mock: MOCK-01HCM-20260311-7823
 */
export function generateMockDeclarationNumber(customsOfficeCode?: string): string {
  const office = customsOfficeCode || '01HCM';
  const date = new Date();
  const yyyymmdd =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `MOCK-${office}-${yyyymmdd}-${seq}`;
}

/**
 * Sinh so manifest gia lap.
 * Dinh dang: MF-{YYYYMMDD}-{4 so ngau nhien}
 */
export function generateMockManifestNumber(portCode?: string): string {
  const port = portCode || 'VNHPH';
  const date = new Date();
  const yyyymmdd =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `MOCK-MF-${port}-${yyyymmdd}-${seq}`;
}

/**
 * Tim bang ghi HS code trong bang mock.
 * Tra ve undefined neu khong tim thay.
 */
export function findHSEntry(hsCode: string): MockHSEntry | undefined {
  // Chuan hoa: cat bo so 0 thua o cuoi, nhom lai theo dau cham
  const normalized = hsCode.trim().replace(/\s+/g, '');
  return MOCK_HS_TABLE.find(
    (entry) =>
      entry.code === normalized ||
      entry.code.replace(/\./g, '') === normalized.replace(/\./g, ''),
  );
}

/**
 * Tim tat ca HS entry co tu khoa khop voi mo ta hang hoa.
 * Tra ve mang sap xep theo diem so (tuong thich tu khoa tot nhat truoc).
 */
export function searchHSByKeyword(keyword: string): Array<MockHSEntry & { score: number }> {
  const lower = keyword.toLowerCase().trim();
  const tokens = lower
    .split(/[\s,/\-_]+/)
    .filter((t) => t.length >= 2);

  const scored = MOCK_HS_TABLE.map((entry) => {
    let score = 0;

    // Khop tren code chinh xac
    if (entry.code.startsWith(lower)) score += 100;

    // Khop trong descriptionVi
    if (entry.descriptionVi.toLowerCase().includes(lower)) score += 30;

    // Khop trong descriptionEn
    if (entry.descriptionEn.toLowerCase().includes(lower)) score += 20;

    // Dem so tu khoa khop
    for (const token of tokens) {
      if (entry.keywords.some((kw) => kw.includes(token) || token.includes(kw))) {
        score += 10;
      }
    }

    return { ...entry, score };
  });

  return scored.filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
}

// ============================================================
// TY GIA MAC DINH (fallback khi khong co exchange rate service)
// ============================================================

/** Ty gia USD -> VND mac dinh dung cho tinh thue mock */
export const DEFAULT_USD_VND_RATE = 25_400;

/** Ty gia CNY -> VND mac dinh */
export const DEFAULT_CNY_VND_RATE = 3_520;

/** Ty gia EUR -> VND mac dinh */
export const DEFAULT_EUR_VND_RATE = 27_800;

/**
 * Quy doi gia tri sang VND dua tren ti gia mac dinh.
 * Tra ve gia tri VND; neu currency la VND thi giu nguyen.
 */
export function convertToVnd(amount: number, currency: string): number {
  switch (currency.toUpperCase()) {
    case 'VND':
      return amount;
    case 'USD':
      return amount * DEFAULT_USD_VND_RATE;
    case 'CNY':
    case 'RMB':
      return amount * DEFAULT_CNY_VND_RATE;
    case 'EUR':
      return amount * DEFAULT_EUR_VND_RATE;
    default:
      // Fallback: dung ty gia USD neu khong biet currency
      return amount * DEFAULT_USD_VND_RATE;
  }
}

// ============================================================
// THONG TIN CUA KHAU PHO BIEN (VN)
// ============================================================

export const MOCK_CUSTOMS_OFFICES: Record<string, string> = {
  '01HCM': 'Cuc Hai quan TP Ho Chi Minh',
  '02HAN': 'Cuc Hai quan TP Ha Noi',
  '03HPH': 'Cuc Hai quan Hai Phong',
  '04DNG': 'Cuc Hai quan Da Nang',
  '05QNI': 'Cuc Hai quan Quang Ninh',
  '06LCA': 'Cuc Hai quan Lang Son',
  '07LSN': 'Cuc Hai quan Lao Cai',
};

/** Lay ten cua khau; neu khong co thi tra ve code goc */
export function getCustomsOfficeName(code: string): string {
  return MOCK_CUSTOMS_OFFICES[code] ?? `Hai quan ${code}`;
}
