import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import * as ExcelJS from 'exceljs';

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

  constructor(private readonly prisma: PrismaService) {}

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
    workbook.creator = 'TBS ERP System';
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
    companyCell.value = 'C\u00D4NG TY TNHH TBS GROUP';
    companyCell.font = { bold: true, size: 16, color: { argb: 'FF1A56DB' } };
    companyCell.alignment = { horizontal: 'center' };
    row++;

    ws.mergeCells(`A${row}:F${row}`);
    const addressCell = ws.getCell(`A${row}`);
    addressCell.value =
      '\u0110\u1ECBa ch\u1EC9: H\u00E0 N\u1ED9i, Vi\u1EC7t Nam | \u0110T: 0123.456.789 | MST: 0123456789';
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

  /**
   * Generates a professional PDF quotation document using PDFKit.
   *
   * Note: PDFKit's built-in Helvetica font does not support Vietnamese diacritics.
   * For full Vietnamese support, embed a TTF font (e.g., Roboto, Noto Sans)
   * in the project and register it with doc.registerFont().
   * ASCII-approximated labels are used for standard Helvetica compatibility.
   */
  async generatePdf(id: string): Promise<Buffer> {
    const q = await this.getQuotationData(id);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          bufferPages: true,
          info: {
            Title: `Quotation ${q.code}`,
            Author: 'TBS ERP System',
            Subject: 'Service Quotation',
            Creator: 'TBS ERP',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const result = Buffer.concat(chunks);
          this.logger.log(`PDF export generated for quotation ${q.code}`);
          resolve(result);
        });
        doc.on('error', (err: Error) => reject(err));

        const pageWidth = doc.page.width;
        const marginLeft = 50;
        const marginRight = 50;
        const contentWidth = pageWidth - marginLeft - marginRight;

        const BLUE = '#1A56DB';
        const GRAY = '#666666';
        const LIGHT_GRAY = '#999999';
        const RED = '#DC2626';
        const BLACK = '#000000';
        const WHITE = '#FFFFFF';
        const TABLE_BORDER = '#CCCCCC';
        const HEADER_BG = '#1A56DB';
        const ROW_ALT_BG = '#F9FAFB';

        // --- COMPANY HEADER ---
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor(BLUE)
          .text('CONG TY TNHH TBS GROUP', marginLeft, doc.y, {
            align: 'center',
            width: contentWidth,
          });
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(GRAY)
          .text(
            'Dia chi: Ha Noi, Viet Nam | DT: 0123.456.789 | MST: 0123456789',
            marginLeft,
            doc.y,
            { align: 'center', width: contentWidth },
          );

        doc.moveDown(0.5);

        // Divider line
        const dividerY = doc.y;
        doc
          .moveTo(marginLeft, dividerY)
          .lineTo(pageWidth - marginRight, dividerY)
          .strokeColor(BLUE)
          .lineWidth(2)
          .stroke();

        doc.moveDown(1);

        // --- TITLE ---
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text('BAO GIA DICH VU', marginLeft, doc.y, {
            align: 'center',
            width: contentWidth,
          });
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor(BLACK)
          .text(`So: ${q.code}`, marginLeft, doc.y, {
            align: 'center',
            width: contentWidth,
          });

        doc.moveDown(1.5);

        // --- TWO-COLUMN: CUSTOMER INFO & SERVICE INFO ---
        const colWidth = contentWidth / 2 - 10;
        const colStartY = doc.y;

        // Left column: Customer Info
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(BLUE)
          .text('THONG TIN KHACH HANG', marginLeft, colStartY, {
            width: colWidth,
          });
        doc.moveDown(0.3);

        const customerLines: [string, string][] = [
          ['Khach hang: ', q.customer?.fullName || '---'],
          ['Cong ty: ', q.customer?.companyName || '---'],
          ['Ma KH: ', q.customer?.code || '---'],
          ['Dien thoai: ', q.customer?.phone || '---'],
          ['Email: ', q.customer?.email || '---'],
        ];

        let leftY = doc.y;
        for (const [label, value] of customerLines) {
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor(BLACK)
            .text(label, marginLeft, leftY, {
              continued: true,
              width: colWidth,
            });
          doc
            .font('Helvetica')
            .text(value, { width: colWidth });
          leftY = doc.y;
        }
        const leftEndY = doc.y;

        // Right column: Service Info
        const rightColX = marginLeft + colWidth + 20;
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(BLUE)
          .text('THONG TIN DICH VU', rightColX, colStartY, {
            width: colWidth,
          });

        let rightY = colStartY + doc.currentLineHeight() + 4;

        const serviceLines: [string, string][] = [
          ['Loai DV: ', SERVICE_TYPE_MAP[q.serviceType] || q.serviceType],
          ['Chi nhanh: ', BRANCH_MAP[q.branch] || q.branch],
          [
            'Tuyen: ',
            q.shippingRoute
              ? SHIPPING_ROUTE_MAP[q.shippingRoute] || q.shippingRoute
              : '---',
          ],
          ['Ngay tao: ', this.formatDate(q.createdAt)],
          [
            'Hieu luc: ',
            q.validUntil ? this.formatDate(q.validUntil) : '---',
          ],
        ];

        for (const [label, value] of serviceLines) {
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor(BLACK)
            .text(label, rightColX, rightY, {
              continued: true,
              width: colWidth,
            });
          doc.font('Helvetica').text(value, { width: colWidth });
          rightY = doc.y;
        }

        // Move past both columns
        doc.y = Math.max(leftEndY, rightY);
        doc.moveDown(1.5);

        // --- ITEMS TABLE ---
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(BLUE)
          .text('CHI TIET HANG MUC', marginLeft, doc.y, {
            width: contentWidth,
          });
        doc.moveDown(0.5);

        // Table configuration
        const colWidths = [30, 195, 40, 100, 100];
        const tableHeaders = ['STT', 'Ten san pham', 'SL', 'Don gia', 'Thanh tien'];
        const rowHeight = 22;
        const tableX = marginLeft;

        // Draw table header
        let tableY = doc.y;
        let xPos = tableX;

        // Header background
        doc
          .rect(tableX, tableY, contentWidth, rowHeight)
          .fill(HEADER_BG);

        xPos = tableX;
        for (let i = 0; i < tableHeaders.length; i++) {
          const cellPadding = 4;
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor(WHITE)
            .text(tableHeaders[i], xPos + cellPadding, tableY + 6, {
              width: colWidths[i] - cellPadding * 2,
              align: i === 0 || i === 2 ? 'center' : i >= 3 ? 'right' : 'left',
            });
          xPos += colWidths[i];
        }

        tableY += rowHeight;

        // Draw table rows
        q.items.forEach((item, index) => {
          // Check for page break
          if (tableY + rowHeight > doc.page.height - 100) {
            doc.addPage();
            tableY = 50;
          }

          // Alternate row background
          if (index % 2 === 1) {
            doc
              .rect(tableX, tableY, contentWidth, rowHeight)
              .fill(ROW_ALT_BG);
          }

          const rowValues = [
            String(index + 1),
            item.productName,
            String(item.quantity),
            this.formatCurrency(item.unitPrice),
            this.formatCurrency(item.totalPrice),
          ];

          xPos = tableX;
          for (let i = 0; i < rowValues.length; i++) {
            const cellPadding = 4;
            doc
              .fontSize(9)
              .font('Helvetica')
              .fillColor(BLACK)
              .text(rowValues[i], xPos + cellPadding, tableY + 6, {
                width: colWidths[i] - cellPadding * 2,
                align:
                  i === 0 || i === 2
                    ? 'center'
                    : i >= 3
                      ? 'right'
                      : 'left',
                lineBreak: false,
              });
            xPos += colWidths[i];
          }

          // Draw row borders
          doc
            .moveTo(tableX, tableY + rowHeight)
            .lineTo(tableX + contentWidth, tableY + rowHeight)
            .strokeColor(TABLE_BORDER)
            .lineWidth(0.5)
            .stroke();

          tableY += rowHeight;
        });

        // Draw outer table border
        doc
          .rect(
            tableX,
            tableY - (q.items.length + 1) * rowHeight,
            contentWidth,
            (q.items.length + 1) * rowHeight,
          )
          .strokeColor(TABLE_BORDER)
          .lineWidth(0.5)
          .stroke();

        // Draw vertical column separators
        xPos = tableX;
        const tableTopY = tableY - (q.items.length + 1) * rowHeight;
        for (let i = 0; i < colWidths.length - 1; i++) {
          xPos += colWidths[i];
          doc
            .moveTo(xPos, tableTopY)
            .lineTo(xPos, tableY)
            .strokeColor(TABLE_BORDER)
            .lineWidth(0.5)
            .stroke();
        }

        doc.y = tableY;
        doc.moveDown(1);

        // --- TOTALS ---
        const totalsX = marginLeft + contentWidth - 250;
        const totalsLabelWidth = 130;
        const totalsValueWidth = 110;

        const totalRows: [string, string, string?, boolean?][] = [
          ['Tam tinh:', this.formatCurrency(q.subtotal)],
          [
            `Giam gia (${Number(q.discountPercent)}%):`,
            `-${this.formatCurrency(q.discountAmount)}`,
            RED,
          ],
          [
            `Thue (${(Number(q.taxRate) * 100).toFixed(0)}%):`,
            this.formatCurrency(q.taxAmount),
          ],
        ];

        for (const [label, value, color] of totalRows) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor(BLACK)
            .text(label, totalsX, doc.y, {
              width: totalsLabelWidth,
              align: 'right',
              continued: false,
            });
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor(color || BLACK)
            .text(value, totalsX + totalsLabelWidth + 5, doc.y - doc.currentLineHeight(), {
              width: totalsValueWidth,
              align: 'right',
            });
        }

        // Divider before grand total
        doc
          .moveTo(totalsX, doc.y + 2)
          .lineTo(totalsX + totalsLabelWidth + totalsValueWidth + 5, doc.y + 2)
          .strokeColor(BLACK)
          .lineWidth(1)
          .stroke();
        doc.moveDown(0.3);

        // Grand total
        const grandTotalY = doc.y;
        doc
          .fontSize(13)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text('TONG CONG:', totalsX, grandTotalY, {
            width: totalsLabelWidth,
            align: 'right',
          });
        doc
          .fontSize(13)
          .font('Helvetica-Bold')
          .fillColor(RED)
          .text(
            this.formatCurrency(q.totalAmount),
            totalsX + totalsLabelWidth + 5,
            grandTotalY,
            { width: totalsValueWidth, align: 'right' },
          );

        doc.moveDown(1.5);

        // --- NOTES ---
        if (q.note) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor(BLACK)
            .text('Ghi chu: ', marginLeft, doc.y, {
              continued: true,
              width: contentWidth,
            });
          doc
            .font('Helvetica-Oblique')
            .text(q.note, { width: contentWidth });
          doc.moveDown(1);
        }

        // --- TERMS ---
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(BLUE)
          .text('DIEU KHOAN', marginLeft, doc.y, { width: contentWidth });
        doc.moveDown(0.3);

        const pdfTerms = [
          '1. Bao gia co hieu luc trong thoi gian ghi tren.',
          '2. Gia tren chua bao gom cac chi phi phat sinh ngoai dich vu da thoa thuan.',
          '3. Thanh toan theo quy dinh cua cong ty.',
          '4. Moi thac mac xin lien he bo phan kinh doanh.',
        ];
        for (const term of pdfTerms) {
          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(GRAY)
            .text(term, marginLeft, doc.y, { width: contentWidth });
        }

        doc.moveDown(2);

        // --- SIGNATURES ---
        // Check if we need a new page for signatures
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
        }

        const sigY = doc.y;
        const sigColWidth = contentWidth / 2;

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text('NGUOI LAP BAO GIA', marginLeft, sigY, {
            width: sigColWidth,
            align: 'center',
          });
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .fillColor(LIGHT_GRAY)
          .text('(Ky, ghi ro ho ten)', marginLeft, doc.y, {
            width: sigColWidth,
            align: 'center',
          });

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text('NGUOI DUYET', marginLeft + sigColWidth, sigY, {
            width: sigColWidth,
            align: 'center',
          });
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .fillColor(LIGHT_GRAY)
          .text(
            '(Ky, ghi ro ho ten)',
            marginLeft + sigColWidth,
            sigY + doc.currentLineHeight() + 2,
            { width: sigColWidth, align: 'center' },
          );

        // Footer
        const footerY = doc.page.height - 40;
        doc
          .fontSize(7)
          .font('Helvetica')
          .fillColor(LIGHT_GRAY)
          .text(
            `Generated by TBS ERP System on ${this.formatDate(new Date())}`,
            marginLeft,
            footerY,
            { width: contentWidth, align: 'center' },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
