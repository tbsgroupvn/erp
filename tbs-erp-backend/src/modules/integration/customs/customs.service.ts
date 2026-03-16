import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomsDeclarationDto } from './dto/customs-declaration.dto';
import { ManifestDto } from './dto/manifest.dto';
import { DutyCalculationDto } from './dto/duty-calculation.dto';
import {
  CustomsResponse,
  DeclarationStatus,
  HSCodeResult,
  ManifestResponse,
  DutyResult,
} from './interfaces/customs.interfaces';
import {
  assignMockChannel,
  convertToVnd,
  DEFAULT_USD_VND_RATE,
  findHSEntry,
  generateMockDeclarationNumber,
  generateMockManifestNumber,
  getCustomsOfficeName,
  MOCK_HS_TABLE,
  searchHSByKeyword,
} from './vnaccs-mock-data';

/**
 * Service tich hop he thong hai quan VNACCS/VCIS.
 *
 * VNACCS = Vietnam Automated Cargo Clearance System
 * VCIS   = Vietnam Customs Intelligence System
 *
 * TRANG THAI HIEN TAI: CHE DO MOCK (stub)
 * ==========================================
 * Tat ca cac method hien tai tra ve du lieu gia lap vi:
 *   - Chua co chung thu so (digital certificate) tu Tong cuc Hai quan
 *   - Chua duoc cap tai khoan sandbox VNACCS
 *   - API endpoint VNACCS that chi hoat dong trong moi truong noi bo hai quan
 *
 * DE LOI KIEN TRUC:
 *   De thay the stub bang real implementation, chi can thay the noi dung
 *   cac method ben duoi. Interface dau vao / dau ra khong thay doi.
 *
 * TAI LIEU THAM KHAO:
 *   - Quyet dinh 3074/QD-TCHQ ve trien khai VNACCS/VCIS
 *   - Thong tu 38/2015/TT-BTC (thu tuc hai quan dien tu)
 *   - API spec VNACCS v2.1 (can tai khoan noi bo de truy cap)
 */
@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name);
  private readonly vnaccsUrl: string;
  private readonly vnaccsKey: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.vnaccsUrl = this.configService.get<string>('integrations.customs.vnaccsUrl', '');
    this.vnaccsKey = this.configService.get<string>('integrations.customs.vnaccsKey', '');
    this.enabled = this.configService.get<boolean>('integrations.customs.enabled', false);

    if (!this.enabled) {
      this.logger.warn(
        '[MOCK MODE] VNACCS integration dang chay o che do mock. ' +
          'Set CUSTOMS_INTEGRATION_ENABLED=true de bat ket noi that.',
      );
    }
  }

  // ============================================================
  // NOP TO KHAI HAI QUAN
  // ============================================================

  /**
   * Nop to khai hai quan len he thong VNACCS.
   *
   * [MOCK] Tao so to khai gia lap, gan kenh kiem tra ngau nhien,
   * log thong tin de chuan bi cho real implementation.
   *
   * Real implementation can:
   *   1. Chuyen doi DTO sang XML format VNACCS (SOAP/REST)
   *   2. Ky so voi chung thu so PKI
   *   3. Gui len endpoint VNACCS
   *   4. Parse phan hoi XML -> CustomsResponse
   */
  async submitDeclaration(dto: CustomsDeclarationDto): Promise<CustomsResponse> {
    this.logger.log(
      `[MOCK] VNACCS MOCK: Nop to khai hai quan ` +
        `loai=${dto.declarationType} | ma so thue=${dto.taxCode} | ` +
        `cua khau=${dto.customsOfficeCode} | so mat hang=${dto.items.length} | ` +
        `tong gia tri=${dto.totalInvoiceValue} ${dto.currency}`,
    );

    // Tinh CIF tong (Cost + Insurance + Freight)
    const cifTotal = dto.totalInvoiceValue + dto.freightCost + dto.insuranceCost;
    const cifVnd = convertToVnd(cifTotal, dto.currency);

    this.logger.debug(
      `[MOCK] To khai: BL/AWB=${dto.blAwbNumber} | container=${dto.containerNumbers.join(',')} | ` +
        `cang xep=${dto.portOfLoading} -> cang do=${dto.portOfDischarge} | ` +
        `CIF=${cifTotal} ${dto.currency} (~${cifVnd.toLocaleString('vi-VN')} VND)`,
    );

    // Log tung mat hang de chuan bi du lieu
    dto.items.forEach((item, idx) => {
      this.logger.debug(
        `[MOCK]   Mat hang #${idx + 1}: HS=${item.hsCode} | ` +
          `mo ta="${item.description}" | so luong=${item.quantity} ${item.unit} | ` +
          `don gia=${item.unitPrice} | tong=${item.totalValue} ${dto.currency}`,
      );
    });

    // Sinh so to khai gia lap
    const declarationNumber = generateMockDeclarationNumber(dto.customsOfficeCode);
    const referenceId = `REF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const channel = assignMockChannel(declarationNumber);
    const officeName = getCustomsOfficeName(dto.customsOfficeCode);

    this.logger.log(
      `[MOCK] To khai da duoc nop thanh cong: so=${declarationNumber} | ` +
        `kenh=${channel} | cua khau=${officeName}`,
    );

    return {
      referenceId,
      declarationNumber,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      messages: [
        `[MOCK] To khai ${declarationNumber} da duoc nop thanh cong`,
        `[MOCK] Kenh kiem tra: ${channel} - ${this._channelDescription(channel)}`,
        `[MOCK] Cua khau xu ly: ${officeName}`,
        `[MOCK] Du lieu nay la gia lap. Can digital certificate de ket noi VNACCS that.`,
      ],
    };
  }

  // ============================================================
  // TRA CUU TRANG THAI TO KHAI
  // ============================================================

  /**
   * Tra cuu trang thai to khai hai quan trong VNACCS/VCIS.
   *
   * [MOCK] Xac dinh trang thai dua tren pattern so to khai.
   * - So co MOCK-: tra ve trang thai gia lap deterministic
   * - So that (khong co MOCK-): gia su dang xu ly
   *
   * Real implementation can:
   *   1. Gui query co so to khai len VNACCS
   *   2. Parse phan hoi: trang thai, kenh, so thue phai nop
   *   3. Dong bo vao bang CustomsDeclaration trong DB
   */
  async getDeclarationStatus(declarationId: string): Promise<DeclarationStatus> {
    this.logger.log(
      `[MOCK] VNACCS MOCK: Tra cuu trang thai to khai declarationId=${declarationId}`,
    );

    const isMock = declarationId.startsWith('MOCK-');
    const channel = assignMockChannel(declarationId);
    const now = new Date();

    // Tinh thoi gian gia lap dua tren kenh
    const hoursAgo = channel === 'GREEN' ? 2 : channel === 'YELLOW' ? 24 : 72;
    const clearedAt = new Date(now.getTime() - hoursAgo * 3_600_000);

    let status: DeclarationStatus['status'];
    let remarks: string;

    if (channel === 'GREEN') {
      status = 'RELEASED';
      remarks = '[MOCK] To khai kenh xanh - thong quan tu dong, khong can kiem tra them';
    } else if (channel === 'YELLOW') {
      status = 'UNDER_REVIEW';
      remarks =
        '[MOCK] To khai kenh vang - dang kiem tra ho so giay to, can bo sung chung tu neu thieu';
    } else {
      status = 'UNDER_REVIEW';
      remarks =
        '[MOCK] To khai kenh do - yeu cau kiem tra thuc te hang hoa, lien he hai quan de dat lich kiem tra';
    }

    this.logger.log(
      `[MOCK] Trang thai to khai ${declarationId}: status=${status} | kenh=${channel} | ` +
        `${isMock ? 'du lieu gia lap' : 'so that - khong co trong VNACCS mock'}`,
    );

    return {
      declarationId,
      declarationNumber: declarationId,
      status,
      channel,
      customsOffice: '01HCM',
      taxAmount: isMock ? Math.round(Math.random() * 5_000_000 + 500_000) : undefined,
      dutyAmount: isMock ? Math.round(Math.random() * 3_000_000 + 200_000) : undefined,
      updatedAt: clearedAt,
      remarks,
    };
  }

  // ============================================================
  // TRA CUU MA HS
  // ============================================================

  /**
   * Tra cuu ma HS (Harmonized System) theo tu khoa.
   * Tim kiem trong bieu thue Viet Nam.
   *
   * [MOCK] Tim kiem trong bang MOCK_HS_TABLE (25 nhom hang pho bien).
   * Tra ve cac ket qua khop tot nhat theo diem so.
   *
   * Real implementation can:
   *   1. Query VCIS API endpoint /tariff/search?keyword=...
   *   2. Parse phan hoi JSON voi toan bo bieu thue 8+ chu so
   *   3. Tra ve kem thue suat uu dai ACFTA/CPTPP/EVFTA neu co C/O
   */
  async lookupHSCode(keyword: string): Promise<HSCodeResult[]> {
    this.logger.log(`[MOCK] VNACCS MOCK: Tra cuu ma HS voi tu khoa="${keyword}"`);

    if (!keyword || keyword.trim().length < 2) {
      this.logger.warn(`[MOCK] Tu khoa tra cuu HS qua ngan: "${keyword}"`);
      return [];
    }

    const matches = searchHSByKeyword(keyword);

    if (matches.length === 0) {
      this.logger.debug(
        `[MOCK] Khong tim thay ma HS nao khop voi "${keyword}" trong bang mock. ` +
          `Thu cac tu khoa: hang hoa, ten san pham cu the hon.`,
      );
      // Tra ve top 3 pho bien nhat lam fallback
      return MOCK_HS_TABLE.slice(0, 3).map((entry) => this._toHSCodeResult(entry));
    }

    const top10 = matches.slice(0, 10);
    this.logger.log(
      `[MOCK] Tim thay ${matches.length} ma HS khop voi "${keyword}", tra ve top ${top10.length}`,
    );

    return top10.map((entry) => this._toHSCodeResult(entry));
  }

  // ============================================================
  // NOP E-MANIFEST
  // ============================================================

  /**
   * Nop e-Manifest (bang ke khai hang hoa) cho tau/may bay den.
   * Bat buoc doi voi moi lo hang thuong mai nhap vao Viet Nam.
   *
   * [MOCK] Tao so manifest gia lap, tinh tong trong luong va so kien.
   *
   * Real implementation can:
   *   1. Format du lieu theo chuan XML e-Manifest cua VNACCS
   *   2. Xac thuc bang tai khoan hang tau / hang khong
   *   3. Gui len endpoint /emanifest/submit
   *   4. Nhan so manifest chinh thuc
   */
  async submitManifest(dto: ManifestDto): Promise<ManifestResponse> {
    const totalPackages = dto.items.reduce((sum, item) => sum + item.numberOfPackages, 0);
    const totalWeightKg = dto.items.reduce((sum, item) => sum + item.grossWeightKg, 0);
    const totalCbm = dto.items.reduce((sum, item) => sum + item.volumeCbm, 0);

    this.logger.log(
      `[MOCK] VNACCS MOCK: Nop e-Manifest ` +
        `loai=${dto.manifestType} | phuong tien=${dto.vesselName} | ` +
        `chuyen hang=${dto.voyageNumber} | so BL=${dto.items.length} | ` +
        `tong kien=${totalPackages} | tong KG=${totalWeightKg.toFixed(1)} | ` +
        `tong CBM=${totalCbm.toFixed(2)}`,
    );

    this.logger.debug(
      `[MOCK] Chi tiet manifest: hang tau=${dto.carrierName} | ` +
        `cang xep=${dto.portOfLoading} -> cang do=${dto.portOfDischarge} | ` +
        `ETA=${dto.estimatedArrivalDate}`,
    );

    dto.items.forEach((item, idx) => {
      this.logger.debug(
        `[MOCK]   BL #${idx + 1}: ${item.blNumber} | nguoi nhan=${item.consigneeName} | ` +
          `hang hoa="${item.goodsDescription}" | ${item.numberOfPackages} kien / ${item.grossWeightKg} KG`,
      );
    });

    const manifestNumber = generateMockManifestNumber(dto.portOfDischarge);
    const referenceId = `REF-MF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    this.logger.log(
      `[MOCK] e-Manifest da duoc chap nhan: so=${manifestNumber} | ` +
        `${dto.items.length} BL | ${totalPackages} kien | ${totalWeightKg.toFixed(1)} KG`,
    );

    return {
      referenceId,
      manifestNumber,
      status: 'ACCEPTED',
      totalItems: dto.items.length,
      submittedAt: new Date(),
      errors: [],
    };
  }

  // ============================================================
  // TINH THUE NHAP KHAU
  // ============================================================

  /**
   * Tinh thue nhap khau va cac loai thue khac dua tren ma HS va gia tri CIF.
   *
   * [MOCK] Tra cuu thue suat trong MOCK_HS_TABLE.
   * - Ap dung thue ACFTA neu xuat xu CN (Trung Quoc)
   * - Ap dung thue MFN cho cac nuoc khac
   * - VAT 10% tren (CIF + thue NK)
   *
   * Real implementation can:
   *   1. Query VCIS tariff API: thue suat chinh xac 8 chu so
   *   2. Kiem tra C/O de xac dinh thue suat uu dai
   *   3. Tinh thue tieu thu dac biet (neu hang co TTDB)
   *   4. Lay ty gia chinh thuc tu NHNN cung ngay
   *   5. Tra ve phan tich tung dong tren to khai
   */
  async calculateDuty(dto: DutyCalculationDto): Promise<DutyResult> {
    this.logger.log(
      `[MOCK] VNACCS MOCK: Tinh thue nhap khau ` +
        `HS=${dto.hsCode} | CIF=${dto.cifValue} ${dto.currency} | ` +
        `xuat xu=${dto.countryOfOrigin ?? 'khong xac dinh'} | ` +
        `so luong=${dto.quantity ?? 'khong co'} ${dto.unit ?? ''}`,
    );

    // Lay ty gia: dung ty gia client truyen vao neu co, fallback sang mac dinh
    const exchangeRate = dto.exchangeRate ?? this._getDefaultRate(dto.currency);
    const cifValueVnd = dto.currency.toUpperCase() === 'VND'
      ? dto.cifValue
      : dto.cifValue * exchangeRate;

    this.logger.debug(
      `[MOCK] Ty gia su dung: 1 ${dto.currency} = ${exchangeRate.toLocaleString('vi-VN')} VND | ` +
        `CIF quy VND = ${cifValueVnd.toLocaleString('vi-VN')}`,
    );

    // Tim thong tin HS trong bang mock
    const hsEntry = findHSEntry(dto.hsCode);

    // Xac dinh thue suat nhap khau ap dung
    // ACFTA (ASEAN-China FTA) ap dung cho xuat xu Trung Quoc
    const isChineseOrigin = ['CN', 'CHN', 'CHINA'].includes(
      (dto.countryOfOrigin ?? '').toUpperCase(),
    );

    let importDutyRate: number;
    if (hsEntry) {
      importDutyRate = isChineseOrigin ? hsEntry.dutyRateAcfta : hsEntry.dutyRateMfn;
      this.logger.debug(
        `[MOCK] Tim thay HS ${dto.hsCode}: ${hsEntry.descriptionVi} | ` +
          `Thue MFN=${(hsEntry.dutyRateMfn * 100).toFixed(0)}% | ` +
          `Thue ACFTA=${(hsEntry.dutyRateAcfta * 100).toFixed(0)}% | ` +
          `Ap dung: ${isChineseOrigin ? 'ACFTA' : 'MFN'}`,
      );
    } else {
      // HS khong co trong bang mock: dung thue suat trung binh 10%
      importDutyRate = 0.1;
      this.logger.warn(
        `[MOCK] Khong tim thay HS ${dto.hsCode} trong bang mock. ` +
          `Dung thue suat mac dinh 10%. Ket qua chi mang tinh tham khao.`,
      );
    }

    // Tinh thue tieu thu dac biet (TTDB)
    const specialTaxRate = hsEntry?.specialTaxRate ?? 0;
    const environmentalTaxVnd = (hsEntry?.environmentalTaxVnd ?? 0) * (dto.quantity ?? 0);
    const antiDumpingRate = hsEntry?.antiDumpingRate ?? 0;

    // Cong thuc tinh thue theo luat Viet Nam:
    //   Thue NK    = CIF (VND) x thue suat NK
    //   Thue TTDB  = (CIF + Thue NK) x thue suat TTDB
    //   Thue BVMT  = Don vi x muc thu (neu co)
    //   Thue chong ban pha gia = CIF x thue suat
    //   Gia tinh VAT = CIF + Thue NK + Thue TTDB + Thue chong ban pha gia
    //   VAT = Gia tinh VAT x 10%
    const importDuty = Math.round(cifValueVnd * importDutyRate);
    const specialConsumptionTax = Math.round((cifValueVnd + importDuty) * specialTaxRate);
    const antiDumpingDuty = Math.round(cifValueVnd * antiDumpingRate);
    const vatBase = cifValueVnd + importDuty + specialConsumptionTax + antiDumpingDuty;
    const vatRate = 0.1;
    const vat = Math.round(vatBase * vatRate);
    const environmentalTax = Math.round(environmentalTaxVnd);
    const totalPayable = importDuty + specialConsumptionTax + antiDumpingDuty + environmentalTax + vat;

    this.logger.log(
      `[MOCK] Ket qua tinh thue HS ${dto.hsCode}: ` +
        `NK=${importDuty.toLocaleString('vi-VN')} | ` +
        `TTDB=${specialConsumptionTax.toLocaleString('vi-VN')} | ` +
        `VAT=${vat.toLocaleString('vi-VN')} | ` +
        `Tong=${totalPayable.toLocaleString('vi-VN')} VND`,
    );

    return {
      hsCode: dto.hsCode,
      cifValueVnd,
      importDuty,
      importDutyRate,
      specialConsumptionTax,
      vat,
      vatRate,
      environmentalTax,
      antiDumpingDuty,
      totalPayable,
      exchangeRate: dto.currency.toUpperCase() !== 'VND' ? exchangeRate : undefined,
      originalCurrency: dto.currency.toUpperCase() !== 'VND' ? dto.currency : undefined,
      originalCifValue: dto.currency.toUpperCase() !== 'VND' ? dto.cifValue : undefined,
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /** Mo ta text cho tung kenh kiem tra */
  private _channelDescription(channel: 'GREEN' | 'YELLOW' | 'RED'): string {
    switch (channel) {
      case 'GREEN':
        return 'Thong quan tu dong, khong can kiem tra them (chiem ~70% to khai)';
      case 'YELLOW':
        return 'Kiem tra ho so giay to truoc khi thong quan (chiem ~20%)';
      case 'RED':
        return 'Kiem tra thuc te hang hoa, xe may tinh thue (chiem ~10%)';
    }
  }

  /** Lay ty gia mac dinh theo currency code */
  private _getDefaultRate(currency: string): number {
    switch (currency.toUpperCase()) {
      case 'USD':
        return DEFAULT_USD_VND_RATE;
      case 'CNY':
      case 'RMB':
        return 3_520;
      case 'EUR':
        return 27_800;
      case 'JPY':
        return 165;
      case 'KRW':
        return 18;
      case 'SGD':
        return 19_200;
      case 'THB':
        return 700;
      case 'VND':
        return 1;
      default:
        this.logger.warn(
          `[MOCK] Khong co ty gia mac dinh cho ${currency}, su dung USD rate`,
        );
        return DEFAULT_USD_VND_RATE;
    }
  }

  /** Chuyen doi MockHSEntry sang HSCodeResult interface */
  private _toHSCodeResult(
    entry: (typeof MOCK_HS_TABLE)[number] & { score?: number },
  ): HSCodeResult {
    return {
      code: entry.code,
      descriptionVi: entry.descriptionVi,
      descriptionEn: entry.descriptionEn,
      importDutyRate: entry.dutyRateMfn,
      vatRate: entry.vatRate,
      specialTariffRate: entry.dutyRateAcfta < entry.dutyRateMfn
        ? entry.dutyRateAcfta
        : undefined,
      unit: entry.unit,
      requiresPermit: entry.requiresPermit,
    };
  }
}
