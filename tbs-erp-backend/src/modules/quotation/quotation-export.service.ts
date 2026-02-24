import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_TYPE_MAP: Record<string, string> = {
  VCT: 'Van chuyen tieu ngach',
  MHH: 'Mua hang ho',
  UTXNK: 'Uy thac xuat nhap khau',
  LCLCN: 'LCL chinh ngach',
};

const SERVICE_TYPE_MAP_VI: Record<string, string> = {
  VCT: 'V\u1EADn chuy\u1EC3n ti\u1EC3u ng\u1EA1ch',
  MHH: 'Mua h\u00E0ng h\u1ED9',
  UTXNK: '\u1EE6y th\u00E1c xu\u1EA5t nh\u1EADp kh\u1EA9u',
  LCLCN: 'LCL ch\u00EDnh ng\u1EA1ch',
};

const SHIPPING_ROUTE_MAP: Record<string, string> = {
  SEA: 'Duong bien',
  AIR: 'Duong hang khong',
  RAIL: 'Duong sat',
  ROAD: 'Duong bo',
  MULTIMODAL: 'Da phuong thuc',
};

const SHIPPING_ROUTE_MAP_VI: Record<string, string> = {
  SEA: '\u0110\u01B0\u1EDDng bi\u1EC3n',
  AIR: '\u0110\u01B0\u1EDDng h\u00E0ng kh\u00F4ng',
  RAIL: '\u0110\u01B0\u1EDDng s\u1EAFt',
  ROAD: '\u0110\u01B0\u1EDDng b\u1ED9',
  MULTIMODAL: '\u0110a ph\u01B0\u01A1ng th\u1EE9c',
};

const BRANCH_MAP: Record<string, string> = {
  HN: 'Ha Noi',
  HCM: 'TP. Ho Chi Minh',
};

const BRANCH_MAP_VI: Record<string, string> = {
  HN: 'H\u00E0 N\u1ED9i',
  HCM: 'TP. H\u1ED3 Ch\u00ED Minh',
};

@Injectable()
export class QuotationExportService {
  private readonly logger = new Logger(QuotationExportService.name);
  private readonly companyFullName: string;
  private readonly companyAddress: string;
  private readonly supportPhone: string;
  private readonly taxCode: string;
  private readonly appTitle: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.companyFullName = this.configService.get<string>('branding.companyFullName') || 'My ERP Company';
    this.companyAddress = this.configService.get<string>('branding.companyAddress') || '';
    this.supportPhone = this.configService.get<string>('branding.supportPhone') || '';
    this.taxCode = this.configService.get<string>('branding.taxCode') || '';
    this.appTitle = this.configService.get<string>('branding.appTitle') || 'ERP System';
  }

  /**
   * Get full quotation data for export with customer and items included.
   */
  private async getQuotationData(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
            email: true,
            tier: true,
          },
        },
        items: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }

    return quotation;
  }

  /**
   * Format a numeric value as Vietnamese VND currency string.
   */
  private formatCurrency(value: number | any): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(value));
  }

  /**
   * Format a date as dd/MM/yyyy.
   */
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  // =========================================================================
  // EXCEL EXPORT
  // =========================================================================

  /**
   * Generates a professional Excel (.xlsx) quotation document.
   * Uses ExcelJS which fully supports Vietnamese/Unicode characters.
   */
  async generateExcel(id: string): Promise<Buffer> {
    const q = await this.getQuotationData(id);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `${this.appTitle}`;
    workbook.created = new Date();

    const ws = workbook.addWorksheet('B\u00E1o gi\u00E1', {
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
      { width: 6 },  // A - STT
      { width: 35 }, // B - Product name
      { width: 10 }, // C - Quantity
      { width: 15 }, // D - Unit price
      { width: 12 }, // E - Currency
      { width: 18 }, // F - Total price
    ];

    let row = 1;

    // --- COMPANY HEADER ---
    ws.mergeCells(`A${row}:F${row}`);
    const companyCell = ws.getCell(`A${row}`);
    companyCell.value = this.companyFullName;
    companyCell.font = { bold: true, size: 16, color: { argb: 'FF1A56DB' } };
    companyCell.alignment = { horizontal: 'center' };
    row++;

    ws.mergeCells(`A${row}:F${row}`);
    const addressCell = ws.getCell(`A${row}`);
    addressCell.value =
      `${this.companyAddress ? 'Địa chỉ: ' + this.companyAddress + ' | ' : ''}${this.supportPhone ? 'ĐT: ' + this.supportPhone + ' | ' : ''}${this.taxCode ? 'MST: ' + this.taxCode : ''}`;
    addressCell.font = { size: 10, color: { argb: 'FF666666' } };
    addressCell.alignment = { horizontal: 'center' };
    row += 2;

    // --- TITLE ---
    ws.mergeCells(`A${row}:F${row}`);
    const titleCell = ws.getCell(`A${row}`);
    titleCell.value = 'B\u00C1O GI\u00C1 D\u1ECBCH V\u1EE4';
    titleCell.font = { bold: true, size: 18 };
    titleCell.alignment = { horizontal: 'center' };
    row++;

    ws.mergeCells(`A${row}:F${row}`);
    const codeCell = ws.getCell(`A${row}`);
    codeCell.value = `S\u1ED1: ${q.code}`;
    codeCell.font = { size: 11, italic: true };
    codeCell.alignment = { horizontal: 'center' };
    row += 2;

    // --- CUSTOMER INFO ---
    ws.mergeCells(`A${row}:B${row}`);
    ws.getCell(`A${row}`).value = 'TH\u00D4NG TIN KH\u00C1CH H\u00C0NG';
    ws.getCell(`A${row}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FF1A56DB' },
    };
    row++;

    const customerInfo: [string, string][] = [
      ['Kh\u00E1ch h\u00E0ng:', q.customer?.fullName || '---'],
      ['C\u00F4ng ty:', q.customer?.companyName || '---'],
      ['M\u00E3 KH:', q.customer?.code || '---'],
      ['\u0110i\u1EC7n tho\u1EA1i:', q.customer?.phone || '---'],
      ['Email:', q.customer?.email || '---'],
    ];
    for (const [label, value] of customerInfo) {
      ws.getCell(`A${row}`).value = label;
      ws.getCell(`A${row}`).font = { bold: true, size: 10 };
      ws.mergeCells(`B${row}:F${row}`);
      ws.getCell(`B${row}`).value = value;
      ws.getCell(`B${row}`).font = { size: 10 };
      row++;
    }
    row++;

    // --- SERVICE INFO ---
    ws.mergeCells(`A${row}:B${row}`);
    ws.getCell(`A${row}`).value = 'TH\u00D4NG TIN D\u1ECBCH V\u1EE4';
    ws.getCell(`A${row}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FF1A56DB' },
    };
    row++;

    const serviceInfo: [string, string][] = [
      [
        'Lo\u1EA1i d\u1ECBch v\u1EE5:',
        SERVICE_TYPE_MAP_VI[q.serviceType] || q.serviceType,
      ],
      ['Chi nh\u00E1nh:', BRANCH_MAP_VI[q.branch] || q.branch],
      [
        'Tuy\u1EBFn v\u1EADn chuy\u1EC3n:',
        q.shippingRoute
          ? SHIPPING_ROUTE_MAP_VI[q.shippingRoute] || q.shippingRoute
          : '---',
      ],
      ['Ng\u00E0y t\u1EA1o:', this.formatDate(q.createdAt)],
      [
        'Hi\u1EC7u l\u1EF1c \u0111\u1EBFn:',
        q.validUntil ? this.formatDate(q.validUntil) : '---',
      ],
    ];
    for (const [label, value] of serviceInfo) {
      ws.getCell(`A${row}`).value = label;
      ws.getCell(`A${row}`).font = { bold: true, size: 10 };
      ws.mergeCells(`B${row}:F${row}`);
      ws.getCell(`B${row}`).value = value;
      ws.getCell(`B${row}`).font = { size: 10 };
      row++;
    }
    row++;

    // --- ITEMS TABLE HEADER ---
    ws.mergeCells(`A${row}:B${row}`);
    ws.getCell(`A${row}`).value = 'CHI TI\u1EBET H\u00C0NG M\u1EE4C';
    ws.getCell(`A${row}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FF1A56DB' },
    };
    row++;

    const headerRow = ws.getRow(row);
    const headers = [
      'STT',
      'T\u00EAn s\u1EA3n ph\u1EA9m',
      'S\u1ED1 l\u01B0\u1EE3ng',
      '\u0110\u01A1n gi\u00E1',
      'Ti\u1EC1n t\u1EC7',
      'Th\u00E0nh ti\u1EC1n',
    ];
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A56DB' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    row++;

    // --- ITEMS ---
    q.items.forEach((item, index) => {
      const itemRow = ws.getRow(row);
      const values = [
        index + 1,
        item.productName,
        item.quantity,
        this.formatCurrency(item.unitPrice),
        item.currency || 'CNY',
        this.formatCurrency(item.totalPrice),
      ];
      values.forEach((v, i) => {
        const cell = itemRow.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 10 };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (i === 0 || i === 2 || i === 4) {
          cell.alignment = { horizontal: 'center' };
        }
        if (i === 3 || i === 5) {
          cell.alignment = { horizontal: 'right' };
        }
      });
      row++;
    });
    row++;

    // --- TOTALS ---
    const totals: [string, string][] = [
      ['T\u1EA1m t\u00EDnh:', this.formatCurrency(q.subtotal)],
      [
        `Gi\u1EA3m gi\u00E1 (${Number(q.discountPercent)}%):`,
        `-${this.formatCurrency(q.discountAmount)}`,
      ],
      [
        `Thu\u1EBF (${(Number(q.taxRate) * 100).toFixed(0)}%):`,
        this.formatCurrency(q.taxAmount),
      ],
    ];
    for (const [label, value] of totals) {
      ws.mergeCells(`A${row}:D${row}`);
      ws.getCell(`E${row}`).value = label;
      ws.getCell(`E${row}`).font = { size: 10 };
      ws.getCell(`E${row}`).alignment = { horizontal: 'right' };
      ws.getCell(`F${row}`).value = value;
      ws.getCell(`F${row}`).font = { size: 10 };
      ws.getCell(`F${row}`).alignment = { horizontal: 'right' };
      row++;
    }

    // Grand total
    ws.mergeCells(`A${row}:D${row}`);
    ws.getCell(`E${row}`).value = 'T\u1ED4NG C\u1ED8NG:';
    ws.getCell(`E${row}`).font = { bold: true, size: 12 };
    ws.getCell(`E${row}`).alignment = { horizontal: 'right' };
    ws.getCell(`F${row}`).value = this.formatCurrency(q.totalAmount);
    ws.getCell(`F${row}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FFDC2626' },
    };
    ws.getCell(`F${row}`).alignment = { horizontal: 'right' };
    row += 2;

    // --- NOTES ---
    if (q.note) {
      ws.mergeCells(`A${row}:F${row}`);
      ws.getCell(`A${row}`).value = 'Ghi ch\u00FA: ' + q.note;
      ws.getCell(`A${row}`).font = { italic: true, size: 10 };
      row++;
    }
    row++;

    // --- TERMS ---
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = '\u0110I\u1EC0U KHO\u1EA2N';
    ws.getCell(`A${row}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FF1A56DB' },
    };
    row++;

    const terms = [
      '1. B\u00E1o gi\u00E1 c\u00F3 hi\u1EC7u l\u1EF1c trong th\u1EDDi gian ghi tr\u00EAn.',
      '2. Gi\u00E1 tr\u00EAn ch\u01B0a bao g\u1ED3m c\u00E1c chi ph\u00ED ph\u00E1t sinh ngo\u00E0i d\u1ECBch v\u1EE5 \u0111\u00E3 th\u1ECFa thu\u1EADn.',
      '3. Thanh to\u00E1n theo quy \u0111\u1ECBnh c\u1EE7a c\u00F4ng ty.',
      '4. M\u1ECDi th\u1EAFc m\u1EAFc xin li\u00EAn h\u1EC7 b\u1ED9 ph\u1EADn kinh doanh.',
    ];
    for (const term of terms) {
      ws.mergeCells(`A${row}:F${row}`);
      ws.getCell(`A${row}`).value = term;
      ws.getCell(`A${row}`).font = { size: 9, color: { argb: 'FF666666' } };
      row++;
    }
    row += 2;

    // --- SIGNATURES ---
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value =
      'NG\u01AF\u1EDCI L\u1EACP B\u00C1O GI\u00C1';
    ws.getCell(`A${row}`).font = { bold: true, size: 11 };
    ws.getCell(`A${row}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`D${row}:F${row}`);
    ws.getCell(`D${row}`).value = 'NG\u01AF\u1EDCI DUY\u1EC6T';
    ws.getCell(`D${row}`).font = { bold: true, size: 11 };
    ws.getCell(`D${row}`).alignment = { horizontal: 'center' };
    row++;

    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value =
      '(K\u00FD, ghi r\u00F5 h\u1ECD t\u00EAn)';
    ws.getCell(`A${row}`).font = {
      italic: true,
      size: 9,
      color: { argb: 'FF999999' },
    };
    ws.getCell(`A${row}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`D${row}:F${row}`);
    ws.getCell(`D${row}`).value =
      '(K\u00FD, ghi r\u00F5 h\u1ECD t\u00EAn)';
    ws.getCell(`D${row}`).font = {
      italic: true,
      size: 9,
      color: { argb: 'FF999999' },
    };
    ws.getCell(`D${row}`).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.log(`Excel export generated for quotation ${q.code}`);
    return Buffer.from(buffer);
  }

  // =========================================================================
  // PDF EXPORT
  // =========================================================================

  private fontsLoaded = false;

  private ensurePdfFonts(): void {
    if (this.fontsLoaded) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfmake = require('pdfmake');
    const fontsDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'node_modules',
      'pdfmake',
      'fonts',
      'Roboto',
    );

    pdfmake.virtualfs.writeFileSync(
      'Roboto-Regular.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf')),
    );
    pdfmake.virtualfs.writeFileSync(
      'Roboto-Medium.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-Medium.ttf')),
    );
    pdfmake.virtualfs.writeFileSync(
      'Roboto-Italic.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-Italic.ttf')),
    );
    pdfmake.virtualfs.writeFileSync(
      'Roboto-MediumItalic.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-MediumItalic.ttf')),
    );

    pdfmake.setFonts({
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    });

    this.fontsLoaded = true;
  }

  private getDepositRateByTier(tier?: string): number {
    const rates: Record<string, number> = {
      NEW: 100,
      REGULAR: 70,
      VIP: 50,
      STRATEGIC: 30,
    };
    return rates[tier || 'NEW'] ?? 100;
  }

  /**
   * Generates a professional PDF quotation document using pdfmake.
   * Uses Roboto TTF fonts for full Vietnamese Unicode support.
   */
  async generatePdf(id: string): Promise<Buffer> {
    const q = await this.getQuotationData(id);

    this.ensurePdfFonts();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfmake = require('pdfmake');

    const BLUE = '#1A56DB';
    const GRAY = '#666666';
    const LIGHT_GRAY = '#999999';
    const RED = '#DC2626';

    const depositRate = this.getDepositRateByTier(q.customer?.tier);

    // Terms reused from Excel export
    const terms = [
      '1. B\u00E1o gi\u00E1 c\u00F3 hi\u1EC7u l\u1EF1c trong th\u1EDDi gian ghi tr\u00EAn.',
      '2. Gi\u00E1 tr\u00EAn ch\u01B0a bao g\u1ED3m c\u00E1c chi ph\u00ED ph\u00E1t sinh ngo\u00E0i d\u1ECBch v\u1EE5 \u0111\u00E3 th\u1ECFa thu\u1EADn.',
      '3. Thanh to\u00E1n theo quy \u0111\u1ECBnh c\u1EE7a c\u00F4ng ty.',
      '4. M\u1ECDi th\u1EAFc m\u1EAFc xin li\u00EAn h\u1EC7 b\u1ED9 ph\u1EADn kinh doanh.',
    ];

    // Build items table body
    const itemsTableBody: any[][] = [
      // Header row
      [
        { text: 'STT', style: 'tableHeader', alignment: 'center' },
        { text: 'T\u00EAn s\u1EA3n ph\u1EA9m', style: 'tableHeader' },
        { text: 'SL', style: 'tableHeader', alignment: 'center' },
        { text: '\u0110\u01A1n gi\u00E1', style: 'tableHeader', alignment: 'right' },
        { text: 'Th\u00E0nh ti\u1EC1n', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    q.items.forEach((item, index) => {
      const row = [
        { text: String(index + 1), alignment: 'center' as const },
        { text: item.productName },
        { text: String(item.quantity), alignment: 'center' as const },
        { text: this.formatCurrency(item.unitPrice), alignment: 'right' as const },
        { text: this.formatCurrency(item.totalPrice), alignment: 'right' as const },
      ];
      // Zebra striping
      if (index % 2 === 1) {
        row.forEach((cell: any) => (cell.fillColor = '#F9FAFB'));
      }
      itemsTableBody.push(row);
    });

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [50, 50, 50, 60],
      info: {
        title: `B\u00E1o gi\u00E1 ${q.code}`,
        author: this.appTitle,
        subject: 'Báo giá dịch vụ',
        creator: this.appTitle,
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
      styles: {
        companyName: { fontSize: 16, bold: true, color: BLUE, alignment: 'center' },
        companyAddress: { fontSize: 9, color: GRAY, alignment: 'center' },
        title: { fontSize: 20, bold: true, alignment: 'center' },
        subtitle: { fontSize: 11, italics: true, alignment: 'center' },
        sectionHeader: { fontSize: 11, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
        fieldLabel: { fontSize: 9, bold: true },
        fieldValue: { fontSize: 9 },
        tableHeader: { fontSize: 9, bold: true, color: '#FFFFFF', fillColor: BLUE },
        totalLabel: { fontSize: 10, alignment: 'right' },
        totalValue: { fontSize: 10, alignment: 'right' },
        grandTotalLabel: { fontSize: 13, bold: true, alignment: 'right' },
        grandTotalValue: { fontSize: 13, bold: true, alignment: 'right', color: RED },
        termText: { fontSize: 8, color: GRAY },
        sigTitle: { fontSize: 11, bold: true, alignment: 'center' },
        sigSub: { fontSize: 8, italics: true, color: LIGHT_GRAY, alignment: 'center' },
      },

      // DRAFT watermark
      ...(q.status === 'DRAFT'
        ? { watermark: { text: 'NH\u00C1P', color: '#CCCCCC', opacity: 0.15, bold: true, angle: -45 } }
        : {}),

      content: [
        // --- HEADER ---
        { text: 'C\u00D4NG TY TNHH TBS GROUP', style: 'companyName' },
        {
          text: '\u0110\u1ECBa ch\u1EC9: H\u00E0 N\u1ED9i, Vi\u1EC7t Nam | \u0110T: 0123.456.789 | MST: 0123456789',
          style: 'companyAddress',
          margin: [0, 2, 0, 8],
        },
        // Divider
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 2, lineColor: BLUE },
          ],
          margin: [0, 0, 0, 15],
        },

        // --- TITLE ---
        { text: 'B\u00C1O GI\u00C1 D\u1ECACH V\u1EE4', style: 'title' },
        { text: `S\u1ED1: ${q.code}`, style: 'subtitle', margin: [0, 2, 0, 20] },

        // --- TWO-COLUMN INFO ---
        {
          columns: [
            {
              width: '48%',
              stack: [
                { text: 'TH\u00D4NG TIN KH\u00C1CH H\u00C0NG', style: 'sectionHeader', margin: [0, 0, 0, 5] },
                {
                  table: {
                    widths: ['auto', '*'],
                    body: [
                      [{ text: 'Kh\u00E1ch h\u00E0ng:', style: 'fieldLabel' }, { text: q.customer?.fullName || '---', style: 'fieldValue' }],
                      [{ text: 'C\u00F4ng ty:', style: 'fieldLabel' }, { text: q.customer?.companyName || '---', style: 'fieldValue' }],
                      [{ text: 'M\u00E3 KH:', style: 'fieldLabel' }, { text: q.customer?.code || '---', style: 'fieldValue' }],
                      [{ text: '\u0110i\u1EC7n tho\u1EA1i:', style: 'fieldLabel' }, { text: q.customer?.phone || '---', style: 'fieldValue' }],
                      [{ text: 'Email:', style: 'fieldLabel' }, { text: q.customer?.email || '---', style: 'fieldValue' }],
                    ],
                  },
                  layout: 'noBorders',
                },
              ],
            },
            { width: '4%', text: '' },
            {
              width: '48%',
              stack: [
                { text: 'TH\u00D4NG TIN D\u1ECBCH V\u1EE4', style: 'sectionHeader', margin: [0, 0, 0, 5] },
                {
                  table: {
                    widths: ['auto', '*'],
                    body: [
                      [{ text: 'Lo\u1EA1i DV:', style: 'fieldLabel' }, { text: SERVICE_TYPE_MAP_VI[q.serviceType] || q.serviceType, style: 'fieldValue' }],
                      [{ text: 'Chi nh\u00E1nh:', style: 'fieldLabel' }, { text: BRANCH_MAP_VI[q.branch] || q.branch, style: 'fieldValue' }],
                      [{ text: 'Tuy\u1EBFn:', style: 'fieldLabel' }, { text: q.shippingRoute ? (SHIPPING_ROUTE_MAP_VI[q.shippingRoute] || q.shippingRoute) : '---', style: 'fieldValue' }],
                      [{ text: 'Ng\u00E0y t\u1EA1o:', style: 'fieldLabel' }, { text: this.formatDate(q.createdAt), style: 'fieldValue' }],
                      [{ text: 'Hi\u1EC7u l\u1EF1c \u0111\u1EBFn:', style: 'fieldLabel' }, { text: q.validUntil ? this.formatDate(q.validUntil) : '---', style: 'fieldValue' }],
                    ],
                  },
                  layout: 'noBorders',
                },
              ],
            },
          ],
        },

        // --- ITEMS TABLE ---
        { text: 'CHI TI\u1EBET H\u00C0NG M\u1EE4C', style: 'sectionHeader', margin: [0, 15, 0, 5] },
        {
          table: {
            headerRows: 1,
            widths: [30, '*', 35, 95, 95],
            body: itemsTableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },

        // --- TOTALS ---
        {
          margin: [0, 15, 0, 0],
          columns: [
            { width: '*', text: '' },
            {
              width: 260,
              table: {
                widths: ['*', 110],
                body: [
                  [
                    { text: 'T\u1EA1m t\u00EDnh:', style: 'totalLabel', border: [false, false, false, false] },
                    { text: this.formatCurrency(q.subtotal), style: 'totalValue', border: [false, false, false, false] },
                  ],
                  [
                    { text: `Gi\u1EA3m gi\u00E1 (${Number(q.discountPercent)}%):`, style: 'totalLabel', color: RED, border: [false, false, false, false] },
                    { text: `-${this.formatCurrency(q.discountAmount)}`, style: 'totalValue', color: RED, border: [false, false, false, false] },
                  ],
                  [
                    { text: `Thu\u1EBF (${(Number(q.taxRate) * 100).toFixed(0)}%):`, style: 'totalLabel', border: [false, false, false, false] },
                    { text: this.formatCurrency(q.taxAmount), style: 'totalValue', border: [false, false, false, false] },
                  ],
                  [
                    { text: 'T\u1ED4NG C\u1ED8NG:', style: 'grandTotalLabel', border: [false, true, false, false] },
                    { text: this.formatCurrency(q.totalAmount), style: 'grandTotalValue', border: [false, true, false, false] },
                  ],
                ],
              },
              layout: 'noBorders',
            },
          ],
        },

        // --- PAYMENT INFO ---
        {
          margin: [0, 15, 0, 0],
          stack: [
            { text: 'TH\u00D4NG TIN THANH TO\u00C1N', style: 'sectionHeader', margin: [0, 0, 0, 5] },
            { text: `T\u1EF7 l\u1EC7 \u0111\u1EB7t c\u1ECDc: ${depositRate}% (${q.customer?.tier || 'NEW'})`, fontSize: 9, margin: [0, 0, 0, 3] },
            { text: `S\u1ED1 ti\u1EC1n \u0111\u1EB7t c\u1ECDc: ${this.formatCurrency(Number(q.totalAmount) * depositRate / 100)}`, fontSize: 9, margin: [0, 0, 0, 3] },
            {
              text: [
                { text: 'Ng\u00E2n h\u00E0ng: ', bold: true, fontSize: 9 },
                { text: 'Vietcombank - CN H\u00E0 N\u1ED9i', fontSize: 9 },
              ],
              margin: [0, 0, 0, 2],
            },
            {
              text: [
                { text: 'S\u1ED1 TK: ', bold: true, fontSize: 9 },
                { text: '0123456789 - C\u00D4NG TY TNHH TBS GROUP', fontSize: 9 },
              ],
              margin: [0, 0, 0, 2],
            },
          ],
        },

        // --- NOTES ---
        ...(q.note
          ? [
              {
                text: [
                  { text: 'Ghi ch\u00FA: ', bold: true },
                  { text: q.note, italics: true },
                ],
                fontSize: 10,
                margin: [0, 12, 0, 0] as [number, number, number, number],
              },
            ]
          : []),

        // --- TERMS ---
        { text: '\u0110I\u1EC0U KHO\u1EA2N', style: 'sectionHeader', margin: [0, 12, 0, 5] },
        ...terms.map((t) => ({ text: t, style: 'termText', margin: [0, 1, 0, 0] as [number, number, number, number] })),

        // --- SIGNATURES ---
        {
          margin: [0, 30, 0, 0],
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'NG\u01AF\u1EDCI L\u1EACP B\u00C1O GI\u00C1', style: 'sigTitle' },
                { text: '(K\u00FD, ghi r\u00F5 h\u1ECD t\u00EAn)', style: 'sigSub' },
              ],
            },
            {
              width: '50%',
              stack: [
                { text: 'NG\u01AF\u1EDCI DUY\u1EC6T', style: 'sigTitle' },
                { text: '(K\u00FD, ghi r\u00F5 h\u1ECD t\u00EAn)', style: 'sigSub' },
              ],
            },
          ],
        },
      ],

      footer: {
        text: `Tạo bởi ${this.appTitle} ngày ${this.formatDate(new Date())}`,
        alignment: 'center',
        fontSize: 7,
        color: LIGHT_GRAY,
        margin: [0, 10, 0, 0],
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    const buffer: Buffer = await doc.getBuffer();
    this.logger.log(`PDF export generated for quotation ${q.code}`);
    return buffer;
  }
}
