import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeName, rong } from './scope.constants';

@Injectable()
export class PermService {
  private cache = new Map<string, Record<string, ScopeName>>();
  private ver: number | null = null;
  private verAt = 0;

  /**
   * TTL của memo `version()` (ms). Mặc định 5 giây, đổi được qua env
   * `PERM_VERSION_TTL_MS`; test hạ về 0 để kiểm ngay.
   *
   * ⚠⚠ VÌ SAO PHẢI CÓ TTL (sửa 23/09/2026 — lỗi bảo mật thật):
   * Trước đây `version()` memo VĨNH VIỄN (`if (this.ver !== null) return`).
   * `bumpVersion()` chỉ xoá memo CỦA CHÍNH TIẾN TRÌNH NÓ. Chạy nhiều tiến
   * trình/pod: tiến trình B thu hồi quyền của một người và bump version, còn
   * tiến trình A **không bao giờ biết** — nó tiếp tục phục vụ quyền cũ theo
   * khoá cache cũ **cho tới khi restart**. Tức là **THU HỒI QUYỀN KHÔNG CÓ
   * TÁC DỤNG** trên các pod khác: đúng thứ mà cơ chế version sinh ra để chống.
   * Với TTL, độ trễ thu hồi bị chặn trên bằng TTL thay vì vô hạn.
   */
  verTtlMs = Number(process.env.PERM_VERSION_TTL_MS ?? 5000);

  constructor(private prisma: PrismaService) {}

  clearCache() { this.cache.clear(); this.ver = null; this.verAt = 0; }

  async version(): Promise<number> {
    if (this.ver !== null && Date.now() - this.verAt < this.verTtlMs) return this.ver;
    const r = await this.prisma.permConfig.findUnique({ where: { ten: 'version' } });
    this.ver = r ? parseInt(r.giaTri, 10) || 1 : 1;
    this.verAt = Date.now();
    return this.ver;
  }

  async bumpVersion(): Promise<void> {
    const cur = await this.version();
    await this.prisma.permConfig.upsert({
      where: { ten: 'version' }, create: { ten: 'version', giaTri: String(cur + 1) }, update: { giaTri: String(cur + 1) },
    });
    this.clearCache();
  }

  async of(userId: number): Promise<Record<string, ScopeName>> {
    const uid = Number(userId);
    if (!uid || uid <= 0) return {};
    const key = uid + '@' + (await this.version());
    const hit = this.cache.get(key);
    if (hit) return hit;

    const quyen: Record<string, ScopeName> = {};
    // hieuLucTu/hieuLucDen are @db.Date (date-only, stored at UTC-midnight).
    // Compare against UTC-midnight of the current LOCAL calendar date, not a
    // full timestamp, so a role valid "through today" stays valid all day and
    // one starting "today" is valid from 00:00 (avoids TZ/time-of-day drift).
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    // (3) vai đang hiệu lực -> phạm vi RỘNG NHẤT
    const roleRows = await this.prisma.userRole.findMany({
      where: {
        userId: uid, hieuLucTu: { lte: today }, OR: [{ hieuLucDen: null }, { hieuLucDen: { gte: today } }],
        role: { active: true },
      },
      include: { role: { include: { rolePerms: true } } },
    });
    for (const ur of roleRows) {
      for (const rp of ur.role?.rolePerms ?? []) {
        const code = String(rp.permCode).trim().toLowerCase();
        if (!code) continue;
        if (!(code in quyen) || rong(rp.scope) > rong(quyen[code])) quyen[code] = rp.scope as ScopeName;
      }
    }
    // (2) allow lẻ -> ghi đè phạm vi
    const allow = await this.prisma.userPermission.findMany({ where: { userId: uid, loai: 'allow' } });
    for (const a of allow) { const code = a.permCode.trim().toLowerCase(); if (code) quyen[code] = a.scope as ScopeName; }
    // (1) deny lẻ -> xoá
    const deny = await this.prisma.userPermission.findMany({ where: { userId: uid, loai: 'deny' } });
    for (const d of deny) { const code = d.permCode.trim().toLowerCase(); if (code) delete quyen[code]; }

    this.cache.set(key, quyen);
    return quyen;
  }

  async can(perm: string, userId: number): Promise<boolean> {
    const q = await this.of(userId);
    return Object.prototype.hasOwnProperty.call(q, (perm ?? '').trim().toLowerCase());
  }
  async scopeOf(perm: string, userId: number): Promise<ScopeName | ''> {
    const q = await this.of(userId);
    const k = (perm ?? '').trim().toLowerCase();
    return (Object.prototype.hasOwnProperty.call(q, k) ? q[k] : '') as ScopeName | '';
  }
  async canModule(module: string, userId: number): Promise<boolean> {
    const m = (module ?? '').trim().toLowerCase();
    if (!m) return false;
    const q = await this.of(userId);
    return Object.keys(q).some((code) => code.startsWith(m + '.'));
  }
}
