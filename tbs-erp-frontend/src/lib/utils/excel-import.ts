import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { z } from 'zod';
import {
  Branch,
  ClearanceType,
  Currency,
  ServiceType,
  ShippingRoute,
} from '@/lib/types/enums';
import type {
  CreateMasterOrderDto,
  CreateSubOrderDto,
  CreateOrderItemDto,
} from '@/lib/types';

// ============================================
// TYPES
// ============================================

/** Raw row parsed from Excel before validation */
export interface ExcelOrderRow {
  maKhachHang?: string;
  chiNhanh?: string;
  loaiDichVu?: string;
  thongQuan?: string;
  tuyenVanChuyen?: string;
  tenSanPham?: string;
  linkSanPham?: string;
  soLuong?: number;
  donGia?: number;
  donViTien?: string;
  ghiChu?: string;
}

export interface RowError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowIndex: number;
  data: ExcelOrderRow;
  errors: RowError[];
  isValid: boolean;
}

export interface GroupedMasterOrder {
  maKhachHang: string;
  chiNhanh: Branch;
  subOrders: GroupedSubOrder[];
}

export interface GroupedSubOrder {
  loaiDichVu: ServiceType;
  thongQuan: ClearanceType;
  tuyenVanChuyen?: ShippingRoute;
  items: GroupedItem[];
  ghiChu?: string;
}

export interface GroupedItem {
  tenSanPham: string;
  linkSanPham?: string;
  soLuong: number;
  donGia: number;
  donViTien: Currency;
  ghiChu?: string;
}

// ============================================
// EXCEL COLUMN HEADERS
// ============================================

const EXCEL_HEADERS = [
  'maKhachHang',
  'chiNhanh',
  'loaiDichVu',
  'thongQuan',
  'tuyenVanChuyen',
  'tenSanPham',
  'linkSanPham',
  'soLuong',
  'donGia',
  'donViTien',
  'ghiChu',
] as const;

// ============================================
// ZOD SCHEMA
// ============================================

export const excelRowSchema = z.object({
  maKhachHang: z
    .string({ required_error: 'Mã khách hàng là bắt buộc' })
    .min(1, 'Mã khách hàng là bắt buộc'),
  chiNhanh: z.nativeEnum(Branch, {
    errorMap: () => ({ message: 'Chi nhánh phải là HN hoặc HCM' }),
  }),
  loaiDichVu: z.nativeEnum(ServiceType, {
    errorMap: () => ({
      message: 'Loại dịch vụ phải là VCT, MHH, UTXNK hoặc LCLCN',
    }),
  }),
  thongQuan: z.nativeEnum(ClearanceType, {
    errorMap: () => ({
      message: 'Thông quan phải là CHINH_NGACH hoặc TIEU_NGACH',
    }),
  }),
  tuyenVanChuyen: z
    .nativeEnum(ShippingRoute, {
      errorMap: () => ({
        message: 'Tuyến vận chuyển phải là SEA, ROAD hoặc AIR',
      }),
    })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  tenSanPham: z
    .string({ required_error: 'Tên sản phẩm là bắt buộc' })
    .min(1, 'Tên sản phẩm là bắt buộc'),
  linkSanPham: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  soLuong: z
    .number({ required_error: 'Số lượng là bắt buộc', invalid_type_error: 'Số lượng phải là số' })
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng phải >= 1'),
  donGia: z
    .number({ required_error: 'Đơn giá là bắt buộc', invalid_type_error: 'Đơn giá phải là số' })
    .min(0, 'Đơn giá phải >= 0'),
  donViTien: z
    .nativeEnum(Currency, {
      errorMap: () => ({ message: 'Đơn vị tiền phải là VND, CNY hoặc USD' }),
    })
    .optional()
    .default(Currency.CNY),
  ghiChu: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

// ============================================
// PARSE EXCEL FILE
// ============================================

export function parseExcelFile(buffer: ArrayBuffer): ExcelOrderRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  return jsonData.map((row) => {
    const mapped: ExcelOrderRow = {};
    for (const header of EXCEL_HEADERS) {
      const value = row[header];
      if (header === 'soLuong' || header === 'donGia') {
        const num = Number(value);
        (mapped as Record<string, unknown>)[header] = isNaN(num) || value === '' ? value : num;
      } else {
        (mapped as Record<string, unknown>)[header] =
          value !== undefined && value !== null ? String(value).trim() : '';
      }
    }
    return mapped;
  });
}

// ============================================
// VALIDATE ROWS
// ============================================

export function validateRows(rows: ExcelOrderRow[]): ValidatedRow[] {
  return rows.map((row, index) => {
    const result = excelRowSchema.safeParse(row);
    if (result.success) {
      return {
        rowIndex: index + 2, // +2 because row 1 is header, data starts at row 2
        data: row,
        errors: [],
        isValid: true,
      };
    }
    const errors: RowError[] = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'unknown',
      message: issue.message,
    }));
    return {
      rowIndex: index + 2,
      data: row,
      errors,
      isValid: false,
    };
  });
}

// ============================================
// GROUP ROWS INTO MASTER ORDERS
// ============================================

export function groupRowsIntoMasterOrders(
  validRows: ValidatedRow[],
): GroupedMasterOrder[] {
  const masterMap = new Map<string, GroupedMasterOrder>();

  for (const row of validRows) {
    if (!row.isValid) continue;

    const parsed = excelRowSchema.parse(row.data);
    const masterKey = `${parsed.maKhachHang}|${parsed.chiNhanh}`;

    if (!masterMap.has(masterKey)) {
      masterMap.set(masterKey, {
        maKhachHang: parsed.maKhachHang,
        chiNhanh: parsed.chiNhanh,
        subOrders: [],
      });
    }

    const master = masterMap.get(masterKey)!;
    const subKey = `${parsed.loaiDichVu}|${parsed.thongQuan}|${parsed.tuyenVanChuyen || ''}`;

    let subOrder = master.subOrders.find(
      (s) =>
        `${s.loaiDichVu}|${s.thongQuan}|${s.tuyenVanChuyen || ''}` ===
        subKey,
    );

    if (!subOrder) {
      subOrder = {
        loaiDichVu: parsed.loaiDichVu,
        thongQuan: parsed.thongQuan,
        tuyenVanChuyen: parsed.tuyenVanChuyen || undefined,
        items: [],
      };
      master.subOrders.push(subOrder);
    }

    subOrder.items.push({
      tenSanPham: parsed.tenSanPham,
      linkSanPham: parsed.linkSanPham || undefined,
      soLuong: parsed.soLuong,
      donGia: parsed.donGia,
      donViTien: parsed.donViTien,
      ghiChu: parsed.ghiChu || undefined,
    });
  }

  return Array.from(masterMap.values());
}

// ============================================
// CONVERT TO API DTO
// ============================================

export function toCreateMasterOrderDto(
  group: GroupedMasterOrder,
  customerId: string,
): CreateMasterOrderDto {
  const subOrders: CreateSubOrderDto[] = group.subOrders.map((sub) => {
    const items: CreateOrderItemDto[] = sub.items.map((item) => ({
      productName: item.tenSanPham,
      productUrl: item.linkSanPham,
      quantity: item.soLuong,
      unitPrice: item.donGia,
      currency: item.donViTien,
      note: item.ghiChu,
    }));

    return {
      serviceType: sub.loaiDichVu,
      clearanceType: sub.thongQuan,
      shippingRoute: sub.tuyenVanChuyen,
      items,
      note: sub.ghiChu,
    };
  });

  return {
    customerId,
    branch: group.chiNhanh,
    subOrders,
  };
}

// ============================================
// DOWNLOAD TEMPLATE
// ============================================

export function downloadTemplate(): void {
  const sampleData = [
    {
      maKhachHang: 'KH001',
      chiNhanh: 'HN',
      loaiDichVu: 'VCT',
      thongQuan: 'CHINH_NGACH',
      tuyenVanChuyen: 'SEA',
      tenSanPham: 'Áo thun nam',
      linkSanPham: 'https://example.com/product-1',
      soLuong: 100,
      donGia: 50,
      donViTien: 'CNY',
      ghiChu: 'Giao gấp',
    },
    {
      maKhachHang: 'KH001',
      chiNhanh: 'HN',
      loaiDichVu: 'MHH',
      thongQuan: 'TIEU_NGACH',
      tuyenVanChuyen: 'ROAD',
      tenSanPham: 'Giày thể thao',
      linkSanPham: 'https://example.com/product-2',
      soLuong: 50,
      donGia: 120,
      donViTien: 'CNY',
      ghiChu: '',
    },
    {
      maKhachHang: 'KH002',
      chiNhanh: 'HCM',
      loaiDichVu: 'VCT',
      thongQuan: 'CHINH_NGACH',
      tuyenVanChuyen: 'AIR',
      tenSanPham: 'Linh kiện điện tử',
      linkSanPham: 'https://example.com/product-3',
      soLuong: 200,
      donGia: 30,
      donViTien: 'USD',
      ghiChu: 'Hàng dễ vỡ',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: [...EXCEL_HEADERS],
  });

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // maKhachHang
    { wch: 10 }, // chiNhanh
    { wch: 12 }, // loaiDichVu
    { wch: 16 }, // thongQuan
    { wch: 16 }, // tuyenVanChuyen
    { wch: 25 }, // tenSanPham
    { wch: 35 }, // linkSanPham
    { wch: 10 }, // soLuong
    { wch: 10 }, // donGia
    { wch: 10 }, // donViTien
    { wch: 20 }, // ghiChu
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DonHang');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, 'mau-nhap-don-hang.xlsx');
}
