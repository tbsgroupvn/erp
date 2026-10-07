import { Injectable, Logger } from '@nestjs/common';
import { PackingLot, PackingLotItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateLotInput = {
  lotNo: number;
  supplierName?: string;
  planPackages?: number;
  planQtyPerPack?: number | string;
  planSpec?: string;
  planWeightKg?: number | string;
  planCbm?: number | string;
  expectedReadyDate?: Date;
};

export type AddLotItemInput = {
  poItemId?: number;
  productName?: string;
  quantity?: number | string;
  unit?: string;
};

type LotResult = { ok: true; msg: string; lot: PackingLot } | { ok: false; msg: string };
type ItemResult = { ok: true; msg: string; item: PackingLotItem } | { ok: false; msg: string };

@Injectable()
export class PackingLotService {
  constructor(private prisma: PrismaService) {}

  // Cùng cơ chế (Logger của @nestjs/common) với src/common/http-exception.filter.ts
  // — lỗi CSDL không lường trước phải LOG đủ ở server, KHÔNG trả nguyên .message
  // ra client (Fix round 2, sau Task 4).
  private readonly logger = new Logger(PackingLotService.name);

  // ⚠⚠⚠ "1 dòng = 1 lô" (memory tbs-1dong-1lo-refactor-2808) — chốt chặn cấp
  // DB là unique(poId, lotNo) (Task 1, prisma/schema.prisma). Việc của tầng
  // service KHÔNG phải là tự kiểm tra trùng trước khi ghi (đó lại là
  // check-then-act, đua được y hệt các bẫy F8/claimUnclaimed đã cắn) — mà là
  // CỨ INSERT THẲNG rồi bắt `P2002` (Prisma unique-violation) và dịch nó
  // thành từ chối nghiệp vụ sạch, đúng quy ước `CustomerService`/`PoService`
  // (bắt P2002 trên po_code). Đo prod: `lot_no` là INTEGER trong phạm vi một
  // PO — HAI PO khác nhau được phép trùng lotNo vì unique ghép (poId, lotNo),
  // không phải unique một mình lotNo.
  async createLot(poId: number, input: CreateLotInput): Promise<LotResult> {
    if (!poId) return { ok: false, msg: 'Thiếu poId' };
    if (input.lotNo === undefined || input.lotNo === null || input.lotNo === ('' as any)) {
      return { ok: false, msg: 'Thiếu lotNo' };
    }
    const lotNo = Number(input.lotNo);
    if (!Number.isInteger(lotNo)) {
      return { ok: false, msg: 'lotNo phải là số nguyên (đo prod: INTEGER, không phải chuỗi)' };
    }

    try {
      const lot = await this.prisma.packingLot.create({
        data: {
          poId,
          lotNo,
          supplierName: (input.supplierName ?? '').trim() || null,
          planPackages: input.planPackages ?? null,
          planQtyPerPack: input.planQtyPerPack ?? null,
          planSpec: (input.planSpec ?? '').trim() || null,
          planWeightKg: input.planWeightKg ?? null,
          planCbm: input.planCbm ?? null,
          expectedReadyDate: input.expectedReadyDate ?? null,
        },
      });
      return { ok: true, msg: 'OK', lot };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return { ok: false, msg: `Lô ${lotNo} đã tồn tại trong PO ${poId} — "1 dòng = 1 lô", không được tạo trùng` };
      }
      // Lỗi KHÔNG lường trước (Prisma/Postgres thật) — .message có thể mang tên
      // bảng/cột/constraint/đường dẫn file. KHÔNG nối .message vào response
      // (Fix round 2) — log đủ ở server, trả người gọi một câu ổn định.
      this.logger.error('createLot: ' + (e?.message ?? String(e)), e?.stack);
      return { ok: false, msg: 'Không tạo được lô — vui lòng thử lại hoặc liên hệ IT' };
    }
  }

  async addLotItem(lotId: number, input: AddLotItemInput): Promise<ItemResult> {
    const lot = await this.prisma.packingLot.findUnique({ where: { id: lotId } });
    if (!lot) return { ok: false, msg: 'Không tìm thấy lô ' + lotId };

    const item = await this.prisma.packingLotItem.create({
      data: {
        lotId,
        poItemId: input.poItemId ?? null,
        productName: (input.productName ?? '').trim() || null,
        quantity: input.quantity ?? null,
        unit: (input.unit ?? '').trim() || null,
      },
    });
    return { ok: true, msg: 'OK', item };
  }

  async listByPo(poId: number): Promise<PackingLot[]> {
    return this.prisma.packingLot.findMany({ where: { poId }, orderBy: { lotNo: 'asc' } });
  }
}
