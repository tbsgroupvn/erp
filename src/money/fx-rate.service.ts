// src/money/fx-rate.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nowSec } from '../common/money';

@Injectable()
export class FxRateService {
  constructor(private prisma: PrismaService) {}

  async current(loai: string, hang = 'MAC_DINH'): Promise<string | null> {
    const r = await this.prisma.mhRate.findFirst({
      where: { loai, hangKhach: hang, hieuLucDen: null },
      orderBy: [{ hieuLucTu: 'desc' }, { id: 'desc' }],
    });
    return r ? r.tyGia.toFixed(4) : null;
  }

  async set(loai: string, hang: string, rate: string, user: string) {
    if (!/^\d+(\.\d{1,4})?$/.test(rate) || Number(rate) <= 0)
      return { ok: false, loi: 'Tỷ giá không hợp lệ.' };
    const now = nowSec();
    try {
      await this.prisma.$transaction([
        this.prisma.mhRate.updateMany({
          where: { loai, hangKhach: hang, hieuLucDen: null },
          data: { hieuLucDen: now },
        }),
        this.prisma.mhRate.create({
          data: { loai, hangKhach: hang, tyGia: rate, hieuLucTu: now, hieuLucDen: null, nguoiTao: user, createdAt: now },
        }),
      ]);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { ok: false, loi: 'Tỷ giá đang được cập nhật bởi thao tác khác, thử lại.' };
      }
      throw err;
    }
    return { ok: true };
  }
}
