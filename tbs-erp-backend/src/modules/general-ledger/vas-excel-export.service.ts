import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  VasReportResult,
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowReport,
} from './dto/vas-report.dto';

// Ten cong ty hien thi tren header bao cao
const COMPANY_NAME = 'CONG TY TNHH THUONG MAI & VAN TAI TBS';
const COMPANY_ADDRESS = '123 Nguyen Van Linh, TP.HCM';

// Mau sac theo chuan kế toan VN
const COLOR_HEADER_BG = 'FF1F4E78';   // Xanh dam (header cong ty)
const COLOR_TITLE_BG = 'FF2E75B6';   // Xanh vua (tieu de bang)
const COLOR_GROUP_BG = 'FFDAE3F3';   // Xanh nhat (dong nhom)
const COLOR_ALT_ROW = 'FFF2F2F2';    // Xam nhat (dong xen ke)
const COLOR_TOTAL_BG = 'FFFFEB9C';   // Vang nhat (dong tong cong)

/**
 * Service export bao cao tai chinh VAS ra file Excel.
 * Ho tro 3 loai bao cao: B01-DN, B02-DN, B03-DN.
 * Format so theo chuan VN: dau cham ngan cach nghin, don vi VND.
 */
@Injectable()
export class VasExcelExportService {
  private readonly logger = new Logger(VasExcelExportService.name);

  /**
   * Tao workbook Excel cho bao cao VAS va tra ve Buffer de stream ve client.
   */
  async exportToExcel(report: VasReportResult): Promise<Buffer> {
    this.logger.log(`Bat dau export Excel bao cao ${report.type}`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TBS ERP System';
    workbook.lastModifiedBy = 'TBS ERP System';
    workbook.created = new Date();
    workbook.modified = new Date();

    switch (report.type) {
      case 'B01_DN':
        this.buildBalanceSheetSheet(workbook, report as BalanceSheetReport);
        break;
      case 'B02_DN':
        this.buildIncomeStatementSheet(workbook, report as IncomeStatementReport);
        break;
      case 'B03_DN':
        this.buildCashFlowSheet(workbook, report as CashFlowReport);
        break;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.log(`Export Excel hoan tat: ${report.type}, size=${buffer.byteLength} bytes`);
    return Buffer.from(buffer);
  }

  // ============================================================
  // B01-DN: Bang can doi ke toan
  // ============================================================

  private buildBalanceSheetSheet(workbook: ExcelJS.Workbook, report: BalanceSheetReport): void {
    const sheet = workbook.addWorksheet('B01-DN BANG CAN DOI', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // Do rong cot
    sheet.columns = [
      { width: 10 },  // Ma TK
      { width: 45 },  // Ten tai khoan
      { width: 22 },  // So du dau ky
      { width: 22 },  // So du cuoi ky
    ];

    let row = 1;

    // --- Header cong ty ---
    this.addCompanyHeader(sheet, row, 4, report.period);
    row += 3;

    // --- Tieu de bao cao ---
    this.mergeAndSetTitle(sheet, row, 1, 4, 'BANG CAN DOI KE TOAN', 16);
    row++;
    this.mergeAndSetTitle(
      sheet, row, 1, 4,
      `Mau B01-DN (Theo TT 200/2014/TT-BTC) - Ky tu ${report.period.from} den ${report.period.to}`,
      11,
    );
    row += 2;

    // --- Header bang ---
    this.setHeaderRow(sheet, row, ['Ma TK', 'Ten tai khoan', 'So du dau ky (VND)', 'So du cuoi ky (VND)']);
    row++;

    // --- PHAN A: TAI SAN ---
    this.setGroupRow(sheet, row, 'A. TAI SAN', 4);
    row++;

    this.setGroupRow(sheet, row, 'I. Tai san ngan han (TK 1xx)', 4);
    row++;
    for (let i = 0; i < report.taiSanNganHan.length; i++) {
      const item = report.taiSanNganHan[i];
      this.setDataRow(sheet, row, [
        item.accountCode,
        item.accountName,
        item.openingBalance,
        item.closingBalance,
      ], i % 2 === 1);
      row++;
    }
    const tongNganHanOpen = report.taiSanNganHan.reduce((s, i) => s + i.openingBalance, 0);
    const tongNganHanClose = report.taiSanNganHan.reduce((s, i) => s + i.closingBalance, 0);
    this.setTotalRow(sheet, row, 'Cong tai san ngan han', tongNganHanOpen, tongNganHanClose);
    row++;

    this.setGroupRow(sheet, row, 'II. Tai san dai han (TK 2xx)', 4);
    row++;
    for (let i = 0; i < report.taiSanDaiHan.length; i++) {
      const item = report.taiSanDaiHan[i];
      this.setDataRow(sheet, row, [
        item.accountCode,
        item.accountName,
        item.openingBalance,
        item.closingBalance,
      ], i % 2 === 1);
      row++;
    }
    const tongDaiHanOpen = report.taiSanDaiHan.reduce((s, i) => s + i.openingBalance, 0);
    const tongDaiHanClose = report.taiSanDaiHan.reduce((s, i) => s + i.closingBalance, 0);
    this.setTotalRow(sheet, row, 'Cong tai san dai han', tongDaiHanOpen, tongDaiHanClose);
    row++;

    this.setGrandTotalRow(sheet, row, 'TONG TAI SAN (A = I + II)', 0, report.tongTaiSan);
    row += 2;

    // --- PHAN B: NGUON VON ---
    this.setGroupRow(sheet, row, 'B. NGUON VON', 4);
    row++;

    this.setGroupRow(sheet, row, 'I. No phai tra (TK 3xx)', 4);
    row++;
    for (let i = 0; i < report.noPhaiTra.length; i++) {
      const item = report.noPhaiTra[i];
      this.setDataRow(sheet, row, [
        item.accountCode,
        item.accountName,
        Math.abs(item.openingBalance),
        Math.abs(item.closingBalance),
      ], i % 2 === 1);
      row++;
    }
    const tongNPTOpen = report.noPhaiTra.reduce((s, i) => s + Math.abs(i.openingBalance), 0);
    const tongNPTClose = report.noPhaiTra.reduce((s, i) => s + Math.abs(i.closingBalance), 0);
    this.setTotalRow(sheet, row, 'Cong no phai tra', tongNPTOpen, tongNPTClose);
    row++;

    this.setGroupRow(sheet, row, 'II. Von chu so huu (TK 4xx)', 4);
    row++;
    for (let i = 0; i < report.vonChuSoHuu.length; i++) {
      const item = report.vonChuSoHuu[i];
      this.setDataRow(sheet, row, [
        item.accountCode,
        item.accountName,
        Math.abs(item.openingBalance),
        Math.abs(item.closingBalance),
      ], i % 2 === 1);
      row++;
    }
    const tongVCSHOpen = report.vonChuSoHuu.reduce((s, i) => s + Math.abs(i.openingBalance), 0);
    const tongVCSHClose = report.vonChuSoHuu.reduce((s, i) => s + Math.abs(i.closingBalance), 0);
    this.setTotalRow(sheet, row, 'Cong von chu so huu', tongVCSHOpen, tongVCSHClose);
    row++;

    this.setGrandTotalRow(sheet, row, 'TONG NGUON VON (B = I + II)', 0, report.tongNguonVon);
  }

  // ============================================================
  // B02-DN: Bao cao ket qua kinh doanh
  // ============================================================

  private buildIncomeStatementSheet(workbook: ExcelJS.Workbook, report: IncomeStatementReport): void {
    const sheet = workbook.addWorksheet('B02-DN KET QUA KD', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    });

    sheet.columns = [
      { width: 8 },   // Ma chi tieu
      { width: 55 },  // Chi tieu
      { width: 28 },  // So tien (VND)
    ];

    let row = 1;

    this.addCompanyHeader(sheet, row, 3, report.period);
    row += 3;

    this.mergeAndSetTitle(sheet, row, 1, 3, 'BAO CAO KET QUA HOAT DONG KINH DOANH', 16);
    row++;
    this.mergeAndSetTitle(
      sheet, row, 1, 3,
      `Mau B02-DN (Theo TT 200/2014/TT-BTC) - Ky tu ${report.period.from} den ${report.period.to}`,
      11,
    );
    row += 2;

    // So sanh ky
    const hasPrev = (report as any).previousPeriod !== undefined;
    if (hasPrev) {
      sheet.columns = [
        { width: 8 },   // Ma chi tieu
        { width: 45 },  // Chi tieu
        { width: 22 },  // Ky nay
        { width: 22 },  // Ky truoc
        { width: 16 },  // Thay doi %
      ];
      this.setHeaderRow(sheet, row, ['Ma', 'Chi tieu', 'Ky nay (VND)', 'Ky truoc (VND)', '+/- %']);
    } else {
      this.setHeaderRow(sheet, row, ['Ma', 'Chi tieu', 'So tien (VND)']);
    }
    row++;

    for (let i = 0; i < report.chiTiet.length; i++) {
      const item = report.chiTiet[i];
      const isTotal = ['20', '30', '50', '60'].includes(item.code);

      if (isTotal) {
        if (hasPrev) {
          const prev = (report as any).previousPeriod as IncomeStatementReport;
          const prevItem = prev.chiTiet.find((p: any) => p.code === item.code);
          const prevAmt = prevItem?.amount ?? 0;
          const changePct = (report as any).changePercent?.[item.code] ?? null;
          this.setGrandTotalRowMultiCol(sheet, row, item.code, item.label, item.amount, prevAmt, changePct);
        } else {
          this.setGrandTotalRow(sheet, row, item.label, 0, item.amount, item.code);
        }
      } else {
        if (hasPrev) {
          const prev = (report as any).previousPeriod as IncomeStatementReport;
          const prevItem = prev.chiTiet.find((p: any) => p.code === item.code);
          const prevAmt = prevItem?.amount ?? 0;
          const changePct = (report as any).changePercent?.[item.code] ?? null;
          this.setDataRowMultiCol(sheet, row, item.code, item.label, item.amount, prevAmt, changePct, i % 2 === 1);
        } else {
          this.setDataRow(sheet, row, [item.code, item.label, item.amount], i % 2 === 1);
        }
      }
      row++;
    }
  }

  // ============================================================
  // B03-DN: Bao cao luu chuyen tien te
  // ============================================================

  private buildCashFlowSheet(workbook: ExcelJS.Workbook, report: CashFlowReport): void {
    const sheet = workbook.addWorksheet('B03-DN LUU CHUYEN TIEN', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    });

    sheet.columns = [
      { width: 55 },  // Khoan muc
      { width: 28 },  // So tien (VND)
    ];

    let row = 1;

    this.addCompanyHeader(sheet, row, 2, report.period);
    row += 3;

    this.mergeAndSetTitle(sheet, row, 1, 2, 'BAO CAO LUU CHUYEN TIEN TE', 16);
    row++;
    this.mergeAndSetTitle(
      sheet, row, 1, 2,
      `Mau B03-DN (Phuong phap truc tiep) - Ky tu ${report.period.from} den ${report.period.to}`,
      11,
    );
    row += 2;

    const hasPrev = (report as any).previousPeriod !== undefined;
    if (hasPrev) {
      sheet.columns = [
        { width: 50 },
        { width: 24 },
        { width: 24 },
        { width: 16 },
      ];
      this.setHeaderRow(sheet, row, ['Khoan muc', 'Ky nay (VND)', 'Ky truoc (VND)', '+/- %']);
    } else {
      this.setHeaderRow(sheet, row, ['Khoan muc', 'So tien (VND)']);
    }
    row++;

    const sections: Array<{ label: string; value: number; key: string; isTotal?: boolean }> = [
      { label: 'I. Luu chuyen tien tu hoat dong kinh doanh (HDKD)', value: report.luuChuyenTuHDKD, key: 'luuChuyenTuHDKD', isTotal: true },
      { label: 'II. Luu chuyen tien tu hoat dong dau tu (HDDT)', value: report.luuChuyenTuHDDT, key: 'luuChuyenTuHDDT', isTotal: true },
      { label: 'III. Luu chuyen tien tu hoat dong tai chinh (HDTC)', value: report.luuChuyenTuHDTC, key: 'luuChuyenTuHDTC', isTotal: true },
      { label: 'Tong tang/giam tien rong trong ky (I + II + III)', value: report.tangGiamTienRong, key: 'tangGiamTienRong', isTotal: true },
      { label: 'Tien va tuong duong tien dau ky', value: report.tienDauKy, key: 'tienDauKy' },
      { label: 'Tien va tuong duong tien cuoi ky', value: report.tienCuoiKy, key: 'tienCuoiKy', isTotal: true },
    ];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (s.isTotal) {
        if (hasPrev) {
          const prev = (report as any).previousPeriod as CashFlowReport;
          const prevVal = (prev as any)[s.key] ?? 0;
          const changePct = (report as any).changePercent?.[s.key] ?? null;
          this.setGrandTotalRowCF(sheet, row, s.label, s.value, prevVal, changePct);
        } else {
          this.setGrandTotalRowSingle(sheet, row, s.label, s.value);
        }
      } else {
        if (hasPrev) {
          const prev = (report as any).previousPeriod as CashFlowReport;
          const prevVal = (prev as any)[s.key] ?? 0;
          const changePct = (report as any).changePercent?.[s.key] ?? null;
          this.setCFDataRow(sheet, row, s.label, s.value, prevVal, changePct, i % 2 === 1);
        } else {
          this.setCFDataRowSingle(sheet, row, s.label, s.value, i % 2 === 1);
        }
      }
      row++;
    }
  }

  // ============================================================
  // Helper methods: format & style
  // ============================================================

  /** Format so theo chuan VN: dau cham ngan cach nghin */
  private fmtVND(value: number): string {
    if (value === 0) return '0';
    return Math.round(value).toLocaleString('vi-VN');
  }

  /** Header cong ty (3 dong: ten cty, dia chi, ten bao cao) */
  private addCompanyHeader(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    totalCols: number,
    period: { from: string; to: string },
  ): void {
    const endCol = String.fromCharCode(64 + totalCols); // A=65, so 'A' + 4 = 'D'

    // Dong 1: Ten cong ty
    const r1 = sheet.getRow(startRow);
    const c1 = r1.getCell(1);
    c1.value = COMPANY_NAME;
    c1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    sheet.mergeCells(`A${startRow}:${endCol}${startRow}`);
    r1.height = 28;

    // Dong 2: Dia chi
    const r2 = sheet.getRow(startRow + 1);
    const c2 = r2.getCell(1);
    c2.value = COMPANY_ADDRESS;
    c2.font = { size: 10, color: { argb: 'FFFFFFFF' } };
    c2.alignment = { horizontal: 'center', vertical: 'middle' };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    sheet.mergeCells(`A${startRow + 1}:${endCol}${startRow + 1}`);
    r2.height = 18;

    // Dong 3: Ky bao cao
    const r3 = sheet.getRow(startRow + 2);
    const c3 = r3.getCell(1);
    c3.value = `Ky bao cao: ${period.from} - ${period.to} | Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`;
    c3.font = { italic: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c3.alignment = { horizontal: 'center', vertical: 'middle' };
    c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    sheet.mergeCells(`A${startRow + 2}:${endCol}${startRow + 2}`);
    r3.height = 18;
  }

  /** Tieu de bao cao (merge cells, in dam, can giua) */
  private mergeAndSetTitle(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    fromCol: number,
    toCol: number,
    text: string,
    fontSize: number,
  ): void {
    const row = sheet.getRow(rowNum);
    const cell = row.getCell(fromCol);
    cell.value = text;
    cell.font = { bold: true, size: fontSize, color: { argb: 'FF1F4E78' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const fromColLetter = String.fromCharCode(64 + fromCol);
    const toColLetter = String.fromCharCode(64 + toCol);
    sheet.mergeCells(`${fromColLetter}${rowNum}:${toColLetter}${rowNum}`);
    row.height = fontSize === 16 ? 30 : 20;
  }

  /** Dong header cua bang (nen xanh, chu trang, bold) */
  private setHeaderRow(sheet: ExcelJS.Worksheet, rowNum: number, labels: string[]): void {
    const row = sheet.getRow(rowNum);
    labels.forEach((label, i) => {
      const cell = row.getCell(i + 1);
      cell.value = label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TITLE_BG } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = this.thinBorder();
    });
    row.height = 32;
  }

  /** Dong nhom (phan A, phan B, nhom I, nhom II) */
  private setGroupRow(sheet: ExcelJS.Worksheet, rowNum: number, label: string, totalCols: number): void {
    const row = sheet.getRow(rowNum);
    const endColLetter = String.fromCharCode(64 + totalCols);
    const cell = row.getCell(1);
    cell.value = label;
    cell.font = { bold: true, size: 11, color: { argb: 'FF1F4E78' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GROUP_BG } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.mergeCells(`A${rowNum}:${endColLetter}${rowNum}`);
    cell.border = this.thinBorder();
    row.height = 22;
  }

  /** Dong du lieu thuong (xen ke mau neu alternating=true) */
  private setDataRow(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    values: (string | number)[],
    alternating: boolean,
  ): void {
    const row = sheet.getRow(rowNum);
    const bg = alternating ? COLOR_ALT_ROW : 'FFFFFFFF';

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      if (typeof val === 'number') {
        cell.value = this.fmtVND(val);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.value = val;
        cell.alignment = { horizontal: i === 0 ? 'center' : 'left', vertical: 'middle' };
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { size: 10 };
      cell.border = this.thinBorder();
    });
    row.height = 18;
  }

  /** Dong tong hop phan (bold, nen vang nhat) */
  private setTotalRow(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    openingBalance: number,
    closingBalance: number,
  ): void {
    const row = sheet.getRow(rowNum);

    const setCell = (col: number, val: string | number) => {
      const cell = row.getCell(col);
      cell.value = typeof val === 'number' ? this.fmtVND(val) : val;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
      cell.alignment = {
        horizontal: typeof val === 'number' ? 'right' : 'left',
        vertical: 'middle',
      };
      cell.border = this.thinBorder();
    };

    setCell(1, '');
    setCell(2, label);
    setCell(3, openingBalance);
    setCell(4, closingBalance);
    row.height = 20;
  }

  /** Dong tong cong lon (TONG TAI SAN, TONG NGUON VON) */
  private setGrandTotalRow(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    openingBalance: number,
    closingBalance: number,
    code?: string,
  ): void {
    const row = sheet.getRow(rowNum);

    const setCell = (col: number, val: string | number) => {
      const cell = row.getCell(col);
      cell.value = typeof val === 'number' ? this.fmtVND(val) : val;
      cell.font = { bold: true, size: 11, color: { argb: 'FF1F4E78' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
      cell.alignment = {
        horizontal: typeof val === 'number' ? 'right' : 'left',
        vertical: 'middle',
      };
      cell.border = this.thinBorder();
    };

    if (code !== undefined) {
      setCell(1, code);
      setCell(2, label);
      setCell(3, closingBalance);
    } else {
      setCell(1, '');
      setCell(2, label);
      setCell(3, openingBalance);
      setCell(4, closingBalance);
    }
    row.height = 24;
  }

  /** Dong du lieu co so sanh ky truoc (5 cot: ma, label, ky nay, ky truoc, %) */
  private setDataRowMultiCol(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    code: string,
    label: string,
    current: number,
    previous: number,
    changePct: number | null,
    alternating: boolean,
  ): void {
    const row = sheet.getRow(rowNum);
    const bg = alternating ? COLOR_ALT_ROW : 'FFFFFFFF';

    const vals: (string | number)[] = [
      code,
      label,
      current,
      previous,
      changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : 'N/A',
    ];

    vals.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      if (i >= 2 && i <= 3 && typeof val === 'number') {
        cell.value = this.fmtVND(val);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.value = val as string;
        cell.alignment = { horizontal: i === 4 ? 'center' : (i === 0 ? 'center' : 'left'), vertical: 'middle' };
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { size: 10 };
      cell.border = this.thinBorder();

      // To mau % change
      if (i === 4 && changePct !== null) {
        cell.font = {
          size: 10,
          color: { argb: changePct >= 0 ? 'FF008000' : 'FFCC0000' },
          bold: true,
        };
      }
    });
    row.height = 18;
  }

  /** Dong tong lon co so sanh ky truoc */
  private setGrandTotalRowMultiCol(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    code: string,
    label: string,
    current: number,
    previous: number,
    changePct: number | null,
  ): void {
    const row = sheet.getRow(rowNum);
    const vals = [
      code,
      label,
      this.fmtVND(current),
      this.fmtVND(previous),
      changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : 'N/A',
    ];

    vals.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { bold: true, size: 11, color: { argb: 'FF1F4E78' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
      cell.alignment = {
        horizontal: i >= 2 ? (i === 4 ? 'center' : 'right') : (i === 0 ? 'center' : 'left'),
        vertical: 'middle',
      };
      cell.border = this.thinBorder();

      if (i === 4 && changePct !== null) {
        cell.font = {
          bold: true, size: 11,
          color: { argb: changePct >= 0 ? 'FF008000' : 'FFCC0000' },
        };
      }
    });
    row.height = 24;
  }

  /** Dong tong cong B03 (1 label + so tien) */
  private setGrandTotalRowSingle(sheet: ExcelJS.Worksheet, rowNum: number, label: string, value: number): void {
    const row = sheet.getRow(rowNum);
    const setCell = (col: number, val: string | number) => {
      const cell = row.getCell(col);
      cell.value = typeof val === 'number' ? this.fmtVND(val) : val;
      cell.font = { bold: true, size: 11, color: { argb: 'FF1F4E78' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
      cell.alignment = { horizontal: typeof val === 'number' ? 'right' : 'left', vertical: 'middle' };
      cell.border = this.thinBorder();
    };
    setCell(1, label);
    setCell(2, value);
    row.height = 24;
  }

  /** Dong tong B03 co so sanh ky truoc (3 cot) */
  private setGrandTotalRowCF(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    current: number,
    previous: number,
    changePct: number | null,
  ): void {
    const row = sheet.getRow(rowNum);
    const vals = [
      label,
      this.fmtVND(current),
      this.fmtVND(previous),
      changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : 'N/A',
    ];
    vals.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { bold: true, size: 11, color: { argb: 'FF1F4E78' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
      cell.alignment = { horizontal: i >= 1 ? (i === 3 ? 'center' : 'right') : 'left', vertical: 'middle' };
      cell.border = this.thinBorder();
    });
    row.height = 24;
  }

  /** Dong du lieu B03 (1 label + so tien) */
  private setCFDataRowSingle(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    value: number,
    alternating: boolean,
  ): void {
    const row = sheet.getRow(rowNum);
    const bg = alternating ? COLOR_ALT_ROW : 'FFFFFFFF';

    const c1 = row.getCell(1);
    c1.value = label;
    c1.font = { size: 10 };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    c1.alignment = { horizontal: 'left', vertical: 'middle' };
    c1.border = this.thinBorder();

    const c2 = row.getCell(2);
    c2.value = this.fmtVND(value);
    c2.font = { size: 10 };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    c2.alignment = { horizontal: 'right', vertical: 'middle' };
    c2.border = this.thinBorder();
    row.height = 18;
  }

  /** Dong du lieu B03 co so sanh ky truoc */
  private setCFDataRow(
    sheet: ExcelJS.Worksheet,
    rowNum: number,
    label: string,
    current: number,
    previous: number,
    changePct: number | null,
    alternating: boolean,
  ): void {
    const row = sheet.getRow(rowNum);
    const bg = alternating ? COLOR_ALT_ROW : 'FFFFFFFF';
    const vals = [
      label,
      this.fmtVND(current),
      this.fmtVND(previous),
      changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : 'N/A',
    ];
    vals.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { horizontal: i >= 1 ? (i === 3 ? 'center' : 'right') : 'left', vertical: 'middle' };
      cell.border = this.thinBorder();
    });
    row.height = 18;
  }

  /** Border mong toan phan */
  private thinBorder(): ExcelJS.Borders {
    const thin = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } };
    return { top: thin, left: thin, bottom: thin, right: thin, diagonal: {} } as ExcelJS.Borders;
  }
}
