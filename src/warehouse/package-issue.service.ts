import { Injectable } from '@nestjs/common';
import { PackageIssue } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';

export type RaiseInput = {
  khau?: string;
  reasons?: string;
  note?: string;
};

type IssueResult = { ok: true; msg: string; issue: PackageIssue } | { ok: false; msg: string };
type ListResult = PackageIssue[];

// ═══ Vòng đời BẮT BUỘC theo thứ tự — mới → ack → đóng (§4.10) ═══════════════
//
// ⚠⚠⚠ Đo CHÍNH XÁC trên prod 23/09/2026: 1.464 sự cố kiện, 1.457 đã ACK,
// và ĐÚNG 0 (KHÔNG) đã ĐÓNG. Toàn bộ đến từ khâu `tren_cont`. §4.10 đòi "một
// sự cố phải được ack RỒI đóng, không được bỏ lửng" — 100% dữ liệu thật hiện
// tại đang vi phạm nửa sau của luật đó, vì nửa "đóng" CHƯA TỪNG chạy trên
// prod một lần nào. Đây KHÔNG phải lý do để bỏ qua việc dựng service này —
// ngược lại, đó chính xác là lý do `countUnclosed()` tồn tại: nó biến một
// câu trong đặc tả thành MỘT CON SỐ ai đó có thể theo dõi và bắt account.
// Test 'ghi lại con số đo được' bên dưới (package-issue.spec.ts) là nơi DUY
// NHẤT phủ đường "đóng" — người đọc sau đừng hiểu nhầm các test đó là bằng
// chứng đường này đã chạy thật ngoài đời, nó chưa hề chạy.
@Injectable()
export class PackageIssueService {
  constructor(private prisma: PrismaService) {}

  async raise(packageId: number, input: RaiseInput, by: string): Promise<IssueResult> {
    if (!packageId) return { ok: false, msg: 'Thiếu packageId' };
    const byTrim = (by ?? '').trim();
    if (!byTrim) return { ok: false, msg: 'Thiếu người báo sự cố' };

    const issue = await this.prisma.packageIssue.create({
      data: {
        packageId,
        khau: (input.khau ?? '').trim() || null,
        reasons: (input.reasons ?? '').trim() || null,
        note: (input.note ?? '').trim() || null,
        createdBy: byTrim,
        createdAt: nowSec(),
      },
    });
    return { ok: true, msg: 'OK', issue };
  }

  // ═══ ack() — nguyên tử, đúng mẫu `KhoTqReceiptService.claimUnclaimed` /
  // `TransportFileService.customsLock`: `updateMany({where:{id, ackAt: null}})`
  // là MỘT câu lệnh vừa đọc vừa ghi có điều kiện — Postgres chỉ khớp và ghi
  // khi CÒN CHƯA ack tại thời điểm THỰC THI câu UPDATE, không phải tại thời
  // điểm code đọc trước đó. `count === 0` = đã có người ack trước (hoặc
  // không tồn tại) -> `findUnique` SAU ĐÓ chỉ để dựng thông điệp lỗi phân
  // biệt hai trường hợp, KHÔNG dùng để quyết định ok/không — quyết định đã
  // chốt ở `updateMany`. Cấm `findUnique` -> kiểm tra -> `update`
  // (check-then-act) — ba race thật đã bị bắt trong codebase này bằng đúng
  // mẫu này (F.race claimUnclaimed, customsLock, PoService.transition #06).
  async ack(issueId: number, by: string, ackNote?: string): Promise<IssueResult> {
    const byTrim = (by ?? '').trim();
    if (!byTrim) return { ok: false, msg: 'Thiếu người xác nhận (ack)' };

    const result = await this.prisma.packageIssue.updateMany({
      where: { id: issueId, ackAt: null },
      data: { ackBy: byTrim, ackAt: nowSec(), ackNote: (ackNote ?? '').trim() || null },
    });
    if (result.count === 0) {
      const issue = await this.prisma.packageIssue.findUnique({ where: { id: issueId } });
      if (!issue) return { ok: false, msg: 'Không tìm thấy sự cố kiện ' + issueId };
      return {
        ok: false,
        msg: 'Sự cố đã được xác nhận trước đó (bởi "' + (issue.ackBy ?? '?') + '")',
      };
    }
    const issue = await this.prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
    return { ok: true, msg: 'OK', issue };
  }

  // ═══ close() — CHỈ đóng được khi ĐÃ ack (vòng đời bắt buộc theo thứ tự,
  // §4.10). Đóng khi chưa ack phải bị TỪ CHỐI — dùng CHUNG một câu
  // `updateMany` để kiểm CẢ HAI điều kiện nguyên tử: "đã ack" (ackAt không
  // null) VÀ "chưa đóng" (closedAt null). Gộp cả hai vào MỘT `where` tránh
  // khe hở giữa hai lần đọc riêng rẽ — đúng tinh thần "đọc-kiểm-ghi trong
  // MỘT câu lệnh" đã lặp lại xuyên suốt module #07.
  async close(issueId: number, by: string, closeNote?: string): Promise<IssueResult> {
    const byTrim = (by ?? '').trim();
    if (!byTrim) return { ok: false, msg: 'Thiếu người đóng sự cố' };

    const result = await this.prisma.packageIssue.updateMany({
      where: { id: issueId, ackAt: { not: null }, closedAt: null },
      data: { closedBy: byTrim, closedAt: nowSec(), closeNote: (closeNote ?? '').trim() || null },
    });
    if (result.count === 0) {
      const issue = await this.prisma.packageIssue.findUnique({ where: { id: issueId } });
      if (!issue) return { ok: false, msg: 'Không tìm thấy sự cố kiện ' + issueId };
      if (issue.ackAt === null) {
        return { ok: false, msg: 'Sự cố CHƯA được xác nhận (ack) — không thể đóng thẳng (§4.10: phải ack rồi mới đóng)' };
      }
      return {
        ok: false,
        msg: 'Sự cố đã được đóng trước đó (bởi "' + (issue.closedBy ?? '?') + '")',
      };
    }
    const issue = await this.prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
    return { ok: true, msg: 'OK', issue };
  }

  async listOpen(packageId?: number): Promise<ListResult> {
    return this.prisma.packageIssue.findMany({
      where: { closedAt: null, ...(packageId ? { packageId } : {}) },
      orderBy: { id: 'desc' },
    });
  }

  // ⚠ §4.10 đòi "không bỏ lửng sự cố kiện" — hàm này biến câu đó thành một
  // con số đo được. Đo prod 23/09/2026: 1.464 sự cố, 0 đã đóng -> con số này
  // trên prod hôm nay chính là 1.464 (trừ 7 dòng chưa từng ack, vẫn tính là
  // chưa đóng).
  async countUnclosed(): Promise<number> {
    return this.prisma.packageIssue.count({ where: { closedAt: null } });
  }
}
