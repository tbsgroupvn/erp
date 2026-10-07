import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';

export type AddPayInfoInput = {
  bankAccount: string;
  receiverName: string;
  bankName: string;
  qrImage?: string;
  note?: string;
};

export type UpsertSupplierCnInput = {
  id?: number;
  name: string;
  address?: string;
  region?: string;
  industry?: string;
  receiverName?: string;
  bankName?: string;
  bankAccount?: string;
  qrImage?: string;
  note?: string;
  saleUsername?: string;
  isActive?: number;
};

export type UpsertSupplierVnInput = {
  id?: number;
  name: string;
  taxCode?: string;
  loaiDichvu?: string;
  bankName?: string;
  bankAccount?: string;
  creditDays?: number;
  note?: string;
  isActive?: number;
};

// STK nhận tiền NCC (tbl_ncc_pay_info) — danh mục chống chi nhầm (§4.5):
// timesUsed/lastUsedAt cho UI biết STK QUEN, STK KHÔNG có trong bảng này là
// STK LẠ và phải soát trước khi chi. bankAccount UNIQUE + luôn trim() cả lúc
// ghi lẫn lúc tra — thiếu 1 trong 2 chỗ là STK quen bị báo lạ (hoặc ngược lại).
@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  async addPayInfo(input: AddPayInfoInput, by: string) {
    const bankAccount = (input.bankAccount ?? '').trim();
    const receiverName = (input.receiverName ?? '').trim();
    const bankName = (input.bankName ?? '').trim();
    const qrImage = (input.qrImage ?? '').trim();
    const note = (input.note ?? '').trim();

    // upsert theo bankAccount (UNIQUE) — thêm trùng phải GỘP vào dòng cũ,
    // không đẻ dòng mới. Không đụng timesUsed/lastUsedAt ở đây: đây là thao
    // tác đăng ký/sửa thông tin STK, không phải một lượt dùng.
    return this.prisma.supplierPayInfo.upsert({
      where: { bankAccount },
      create: { bankAccount, receiverName, bankName, qrImage, note, createdBy: by },
      update: { receiverName, bankName, qrImage, note },
    });
  }

  async markUsed(bankAccount: string) {
    const acc = (bankAccount ?? '').trim();
    return this.prisma.supplierPayInfo.update({
      where: { bankAccount: acc },
      data: { timesUsed: { increment: 1 }, lastUsedAt: nowSec() },
    });
  }

  async listPayInfos(q?: string) {
    const kw = (q ?? '').trim();
    if (!kw) return this.prisma.supplierPayInfo.findMany({ orderBy: { timesUsed: 'desc' } });
    return this.prisma.supplierPayInfo.findMany({
      where: {
        OR: [
          { bankAccount: { contains: kw, mode: 'insensitive' } },
          { receiverName: { contains: kw, mode: 'insensitive' } },
          { bankName: { contains: kw, mode: 'insensitive' } },
        ],
      },
      orderBy: { timesUsed: 'desc' },
    });
  }

  // Cổng gác chống chi nhầm — STK lạ (không trong danh mục) trả false.
  async isKnownAccount(bankAccount: string): Promise<boolean> {
    const acc = (bankAccount ?? '').trim();
    if (!acc) return false;
    const p = await this.prisma.supplierPayInfo.findUnique({ where: { bankAccount: acc } });
    return !!p;
  }

  // --- SupplierCn (tbl_ncc) — CRUD mỏng ---
  async listSuppliersCn() {
    return this.prisma.supplierCn.findMany({ where: { isActive: 1 }, orderBy: { id: 'desc' } });
  }

  async createSupplierCn(input: UpsertSupplierCnInput) {
    const now = nowSec();
    return this.prisma.supplierCn.create({
      data: {
        name: (input.name ?? '').trim(),
        address: input.address?.trim() || null,
        region: input.region?.trim() || null,
        industry: input.industry?.trim() || null,
        receiverName: input.receiverName?.trim() || null,
        bankName: input.bankName?.trim() || null,
        bankAccount: input.bankAccount?.trim() || null,
        qrImage: input.qrImage?.trim() || null,
        note: input.note?.trim() || null,
        saleUsername: input.saleUsername?.trim() || null,
        isActive: input.isActive ?? 1,
        cdate: now,
        udate: now,
      },
    });
  }

  async updateSupplierCn(id: number, input: Partial<UpsertSupplierCnInput>) {
    const data: Record<string, unknown> = { udate: nowSec() };
    for (const k of ['name', 'address', 'region', 'industry', 'receiverName', 'bankName',
      'bankAccount', 'qrImage', 'note', 'saleUsername'] as const) {
      if (input[k] !== undefined) data[k] = (input[k] as string)?.trim() || null;
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.supplierCn.update({ where: { id }, data });
  }

  async deleteSupplierCn(id: number) {
    // Xoá mềm — NCC có thể đã gắn PO/hồ sơ ở nơi khác, không xoá cứng.
    return this.prisma.supplierCn.update({ where: { id }, data: { isActive: 0, udate: nowSec() } });
  }

  // --- SupplierVn (tbl_ncc_vn) — CRUD mỏng ---
  async listSuppliersVn() {
    return this.prisma.supplierVn.findMany({ where: { isActive: 1 }, orderBy: { id: 'desc' } });
  }

  async createSupplierVn(input: UpsertSupplierVnInput, by: string) {
    return this.prisma.supplierVn.create({
      data: {
        name: (input.name ?? '').trim(),
        taxCode: input.taxCode?.trim() || null,
        loaiDichvu: input.loaiDichvu?.trim() || null,
        bankName: input.bankName?.trim() || null,
        bankAccount: input.bankAccount?.trim() || null,
        creditDays: input.creditDays ?? 0,
        note: input.note?.trim() || null,
        isActive: input.isActive ?? 1,
        createdBy: by,
        cdate: nowSec(),
      },
    });
  }

  async updateSupplierVn(id: number, input: Partial<UpsertSupplierVnInput>) {
    const data: Record<string, unknown> = {};
    for (const k of ['name', 'taxCode', 'loaiDichvu', 'bankName', 'bankAccount', 'note'] as const) {
      if (input[k] !== undefined) data[k] = (input[k] as string)?.trim() || null;
    }
    if (input.creditDays !== undefined) data.creditDays = input.creditDays;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.supplierVn.update({ where: { id }, data });
  }

  async deleteSupplierVn(id: number) {
    return this.prisma.supplierVn.update({ where: { id }, data: { isActive: 0 } });
  }
}
