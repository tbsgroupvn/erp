import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import * as ExcelJS from 'exceljs';

/**
 * Service for exporting customs declaration data to Excel format
 * compatible with Vietnam ECUS (Electronic Customs) system.
 *
 * Generates a multi-sheet workbook:
 *  - Sheet 1: General declaration information
 *  - Sheet 2: Goods/line items with tax calculations
 *  - Sheet 3: Container information
 */
@Injectable()
export class EcusExportService {
  private readonly logger = new Logger(EcusExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exports a customs declaration to an ECUS-compatible Excel file.
   *
   * @param declarationId - The customs declaration ID
   * @returns Buffer containing the .xlsx file data
   */
  async exportToExcel(declarationId: string): Promise<Buffer> {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        container: {
          select: {
            code: true,
            sealNumber: true,
            totalPackages: true,
            totalWeight: true,
          },
        },
      },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TBS ERP System';
    workbook.created = new Date();

    this.buildGeneralInfoSheet(workbook, declaration);
    this.buildGoodsSheet(workbook, declaration);
    this.buildContainerSheet(workbook, declaration);

    const buffer = await workbook.xlsx.writeBuffer();

    this.logger.log(`ECUS Excel export generated for declaration ${declaration.code}`);

    return Buffer.from(buffer);
  }

  /**
   * Sheet 1: "Thong tin chung" (General Information)
   */
  private buildGeneralInfoSheet(workbook: ExcelJS.Workbook, declaration: any): void {
    const ws = workbook.addWorksheet('Thong tin chung', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        margins: {
          left: 0.7,
          right: 0.7,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3,
        },
      },
    });

    // Column widths
    ws.columns = [
      { width: 30 }, // A - Label
      { width: 50 }, // B - Value
    ];

    let row = 1;

    // Title
    ws.mergeCells(`A${row}:B${row}`);
    const titleCell = ws.getCell(`A${row}`);
    titleCell.value = 'THONG TIN TO KHAI HAI QUAN';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A56DB' } };
    titleCell.alignment = { horizontal: 'center' };
    row += 2;

    // Declaration info section
    const sectionHeaderStyle: Partial<ExcelJS.Font> = {
      bold: true,
      size: 11,
      color: { argb: 'FF1A56DB' },
    };

    ws.getCell(`A${row}`).value = 'THONG TIN TO KHAI';
    ws.getCell(`A${row}`).font = sectionHeaderStyle;
    row++;

    const declarationInfo: [string, string][] = [
      ['Loai to khai', declaration.declarationType],
      ['Ma hai quan', declaration.customsOfficeCode ?? '---'],
      ['So to khai', declaration.code],
      ['Ma so thue', declaration.importerTaxCode],
      ['Ten doanh nghiep', declaration.importerName],
      ['Dia chi', declaration.importerAddress ?? '---'],
    ];

    for (const [label, value] of declarationInfo) {
      this.addInfoRow(ws, row, label, value);
      row++;
    }
    row++;

    // Shipping info section
    ws.getCell(`A${row}`).value = 'THONG TIN VAN CHUYEN';
    ws.getCell(`A${row}`).font = sectionHeaderStyle;
    row++;

    const shippingInfo: [string, string][] = [
      ['Phuong tien van tai', declaration.shippingMethod ?? '---'],
      ['So van don (B/L)', declaration.blAwbNumber ?? '---'],
      ['Cang xep hang', declaration.portOfLoading ?? '---'],
      ['Cang do hang', declaration.portOfDischarge ?? '---'],
      ['Ten tau', declaration.vesselName ?? '---'],
    ];

    for (const [label, value] of shippingInfo) {
      this.addInfoRow(ws, row, label, value);
      row++;
    }
    row++;

    // Financial info section
    ws.getCell(`A${row}`).value = 'THONG TIN TAI CHINH';
    ws.getCell(`A${row}`).font = sectionHeaderStyle;
    row++;

    const totalImportDuty = Number(declaration.totalImportDuty);
    const totalVat = Number(declaration.totalVat);
    const totalSpecialTax = Number(declaration.totalSpecialTax);
    const totalPayable = Number(declaration.totalPayable);

    const financialInfo: [string, string][] = [
      ['Tong tri gia', this.formatNumber(Number(declaration.declaredTotalValue))],
      ['Phi van chuyen', this.formatNumber(Number(declaration.declaredFreight))],
      ['Phi bao hiem', this.formatNumber(Number(declaration.declaredInsurance))],
      ['Tong thue nhap khau (NK)', this.formatNumber(totalImportDuty)],
      ['Tong thue VAT', this.formatNumber(totalVat)],
      ['Tong thue TTDB', this.formatNumber(totalSpecialTax)],
      ['Tong cong phai nop', this.formatNumber(totalPayable)],
    ];

    for (const [label, value] of financialInfo) {
      this.addInfoRow(ws, row, label, value);
      row++;
    }

    // Bold the total row
    ws.getCell(`A${row - 1}`).font = { bold: true, size: 11 };
    ws.getCell(`B${row - 1}`).font = { bold: true, size: 11, color: { argb: 'FFDC2626' } };
  }

  /**
   * Sheet 2: "Hang hoa" (Goods)
   */
  private buildGoodsSheet(workbook: ExcelJS.Workbook, declaration: any): void {
    const ws = workbook.addWorksheet('Hang hoa', {
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
      },
    });

    // Column widths
    ws.columns = [
      { width: 6 }, // A - STT
      { width: 15 }, // B - Ma HS
      { width: 35 }, // C - Mo ta hang hoa
      { width: 10 }, // D - So luong
      { width: 10 }, // E - Don vi tinh
      { width: 12 }, // F - Don gia
      { width: 15 }, // G - Tri gia
      { width: 8 }, // H - Xuat xu
      { width: 10 }, // I - Thue suat NK (%)
      { width: 15 }, // J - Tien thue NK
      { width: 10 }, // K - Thue suat VAT (%)
      { width: 15 }, // L - Tien thue VAT
      { width: 15 }, // M - Thue TTDB
      { width: 15 }, // N - Thue BVMT
    ];

    let row = 1;

    // Title
    ws.mergeCells(`A${row}:N${row}`);
    const titleCell = ws.getCell(`A${row}`);
    titleCell.value = `DANH SACH HANG HOA - TO KHAI ${declaration.code}`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF1A56DB' } };
    titleCell.alignment = { horizontal: 'center' };
    row += 2;

    // Table header
    const headers = [
      'STT',
      'Ma HS',
      'Mo ta hang hoa',
      'So luong',
      'Don vi tinh',
      'Don gia',
      'Tri gia',
      'Xuat xu',
      'Thue suat NK (%)',
      'Tien thue NK',
      'Thue suat VAT (%)',
      'Tien thue VAT',
      'Thue TTDB',
      'Thue BVMT',
    ];

    const headerRow = ws.getRow(row);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A56DB' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    row++;

    // Data rows
    let totalValue = 0;
    let totalImportDuty = 0;
    let totalVatAmount = 0;
    let totalSpecialTax = 0;
    let totalEnvTax = 0;

    for (const [index, line] of declaration.lines.entries()) {
      const dataRow = ws.getRow(row);
      const lineValue = Number(line.declaredTotalValue);
      const lineDuty = Number(line.importDutyAmount);
      const lineVat = Number(line.vatAmount);
      const lineSpecial = Number(line.specialTaxAmount);
      const lineEnv = Number(line.environmentalTax);

      totalValue += lineValue;
      totalImportDuty += lineDuty;
      totalVatAmount += lineVat;
      totalSpecialTax += lineSpecial;
      totalEnvTax += lineEnv;

      const values: (string | number)[] = [
        index + 1,
        line.declaredHsCode,
        line.declaredDescription,
        Number(line.declaredQuantity),
        line.declaredUnit,
        Number(line.declaredUnitPrice),
        lineValue,
        line.declaredCountryOrigin,
        `${(Number(line.importDutyRate) * 100).toFixed(1)}%`,
        lineDuty,
        `${(Number(line.vatRate) * 100).toFixed(1)}%`,
        lineVat,
        lineSpecial,
        lineEnv,
      ];

      values.forEach((v, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 9 };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Alignment
        if (i === 0 || i === 3 || i === 4 || i === 7) {
          cell.alignment = { horizontal: 'center' };
        }
        if (i === 5 || i === 6 || i === 9 || i === 11 || i === 12 || i === 13) {
          cell.alignment = { horizontal: 'right' };
          if (typeof v === 'number') {
            cell.numFmt = '#,##0.00';
          }
        }
      });

      row++;
    }

    // Footer totals row
    const footerRow = ws.getRow(row);
    ws.mergeCells(`A${row}:F${row}`);
    footerRow.getCell(1).value = 'TONG CONG';
    footerRow.getCell(1).font = { bold: true, size: 10 };
    footerRow.getCell(1).alignment = { horizontal: 'right' };

    const footerValues: (number | string)[] = [
      totalValue, // G - Tri gia
      '', // H - Xuat xu
      '', // I - Thue suat NK
      totalImportDuty, // J - Tien thue NK
      '', // K - Thue suat VAT
      totalVatAmount, // L - Tien thue VAT
      totalSpecialTax, // M - Thue TTDB
      totalEnvTax, // N - Thue BVMT
    ];

    footerValues.forEach((v, i) => {
      const cell = footerRow.getCell(i + 7); // Start from column G
      cell.value = v;
      cell.font = { bold: true, size: 9 };
      cell.border = {
        top: { style: 'double' },
        bottom: { style: 'double' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (typeof v === 'number') {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }
    });

    // Border for the merged totals label cells
    for (let col = 1; col <= 6; col++) {
      const cell = footerRow.getCell(col);
      cell.border = {
        top: { style: 'double' },
        bottom: { style: 'double' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }

  /**
   * Sheet 3: "Container" (Container Information)
   */
  private buildContainerSheet(workbook: ExcelJS.Workbook, declaration: any): void {
    const ws = workbook.addWorksheet('Container', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
      },
    });

    ws.columns = [
      { width: 25 }, // A - Label
      { width: 35 }, // B - Value
    ];

    let row = 1;

    // Title
    ws.mergeCells(`A${row}:B${row}`);
    const titleCell = ws.getCell(`A${row}`);
    titleCell.value = 'THONG TIN CONTAINER';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A56DB' } };
    titleCell.alignment = { horizontal: 'center' };
    row += 2;

    const container = declaration.container;

    const containerInfo: [string, string][] = [
      ['Ma container', container?.code ?? '---'],
      ['So seal', container?.sealNumber ?? '---'],
      ['Tong so kien', container?.totalPackages?.toString() ?? '---'],
      [
        'Tong trong luong (kg)',
        container?.totalWeight ? this.formatNumber(Number(container.totalWeight)) : '---',
      ],
    ];

    for (const [label, value] of containerInfo) {
      this.addInfoRow(ws, row, label, value);
      row++;
    }
  }

  /**
   * Adds a label-value row to a worksheet.
   */
  private addInfoRow(ws: ExcelJS.Worksheet, row: number, label: string, value: string): void {
    const labelCell = ws.getCell(`A${row}`);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10 };
    labelCell.border = {
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };

    const valueCell = ws.getCell(`B${row}`);
    valueCell.value = value;
    valueCell.font = { size: 10 };
    valueCell.border = {
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };
  }

  /**
   * Formats a number with thousand separators.
   */
  private formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
