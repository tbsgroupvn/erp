import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface CarrierColumnMapping {
  trackingNumber: string;
  status?: string;
  codAmount: string;
  shippingFee: string;
  returnFee?: string;
  otherFee?: string;
  netAmount?: string;
  weight?: string;
}

export interface ParsedRow {
  rowNumber: number;
  carrierTrackingNumber: string;
  carrierStatus: string | null;
  codAmount: number;
  shippingFee: number;
  returnFee: number;
  otherFee: number;
  netAmount: number;
  carrierWeight: number | null;
}

const CARRIER_PRESETS: Record<string, CarrierColumnMapping> = {
  GHTK: {
    trackingNumber: 'Ma van don',
    status: 'Trang thai',
    codAmount: 'Tien thu ho',
    shippingFee: 'Cuoc van chuyen',
    returnFee: 'Phi hoan',
    otherFee: 'Phi khac',
    netAmount: 'Thuc nhan',
    weight: 'Trong luong',
  },
  GHN: {
    trackingNumber: 'Ma don hang',
    status: 'Trang thai don hang',
    codAmount: 'Tien thu ho (COD)',
    shippingFee: 'Phi van chuyen',
    returnFee: 'Phi hoan hang',
    otherFee: 'Phi khac',
    netAmount: 'So tien doi soat',
    weight: 'Trong luong (gram)',
  },
  VIETTEL_POST: {
    trackingNumber: 'Ma van don',
    status: 'Tinh trang',
    codAmount: 'Tien COD',
    shippingFee: 'Cuoc phi',
    returnFee: 'Phi hoan',
    otherFee: 'Phi phat sinh',
    netAmount: 'Thanh toan',
    weight: 'Trong luong',
  },
  JT: {
    trackingNumber: 'So van don',
    status: 'Trang thai',
    codAmount: 'Thu ho COD',
    shippingFee: 'Cuoc van chuyen',
    returnFee: 'Phi tra hang',
    otherFee: 'Phi khac',
    netAmount: 'Thuc nhan',
    weight: 'Trong luong',
  },
};

@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name);

  getPresetMapping(carrierName: string): CarrierColumnMapping | undefined {
    return CARRIER_PRESETS[carrierName];
  }

  async parse(
    buffer: Buffer,
    carrierName: string,
    customMapping?: Record<string, string>,
  ): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('File Excel khong co sheet nao');
    }

    // Resolve column mapping
    const preset = CARRIER_PRESETS[carrierName];
    const mapping: CarrierColumnMapping = customMapping
      ? {
          trackingNumber: customMapping.trackingNumber || preset?.trackingNumber || 'Ma van don',
          status: customMapping.status || preset?.status,
          codAmount: customMapping.codAmount || preset?.codAmount || 'Tien thu ho',
          shippingFee: customMapping.shippingFee || preset?.shippingFee || 'Cuoc van chuyen',
          returnFee: customMapping.returnFee || preset?.returnFee,
          otherFee: customMapping.otherFee || preset?.otherFee,
          netAmount: customMapping.netAmount || preset?.netAmount,
          weight: customMapping.weight || preset?.weight,
        }
      : preset || {
          trackingNumber: 'Ma van don',
          codAmount: 'Tien thu ho',
          shippingFee: 'Cuoc van chuyen',
        };

    // Find header row and build column index map
    const headerRow = worksheet.getRow(1);
    const columnMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const headerText = String(cell.value ?? '').trim();
      columnMap[headerText] = colNumber;
    });

    // Resolve column numbers from mapping
    const colTrackingNumber = this.findColumn(columnMap, mapping.trackingNumber);
    if (colTrackingNumber === -1) {
      throw new BadRequestException(
        `Khong tim thay cot "${mapping.trackingNumber}" trong file Excel. ` +
          `Cac cot co san: ${Object.keys(columnMap).join(', ')}`,
      );
    }

    const colStatus = mapping.status ? this.findColumn(columnMap, mapping.status) : -1;
    const colCodAmount = this.findColumn(columnMap, mapping.codAmount);
    const colShippingFee = this.findColumn(columnMap, mapping.shippingFee);
    const colReturnFee = mapping.returnFee ? this.findColumn(columnMap, mapping.returnFee) : -1;
    const colOtherFee = mapping.otherFee ? this.findColumn(columnMap, mapping.otherFee) : -1;
    const colNetAmount = mapping.netAmount ? this.findColumn(columnMap, mapping.netAmount) : -1;
    const colWeight = mapping.weight ? this.findColumn(columnMap, mapping.weight) : -1;

    const rows: ParsedRow[] = [];
    const totalRows = worksheet.rowCount;

    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const trackingNumber = this.getCellString(row, colTrackingNumber);
      if (!trackingNumber) continue; // skip empty rows

      const codAmount = this.getCellNumber(row, colCodAmount);
      const shippingFee = this.getCellNumber(row, colShippingFee);
      const returnFee = colReturnFee > 0 ? this.getCellNumber(row, colReturnFee) : 0;
      const otherFee = colOtherFee > 0 ? this.getCellNumber(row, colOtherFee) : 0;
      const netAmount =
        colNetAmount > 0 ? this.getCellNumber(row, colNetAmount) : codAmount - shippingFee - returnFee - otherFee;
      const weight = colWeight > 0 ? this.getCellNumber(row, colWeight) : null;
      const status = colStatus > 0 ? this.getCellString(row, colStatus) : null;

      rows.push({
        rowNumber: rowNum,
        carrierTrackingNumber: trackingNumber,
        carrierStatus: status,
        codAmount,
        shippingFee,
        returnFee,
        otherFee,
        netAmount,
        carrierWeight: weight,
      });
    }

    this.logger.log(`Parsed ${rows.length} rows from Excel (carrier: ${carrierName})`);
    return rows;
  }

  private findColumn(columnMap: Record<string, number>, targetHeader: string): number {
    // Exact match first
    if (columnMap[targetHeader] !== undefined) {
      return columnMap[targetHeader];
    }
    // Case-insensitive + trim
    const lower = targetHeader.toLowerCase();
    for (const [header, col] of Object.entries(columnMap)) {
      if (header.toLowerCase() === lower) return col;
    }
    // Fuzzy: contains
    for (const [header, col] of Object.entries(columnMap)) {
      if (header.toLowerCase().includes(lower) || lower.includes(header.toLowerCase())) {
        return col;
      }
    }
    return -1;
  }

  private getCellString(row: ExcelJS.Row, colNumber: number): string {
    if (colNumber <= 0) return '';
    const cell = row.getCell(colNumber);
    return String(cell.value ?? '').trim();
  }

  private getCellNumber(row: ExcelJS.Row, colNumber: number): number {
    if (colNumber <= 0) return 0;
    const cell = row.getCell(colNumber);
    const val = cell.value;
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }
}
