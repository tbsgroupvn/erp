import { Injectable } from '@nestjs/common';
import { KhoLoai } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';

export type UpsertCustomerGroupInput = { code: string; name: string };
export type UpsertWarehouseInput = {
  ma: string; ten: string; loai: KhoLoai;
  diaChi?: string; lat?: number; lng?: number; sort?: number;
};
export type UpsertCrmCategoryInput = { id?: number; name: string; sort?: number; active?: number };
export type UpsertExpenseCategoryInput = { code: string; name: string; glAccountCode?: string };

// Ba danh mục lõi #02 — CRUD mỏng, không thêm cơ chế gì ngoài brief:
// không soft-delete, không phân trang, không bảng audit.
@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // CustomerGroup: khoá chính là code (VARCHAR), KHÔNG phải id.
  async listCustomerGroups() {
    return this.prisma.customerGroup.findMany({ where: { isactive: 1 }, orderBy: { code: 'asc' } });
  }

  async upsertCustomerGroup(input: UpsertCustomerGroupInput, by: string) {
    const code = (input.code ?? '').trim();
    const name = (input.name ?? '').trim();
    const now = nowSec();
    return this.prisma.customerGroup.upsert({
      where: { code },
      create: { code, name, author: by, cdate: now, mdate: now },
      // Upsert = "nhóm này phải tồn tại và dùng được". Nếu chỉ ghi name mà
      // KHÔNG bật lại isactive thì người dùng upsert một nhóm đã tắt sẽ thấy
      // lệnh 'thành công' nhưng nhóm vẫn không hiện ở listCustomerGroups —
      // hỏng kiểu im lặng. Muốn tắt nhóm thì dùng đường tắt riêng.
      update: { name, isactive: 1, mdate: now },
    });
  }

  // Warehouse: khoá chính là ma (mã kho VARCHAR), loai chỉ VN/TQ (Postgres
  // enum KhoLoai thực thi — giá trị lạ bị DB từ chối). Listing luôn theo sort
  // (mô hình 4 kho load-bearing cho #07).
  async listWarehouses() {
    return this.prisma.warehouse.findMany({ where: { isactive: 1 }, orderBy: { sort: 'asc' } });
  }

  async upsertWarehouse(input: UpsertWarehouseInput) {
    const ma = (input.ma ?? '').trim();
    return this.prisma.warehouse.upsert({
      where: { ma },
      create: {
        ma, ten: input.ten, loai: input.loai,
        diaChi: input.diaChi, lat: input.lat, lng: input.lng, sort: input.sort ?? 0,
      },
      update: {
        ten: input.ten, loai: input.loai,
        diaChi: input.diaChi, lat: input.lat, lng: input.lng, sort: input.sort ?? 0,
      },
    });
  }

  // CrmCategory: id auto-increment bình thường, không có code riêng.
  async listCrmCategories() {
    return this.prisma.crmCategory.findMany({ where: { active: 1 }, orderBy: { sort: 'asc' } });
  }

  async upsertCrmCategory(input: UpsertCrmCategoryInput) {
    const name = (input.name ?? '').trim();
    const sort = input.sort ?? 0;
    const active = input.active ?? 1;
    if (input.id) {
      return this.prisma.crmCategory.update({ where: { id: input.id }, data: { name, sort, active } });
    }
    return this.prisma.crmCategory.create({ data: { name, sort, active, createdAt: nowSec() } });
  }

  // ExpenseCategory (tbl_chiphi_group): prod KHÔNG có glAccountCode — cột MỚI
  // của bản viết lại, nullable vì migrate xong sẽ rỗng cho cả 152 nhóm hiện có.
  // An toàn ghi sổ nằm ở listPostable(), không phải ở ràng buộc NOT NULL.
  // code không phải khoá chính trong schema (chỉ String? thường) nên upsert
  // thủ công bằng findFirst, không dùng prisma .upsert().
  async listPostable() {
    return this.prisma.expenseCategory.findMany({
      // status là VARCHAR(3) legacy, giá trị bật = 'yes' — KHÔNG chuyển sang boolean,
      // giữ nguyên kiểu chuỗi khớp dữ liệu prod (152 dòng đã có giá trị thật).
      where: { AND: [{ glAccountCode: { not: null } }, { glAccountCode: { not: '' } }, { status: 'yes' }] },
      orderBy: { code: 'asc' },
    });
  }

  async countMissingGlAccount() {
    return this.prisma.expenseCategory.count({
      where: { OR: [{ glAccountCode: null }, { glAccountCode: '' }] },
    });
  }

  async upsertExpenseCategory(input: UpsertExpenseCategoryInput, by: string) {
    const code = (input.code ?? '').trim();
    const name = (input.name ?? '').trim();
    const glAccountCode = input.glAccountCode?.trim() || null;
    const now = nowSec();

    if (glAccountCode) {
      const acc = await this.prisma.glAccount.findUnique({ where: { code: glAccountCode } });
      if (!acc) {
        throw new Error(`Tài khoản GL '${glAccountCode}' không tồn tại trong sổ`);
      }
    }

    const existing = await this.prisma.expenseCategory.findFirst({
      where: { code },
      orderBy: { id: 'asc' },
    });
    if (existing) {
      // Chỉ ghi glAccountCode khi input CÓ truyền field này — đổi tên đơn thuần
      // (không kèm glAccountCode) không được ÂM THẦM xoá mapping GL đã gắn.
      // Truyền chuỗi rỗng vẫn là xoá có chủ ý (input.glAccountCode !== undefined).
      const data: Record<string, unknown> = { name, mdate: now };
      if (input.glAccountCode !== undefined) data.glAccountCode = glAccountCode;
      return this.prisma.expenseCategory.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.expenseCategory.create({
      data: { code, name, glAccountCode, author: by, cdate: now, mdate: now },
    });
  }
}
