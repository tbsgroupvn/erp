import { IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Loai bao cao tai chinh theo chuan muc ke toan Viet Nam (VAS)
export enum VasReportType {
  B01_DN = 'B01_DN', // Bang can doi ke toan
  B02_DN = 'B02_DN', // Bao cao ket qua hoat dong kinh doanh
  B03_DN = 'B03_DN', // Bao cao luu chuyen tien te
  B09_DN = 'B09_DN', // Thuyet minh bao cao tai chinh
}

export class VasReportQueryDto {
  @ApiProperty({
    description: 'Loai bao cao VAS (B01_DN: Bang can doi ke toan, B02_DN: Ket qua kinh doanh, B03_DN: Luu chuyen tien te)',
    enum: VasReportType,
    example: VasReportType.B01_DN,
  })
  @IsEnum(VasReportType)
  type: VasReportType;

  @ApiProperty({
    description: 'Tu ngay (dinh dang ISO 8601)',
    example: '2026-01-01',
  })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({
    description: 'Den ngay (dinh dang ISO 8601)',
    example: '2026-12-31',
  })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    description: 'Ma chi nhanh (bo trong = toan cong ty)',
    example: 'HCM',
  })
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({
    description: 'Tu ngay ky so sanh (de hien thi so lieu ky truoc ben canh ky hien tai)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  compareDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Den ngay ky so sanh',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  compareDateTo?: string;
}

// ============================================
// B01-DN: Bang can doi ke toan
// ============================================

// Mot dong trong bang can doi ke toan
export interface BalanceSheetItem {
  accountCode: string;
  accountName: string;
  openingBalance: number;  // So du dau ky
  closingBalance: number;  // So du cuoi ky
  note?: string;
}

// Ket qua bao cao B01-DN
export interface BalanceSheetReport {
  type: 'B01_DN';
  period: { from: string; to: string };
  taiSanNganHan: BalanceSheetItem[];   // Tai san ngan han (TK 1xx)
  taiSanDaiHan: BalanceSheetItem[];    // Tai san dai han (TK 2xx)
  tongTaiSan: number;                  // Tong tai san (A + B)
  noPhaiTra: BalanceSheetItem[];       // No phai tra (TK 3xx)
  vonChuSoHuu: BalanceSheetItem[];     // Von chu so huu (TK 4xx)
  tongNguonVon: number;                // Tong nguon von (I + II)
  previousPeriod?: BalanceSheetReport; // Bao cao ky so sanh (neu co compareDateFrom)
  changePercent?: Record<string, number | null>; // % thay doi so du cuoi ky theo accountCode
}

// ============================================
// B02-DN: Bao cao ket qua hoat dong kinh doanh
// ============================================

// Mot chi tiet dong trong B02
export interface IncomeStatementItem {
  code: string;     // Ma chi tieu (VD: 01, 02, 10...)
  label: string;    // Ten chi tieu tieng Viet
  amount: number;   // So tien
  note?: string;
}

// Ket qua bao cao B02-DN
export interface IncomeStatementReport {
  type: 'B02_DN';
  period: { from: string; to: string };
  doanhThuBanHang: number;        // Ma 01 - Doanh thu ban hang va cung cap dich vu (TK 511, 512)
  giaVonHangBan: number;          // Ma 11 - Gia von hang ban (TK 632)
  loiNhuanGop: number;            // Ma 20 - Loi nhuan gop = DT - GV
  chiPhiBanHang: number;          // Ma 25 - Chi phi ban hang (TK 641)
  chiPhiQuanLy: number;           // Ma 26 - Chi phi quan ly doanh nghiep (TK 642)
  loiNhuanThuanHDKD: number;      // Ma 30 - Loi nhuan thuan tu HDKD
  doanhThuTaiChinh: number;       // Ma 21 - Doanh thu hoat dong tai chinh (TK 515, 711)
  chiPhiTaiChinh: number;         // Ma 22 - Chi phi tai chinh (TK 635, 811)
  loiNhuanTruocThue: number;      // Ma 50 - Loi nhuan truoc thue
  thueThueNhapDN: number;         // Ma 51 - Thue thu nhap doanh nghiep (TK 821)
  loiNhuanSauThue: number;        // Ma 60 - Loi nhuan sau thue
  chiTiet: IncomeStatementItem[]; // Danh sach cac dong chi tiet
  previousPeriod?: IncomeStatementReport;        // Ky so sanh (neu co)
  changePercent?: Record<string, number | null>; // % thay doi theo ma chi tieu (code)
}

// ============================================
// B03-DN: Bao cao luu chuyen tien te
// ============================================

// Ket qua bao cao B03-DN (phuong phap truc tiep)
export interface CashFlowReport {
  type: 'B03_DN';
  period: { from: string; to: string };
  luuChuyenTuHDKD: number;   // I. Luu chuyen tien tu hoat dong kinh doanh (TK 111, 112 trong ky)
  luuChuyenTuHDDT: number;   // II. Luu chuyen tien tu hoat dong dau tu (TK 211, 221, 241)
  luuChuyenTuHDTC: number;   // III. Luu chuyen tien tu hoat dong tai chinh (TK 341, 411)
  tangGiamTienRong: number;  // Tong tang/giam tien rong trong ky (I + II + III)
  tienDauKy: number;         // Tien va tuong duong tien dau ky
  tienCuoiKy: number;        // Tien va tuong duong tien cuoi ky
  previousPeriod?: CashFlowReport;               // Ky so sanh (neu co)
  changePercent?: Record<string, number | null>; // % thay doi tung khoan muc
}

// Union type cua tat ca ket qua co the tra ve
export type VasReportResult = BalanceSheetReport | IncomeStatementReport | CashFlowReport;
