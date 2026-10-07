import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ApprovalService, SweepResult } from './approval.service';

/** Chu kỳ lượt quét, mili giây. Mặc định 60 000. `0` ⇒ TẮT (chỉ dùng cho test / máy không phục vụ). */
export const SWEEP_INTERVAL_ENV = 'APPROVAL_SWEEP_INTERVAL_MS';
const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Review cuối nhánh fix/approval-money-order, I-2 — `resumeUnfinished()` từng KHÔNG có ai gọi.
 * Sập giữa lúc trừ ví và đổi trạng thái ⇒ phiếu PENDING mà ví đã trừ; reject/revoke bị chặn với lời
 * hứa "chờ hệ thống hoàn tất" — không hệ thống nào làm; trong lúc đó tiền giữ vẫn đếm phiếu ⇒ số dư
 * khả dụng của khách bị trừ HAI lần vô thời hạn. Lớp này chạy lượt quét khi ứng dụng khởi động và
 * theo chu kỳ.
 *
 * Không thêm thư viện lịch (`@nestjs/schedule` không có trong package.json): một `setInterval` +
 * vòng đời Nest (`OnApplicationBootstrap`/`OnModuleDestroy`) là đủ cho một việc định kỳ duy nhất.
 * Timer `unref()` để không giữ tiến trình sống; đóng module thì dừng timer và chờ lượt đang chạy.
 *
 * NHIỀU MÁY cùng chạy: mỗi phiếu được xử lý dưới khoá dòng phiếu (FOR UPDATE ở finalize/onApproved),
 * lượt đến sau thấy phiếu đã xong và bỏ qua; hiệu ứng tiền neo refKey. Trong MỘT máy, lượt mới không
 * chồng lên lượt cũ chưa xong (bỏ qua, ghi debug).
 */
@Injectable()
export class ApprovalSweepScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ApprovalSweep');
  private timer?: NodeJS.Timeout;
  private running: Promise<SweepResult | null> | null = null;

  constructor(private approval: ApprovalService) {}

  /** Chu kỳ đọc từ môi trường; `null` = tắt. Giá trị hỏng ⇒ dùng mặc định (tắt ngầm thì sự cố treo mãi). */
  intervalMs(): number | null {
    const raw = (process.env[SWEEP_INTERVAL_ENV] ?? '').trim();
    if (raw === '') return DEFAULT_INTERVAL_MS;
    if (raw === '0') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1000) {
      this.logger.error(`${SWEEP_INTERVAL_ENV}="${raw}" không hợp lệ (số nguyên ≥ 1000 hoặc 0 để tắt) — dùng mặc định ${DEFAULT_INTERVAL_MS}ms`);
      return DEFAULT_INTERVAL_MS;
    }
    return n;
  }

  onApplicationBootstrap() {
    const ms = this.intervalMs();
    if (ms === null) {
      this.logger.warn(`Lượt quét phiếu duyệt TẮT (${SWEEP_INTERVAL_ENV}=0) — phiếu sập giữa chừng sẽ không tự hoàn tất`);
      return;
    }
    void this.tick('khởi động');
    this.timer = setInterval(() => { void this.tick('định kỳ'); }, ms);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.whenIdle();
  }

  /** Chờ lượt đang chạy (nếu có) xong. */
  async whenIdle(): Promise<void> { if (this.running) await this.running; }

  /** Chạy MỘT lượt; `null` nếu lượt trước chưa xong (không chồng). Không bao giờ ném. */
  tick(trigger: string): Promise<SweepResult | null> {
    if (this.running) {
      this.logger.debug(`Bỏ qua lượt ${trigger}: lượt trước chưa xong`);
      return Promise.resolve(null);
    }
    this.running = this.approval.resumeUnfinished()
      .then((r) => { this.report(trigger, r); return r; })
      .catch((e) => { this.logger.error(`Lượt quét (${trigger}) lỗi: ${(e as Error)?.message ?? e}`); return null; })
      .finally(() => { this.running = null; });
    return this.running;
  }

  private report(trigger: string, r: SweepResult) {
    if (!r.ran) { this.logger.warn(`Lượt quét (${trigger}) KHÔNG chạy: ${r.reason}`); return; }
    const done = r.synced.length + r.finalized.length;
    const msg = `Lượt quét (${trigger}): đồng bộ=[${r.synced.join(',')}] hoàn tất=[${r.finalized.join(',')}] ` +
      `lỗi=[${r.failed.map((f) => f.id).join(',')}] từ chối=${r.refusedCount}`;
    if (done || r.failed.length) this.logger.log(msg); else this.logger.debug(msg);
    for (const f of r.failed) this.logger.warn(`Lượt quét: phiếu #${f.id} chưa hoàn tất — ${f.msg}`);
    if (r.refusedCount)
      this.logger.warn(`Lượt quét: ${r.refusedCount} phiếu nằm trước sàn cutover, KHÔNG xử lý — ` +
        r.refused.map((x) => `#${x.id} (${x.reason})`).join('; '));
  }
}
