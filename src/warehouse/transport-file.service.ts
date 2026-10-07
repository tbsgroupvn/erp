import { Injectable } from '@nestjs/common';
import { CargoType, KhoTqReceipt, TransportFile, TransportFileItem, TransportFilePackage, TransportType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';

export type CreateFileInput = {
  fileCode?: string;
  route?: string;
  truckBillNo?: string;
  transportType?: TransportType;
  cargoType?: CargoType;
  contSize?: string;
  maxVolume?: number | string;
  maxWeight?: number | string;
  assignedTo?: string;
};

export type LoadPackageInput = {
  packageCode?: string;
  weight?: number | string;
  volume?: number | string;
  // F6 (review cuối #07): nối kiện lên cont về ĐÚNG phiếu nhận kho TQ nó
  // xuất phát — xem TransportFilePackage.khotqReceiptId trong schema.prisma
  // (đo prod: FK có giá trị ở 100% 1.568 dòng) + receiptsForFile() bên dưới.
  // Optional vì không phải mọi kiện lên cont đều bắt nguồn từ một phiếu nhận
  // kho TQ đã ghi trong hệ (dữ liệu nạp cũ, hoặc nạp tay ngoài luồng) — ép
  // bắt buộc ở đây sẽ chặn cả những đường hợp lệ khác của loadPackage().
  khotqReceiptId?: number | null;
};

export type LoadItemInput = {
  productName?: string;
  quantity?: number | string;
  unit?: string;
};

type FileResult = { ok: true; msg: string; file: TransportFile } | { ok: false; msg: string };
type PackageResult = { ok: true; msg: string; package: TransportFilePackage } | { ok: false; msg: string };
type ItemResult = { ok: true; msg: string; item: TransportFileItem } | { ok: false; msg: string };
type MilestoneResult = { ok: true; msg: string; status: number } | { ok: false; msg: string };
type LockResult = { ok: true; msg: string } | { ok: false; msg: string };

type Milestones = {
  packDate: Date | null;
  runDate: Date | null;
  arrivalDate: Date | null;
  clearanceDate: Date | null;
};

// Mốc nào GHI ĐƯỢC sau khi cont đã customsLock — xem lý giải đầy đủ ở
// setMilestone() bên dưới.
type MilestoneField = keyof Milestones;
const FROZEN_AFTER_LOCK: Record<MilestoneField, boolean> = {
  packDate: true,
  runDate: true,
  arrivalDate: false,
  clearanceDate: false,
};

@Injectable()
export class TransportFileService {
  constructor(private prisma: PrismaService) {}

  // ═══ status SUY RA từ mốc thời gian, KHÔNG nhập tay ═════════════════════
  //
  // Vòng đời thật của một cont (§4.6): đóng hàng (packDate) -> xe/tàu chạy
  // (runDate) -> cập cảng/kho đích (arrivalDate) -> thông quan xong
  // (clearanceDate). Bốn mốc này TUẦN TỰ trong đời thật — mốc sau chỉ có ý
  // nghĩa khi mốc trước đã có — nên suy status từ "mốc XA NHẤT đã đạt" là đủ,
  // không cần lưu status như một trường độc lập có thể lệch khỏi dữ liệu mốc.
  //
  //   0 = chưa có mốc nào (mới tạo)
  //   1 = đã có packDate
  //   2 = đã có runDate
  //   3 = đã có arrivalDate
  //   4 = đã có clearanceDate
  //
  // ⚠ Đo prod 23/09/2026 (xem plan mục "⚠ ĐO PROD"): 14 cont, status chỉ có
  // 0 (10 dòng) và 1 (4 dòng) — status 2/3/4 là ĐƯỜNG CHƯA CÓ DỮ LIỆU THẬT,
  // chỉ được suy luận từ đặc tả, chưa được một cont thật nào đi qua.
  private computeStatus(m: Milestones): number {
    if (m.clearanceDate) return 4;
    if (m.arrivalDate) return 3;
    if (m.runDate) return 2;
    if (m.packDate) return 1;
    return 0;
  }

  // ⚠⚠ F4 (review cuối #07): bản đầu là check-then-act thuần —
  // `findUnique` -> tính status -> `update({where:{id}}))` KHÔNG điều kiện.
  // Mọi transition khác trong module này (`customsLock`, `claimUnclaimed`,
  // `ack`/`close`) đã nguyên tử; đây là chỗ CUỐI còn hở. Kịch bản cắn thật:
  // syncStatus(7) đọc thấy packDate đã set (tính ra status=1); TRƯỚC KHI câu
  // update của nó chạy, setClearanceDate(7,...) xen vào, commit cả
  // clearanceDate LẪN status=4 trong transaction riêng của nó; syncStatus
  // sau đó ghi status=1 ĐÈ LÊN — cont hiện "đã đóng gói" trong khi
  // clearanceDate đã có, sai cho tới khi ai đó gọi lại syncStatus().
  //
  // Sửa: `updateMany({where:{id, status: <status ĐÃ ĐỌC>}})` — Postgres chỉ
  // khớp và ghi khi status CÒN đúng giá trị lúc đọc tại thời điểm THỰC THI
  // UPDATE, không phải tại thời điểm code đọc. `count===0` nghĩa là một
  // transition khác (setPackDate/setRunDate/.../customsLock không đụng
  // status nhưng setMilestone thì có) đã đổi status xen giữa — KHÔNG coi đó
  // là lỗi cho người gọi: việc của syncStatus() là làm cho status ĐÚNG với
  // mốc hiện tại, và "mốc hiện tại" vừa đổi thật; retry (đọc lại, tính lại,
  // ghi lại có điều kiện) là hành vi đúng, không phải một cuộc tranh chấp cần
  // từ chối như `customsLock`/`claimUnclaimed` (ở đó hai actor tranh nhau
  // MỘT hành động; ở đây chỉ có một hành động "làm đúng status", retry hội
  // tụ về đúng giá trị mới nhất). Giới hạn số lần thử để không xoay vô hạn
  // dưới tranh chấp bệnh lý (thực tế mỗi vòng retry đọc được một mốc mới hơn,
  // nên hội tụ rất nhanh — vòng lặp dài là dấu hiệu bất thường, trả lỗi thay
  // vì treo).
  async syncStatus(fileId: number): Promise<MilestoneResult> {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const file = await this.prisma.transportFile.findUnique({ where: { id: fileId } });
      if (!file) return { ok: false, msg: 'Không tìm thấy hồ sơ vận chuyển ' + fileId };
      const status = this.computeStatus(file);
      if (file.status === status) return { ok: true, msg: 'OK', status };

      const result = await this.prisma.transportFile.updateMany({
        where: { id: fileId, status: file.status },
        data: { status },
      });
      if (result.count > 0) return { ok: true, msg: 'OK', status };
      // count===0: status đã đổi giữa lúc đọc và lúc ghi (một setMilestone()
      // khác vừa chạy) -> đọc lại từ đầu vòng for, tính lại theo dữ liệu MỚI.
    }
    return { ok: false, msg: 'Không đồng bộ được trạng thái do tranh chấp ghi liên tục ' + fileId };
  }

  async createFile(input: CreateFileInput, by: string): Promise<FileResult> {
    const file = await this.prisma.transportFile.create({
      data: {
        fileCode: (input.fileCode ?? '').trim() || null,
        route: (input.route ?? '').trim() || null,
        truckBillNo: (input.truckBillNo ?? '').trim() || null,
        transportType: input.transportType ?? null,
        cargoType: input.cargoType ?? null,
        contSize: (input.contSize ?? '').trim() || null,
        maxVolume: input.maxVolume ?? null,
        maxWeight: input.maxWeight ?? null,
        assignedTo: (input.assignedTo ?? '').trim() || null,
        status: 0,
        customsLocked: 0,
        createdBy: (by ?? '').trim() || null,
        createdAt: nowSec(),
      },
    });
    return { ok: true, msg: 'OK', file };
  }

  // ═══ Nạp kiện/hàng — CHẶN THẬT sau customsLock (§4.6) ═══════════════════
  //
  // Không thể dùng mẫu `updateMany({where:{id, customsLocked:0}})` ở đây như
  // `customsLock()` bên dưới: câu ghi thật sự là INSERT vào một bảng khác
  // (`tbl_transport_file_packages`/`tbl_transport_file_items`), không phải
  // UPDATE trên chính dòng `TransportFile` đang giữ cờ khoá — không có một
  // câu lệnh nguyên tử duy nhất vừa đọc cờ vừa ghi bảng con. Thay vào đó,
  // khoá DÒNG cha bằng `SELECT ... FOR UPDATE` trong một transaction (cùng
  // khuôn mẫu `PoService.cancel` #06 dùng khi đọc-rồi-ghi không tách được
  // thành updateMany đơn) rồi kiểm cờ + INSERT bảng con trong CÙNG
  // transaction đó — một `customsLock()` chạy đồng thời buộc phải CHỜ tới
  // khi transaction này commit/rollback mới đọc được cờ, nên không có khe hở
  // giữa "đọc cờ" và "ghi kiện" để một `customsLock()` chen vào giữa.
  async loadPackage(fileId: number, input: LoadPackageInput): Promise<PackageResult> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ customs_locked: number }>>`
        SELECT customs_locked FROM tbl_transport_files WHERE id = ${fileId} FOR UPDATE
      `;
      if (rows.length === 0) return { ok: false, msg: 'Không tìm thấy hồ sơ vận chuyển ' + fileId };
      if (rows[0].customs_locked !== 0) {
        return { ok: false, msg: 'Cont đã khoá thông quan — không thể nạp thêm kiện' };
      }
      const pkg = await tx.transportFilePackage.create({
        data: {
          fileId,
          packageCode: (input.packageCode ?? '').trim() || null,
          weight: input.weight ?? null,
          volume: input.volume ?? null,
          khotqReceiptId: input.khotqReceiptId ?? null,
        },
      });
      return { ok: true, msg: 'OK', package: pkg };
    });
  }

  // ═══ F6 (review cuối #07) — từ CONT ngược về PHIẾU NHẬN (và qua đó khách/
  // đơn hàng) của từng kiện đã lên cont. Trước bản vá này, TransportFilePackage
  // không giữ khotqReceiptId nên một kiện trên cont KHÔNG THỂ truy ngược ra
  // phiếu nhận kho TQ gốc, khách hàng, hay đơn hàng của nó — và
  // TransportFile.totalCustomers/totalOrders là hai cột KHÔNG AI tính được.
  // Chỉ tính các kiện CÓ khotqReceiptId (kiện nạp tay/dữ liệu cũ không rõ
  // nguồn phiếu nhận bị BỎ QUA, không suy diễn một liên kết không có thật).
  async receiptsForFile(fileId: number): Promise<KhoTqReceipt[]> {
    const pkgs = await this.prisma.transportFilePackage.findMany({
      where: { fileId, khotqReceiptId: { not: null } },
      select: { khotqReceiptId: true },
    });
    const receiptIds = [...new Set(pkgs.map((p) => p.khotqReceiptId as number))];
    if (!receiptIds.length) return [];
    return this.prisma.khoTqReceipt.findMany({ where: { id: { in: receiptIds } }, orderBy: { id: 'asc' } });
  }

  async loadItem(fileId: number, input: LoadItemInput): Promise<ItemResult> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ customs_locked: number }>>`
        SELECT customs_locked FROM tbl_transport_files WHERE id = ${fileId} FOR UPDATE
      `;
      if (rows.length === 0) return { ok: false, msg: 'Không tìm thấy hồ sơ vận chuyển ' + fileId };
      if (rows[0].customs_locked !== 0) {
        return { ok: false, msg: 'Cont đã khoá thông quan — không thể nạp thêm hàng' };
      }
      const item = await tx.transportFileItem.create({
        data: {
          fileId,
          productName: (input.productName ?? '').trim() || null,
          quantity: input.quantity ?? null,
          unit: (input.unit ?? '').trim() || null,
        },
      });
      return { ok: true, msg: 'OK', item };
    });
  }

  // ═══ Mốc thời gian — ghi + suy status TRONG CÙNG transaction ════════════
  //
  // packDate/runDate mô tả ĐÃ đóng gói gì và ĐÃ chạy khi nào — đó là GỐC của
  // tờ khai hải quan (cargo manifest nộp cho hải quan dựa trên hai mốc này).
  // Sửa lại chúng SAU khi customsLock tức sửa lại lịch sử làm nền cho một tờ
  // khai ĐÃ NỘP -> phải từ chối, cùng lý do loadPackage/loadItem bị chặn.
  //
  // arrivalDate/clearanceDate ngược lại là các mốc XẢY RA SAU customsLock
  // trong vòng đời thật (nộp/khoá tờ khai rồi cont mới cập cảng rồi mới
  // thông quan xong) — chúng KHÔNG mô tả lại nội dung đã khai, chỉ ghi nhận
  // cont đã đi tới đâu. Chặn luôn hai mốc này sẽ "đóng băng" cả hành trình
  // sau khi khoá, sai với thực tế cont vẫn phải đi tiếp.
  //
  // Cùng khuôn `SELECT ... FOR UPDATE` như loadPackage/loadItem: đọc-cờ +
  // đọc-mốc-hiện-tại + ghi-mốc-mới + ghi-status-suy-ra đều trong MỘT
  // transaction, khoá dòng cha suốt quá trình.
  private async setMilestone(fileId: number, field: MilestoneField, date: Date): Promise<MilestoneResult> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          customs_locked: number;
          pack_date: Date | null;
          run_date: Date | null;
          arrival_date: Date | null;
          clearance_date: Date | null;
        }>
      >`
        SELECT customs_locked, pack_date, run_date, arrival_date, clearance_date
        FROM tbl_transport_files WHERE id = ${fileId} FOR UPDATE
      `;
      if (rows.length === 0) return { ok: false, msg: 'Không tìm thấy hồ sơ vận chuyển ' + fileId };
      if (FROZEN_AFTER_LOCK[field] && rows[0].customs_locked !== 0) {
        return { ok: false, msg: 'Cont đã khoá thông quan — không thể sửa mốc ảnh hưởng tờ khai' };
      }

      const milestones: Milestones = {
        packDate: rows[0].pack_date,
        runDate: rows[0].run_date,
        arrivalDate: rows[0].arrival_date,
        clearanceDate: rows[0].clearance_date,
        [field]: date,
      };
      const status = this.computeStatus(milestones);
      await tx.transportFile.update({ where: { id: fileId }, data: { [field]: date, status } });
      return { ok: true, msg: 'OK', status };
    });
  }

  async setPackDate(fileId: number, date: Date): Promise<MilestoneResult> {
    return this.setMilestone(fileId, 'packDate', date);
  }

  async setRunDate(fileId: number, date: Date): Promise<MilestoneResult> {
    return this.setMilestone(fileId, 'runDate', date);
  }

  async setArrivalDate(fileId: number, date: Date): Promise<MilestoneResult> {
    return this.setMilestone(fileId, 'arrivalDate', date);
  }

  async setClearanceDate(fileId: number, date: Date): Promise<MilestoneResult> {
    return this.setMilestone(fileId, 'clearanceDate', date);
  }

  // ═══ Khoá thông quan — NGUYÊN TỬ, đúng mẫu `claimUnclaimed`/`PoService.
  // transition` (#07 Task 2 / #06): `updateMany({where:{id, customsLocked:0}})`
  // là MỘT câu lệnh vừa đọc vừa ghi có điều kiện — Postgres chỉ khớp và ghi
  // khi CÒN đúng customsLocked=0 tại thời điểm THỰC THI câu UPDATE, không
  // phải tại thời điểm code đọc trước đó. `count===0` = đã có người khoá
  // trước (hoặc không tồn tại) -> `findUnique` SAU ĐÓ chỉ để dựng thông điệp
  // lỗi, KHÔNG dùng để quyết định ok/không. Cấm `findUnique` -> kiểm tra ->
  // `update` (check-then-act) — đã sinh hai race thật trong codebase này.
  async customsLock(fileId: number, by: string): Promise<LockResult> {
    const byTrim = (by ?? '').trim();
    if (!byTrim) return { ok: false, msg: 'Thiếu người khoá thông quan' };

    const result = await this.prisma.transportFile.updateMany({
      where: { id: fileId, customsLocked: 0 },
      data: { customsLocked: 1, customsLockedBy: byTrim, customsLockedAt: nowSec() },
    });
    if (result.count === 0) {
      const file = await this.prisma.transportFile.findUnique({ where: { id: fileId } });
      if (!file) return { ok: false, msg: 'Không tìm thấy hồ sơ vận chuyển ' + fileId };
      return {
        ok: false,
        msg: 'Cont đã khoá thông quan trước đó (bởi "' + (file.customsLockedBy ?? '?') + '")',
      };
    }
    return { ok: true, msg: 'OK' };
  }
}
