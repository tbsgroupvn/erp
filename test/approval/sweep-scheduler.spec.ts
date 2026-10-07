// Review cuối nhánh fix/approval-money-order, I-2 — resumeUnfinished() từng KHÔNG có ai gọi.
// Nay ApprovalSweepScheduler chạy nó khi ứng dụng khởi động và theo chu kỳ APPROVAL_SWEEP_INTERVAL_MS,
// ghi log điều đã hoàn tất / đã từ chối, và an toàn khi NHIỀU máy cùng quét (khoá dòng phiếu).
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MoneyModule } from '../../src/money/money.module';
import { ApprovalService, SweepResult } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';
import { ApprovalSweepScheduler } from '../../src/approval/approval-sweep.scheduler';
import { WalletService } from '../../src/money/wallet.service';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';

const FLOOR = 'APPROVAL_SWEEP_CUTOVER_AT';
const IV = 'APPROVAL_SWEEP_INTERVAL_MS';
const saved = { floor: process.env[FLOOR], iv: process.env[IV] };
const RUT = 'TBS_ZZAPPR_rut_tien_vi_kh';
const now = () => Math.floor(Date.now() / 1000);

const mods: TestingModule[] = [];
async function boot(interval: string): Promise<TestingModule> {
  process.env[IV] = interval;
  const m = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await m.init(); // chạy cả OnApplicationBootstrap ⇒ lượt quét khởi động
  mods.push(m);
  return m;
}
async function closeAll() { while (mods.length) await mods.pop()!.close(); }

let wallet: WalletService; // từ một module riêng, lịch quét tắt
let tplId: number;
async function fresh(cusList: string[]) {
  await resetApproval();
  await resetDb();
  await prisma.user.create({ data: { username: 'zzappr_kt', password: 'x', gid: 46 } }); // gid 46 = KẾ TOÁN LOGISTICS (prod)
  const t = await seedTemplate(RUT, { objectType: 'wallet_withdraw' });
  await seedApprover((await seedStep(t.id, { order: 1 })).id, 'group', 46);
  tplId = t.id;
  for (const c of cusList) await wallet.applyEntry(c, 1_000_000, 0, 'nạp', 'zzappr');
}
async function approvedUnsynced(cus: string, finishedAt: number) {
  return (await prisma.approvalRequest.create({ data: {
    templateId: tplId, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 2,
    submittedBy: 'zzappr_sale', submittedAt: finishedAt, finishedAt, formData: JSON.stringify({ cus, so_tien: 300_000 }),
  } })).id;
}
/** Trạng thái giữa-sập: PENDING, đã có lượt duyệt, bút toán ĐÃ vào sổ. */
async function pendingDebited(cus: string) {
  const id = (await prisma.approvalRequest.create({ data: {
    templateId: tplId, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 1,
    submittedBy: 'zzappr_sale', submittedAt: now(), pendingSince: now(), formData: JSON.stringify({ cus, so_tien: 300_000 }),
  } })).id;
  await prisma.approvalAction.create({ data: { requestId: id, stepOrder: 1, stepName: 'S1', action: 'approve', actedBy: 'zzappr_kt', actedAt: now() } });
  const r = await wallet.applyEntry(cus, -300_000, -3, 'Rút tiền theo phiếu duyệt #' + id, 'zzappr_sale', 0,
    { refKey: 'approval:' + id + ':wallet_withdraw', holdExcludeRequest: id });
  if (!r.ok) throw new Error('fixture: ' + r.msg);
  return id;
}
const withdrawals = (cus: string) => prisma.walletEntry.count({ where: { cusId: cus, type: -3 } });

beforeAll(async () => {
  process.env[FLOOR] = String(now() - 3600);
  wallet = (await boot('0')).get(WalletService);
});
afterAll(async () => {
  jest.restoreAllMocks();
  await closeAll();
  for (const [k, v] of [[FLOOR, saved.floor], [IV, saved.iv]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  await resetApproval(); await resetDb();
  await prisma.$disconnect();
});

describe('KHỞI ĐỘNG ứng dụng chạy một lượt quét', () => {
  const CUS = 'TBS_ZZAPPR_BOOT';
  let logs: string[];
  let id: number;
  beforeAll(async () => {
    await fresh([CUS]);
    id = await approvedUnsynced(CUS, now());
    const spy = jest.spyOn(Logger.prototype, 'log');
    const m = await boot('3600000'); // chu kỳ dài: chỉ lượt khởi động kịp chạy
    await m.get(ApprovalSweepScheduler).whenIdle();
    logs = spy.mock.calls.map((c) => String(c[0]));
    spy.mockRestore();
  });
  afterAll(closeAllButFirst);
  it('phiếu APPROVED chưa đồng bộ được trừ ví đúng một lần', async () => {
    expect(await withdrawals(CUS)).toBe(1);
  });
  it('log nêu phiếu đã đồng bộ', () => {
    expect(logs.some((l) => l.includes(`đồng bộ=[${id}]`))).toBe(true);
  });
});

describe('đối chứng: lịch quét TẮT (=0) thì khởi động không quét', () => {
  const CUS = 'TBS_ZZAPPR_OFF';
  beforeAll(async () => {
    await fresh([CUS]);
    await approvedUnsynced(CUS, now());
    const m = await boot('0');
    await m.get(ApprovalSweepScheduler).whenIdle();
  });
  afterAll(closeAllButFirst);
  it('không trừ ví', async () => {
    expect(await withdrawals(CUS)).toBe(0);
  });
});

describe('CHU KỲ: phiếu xuất hiện SAU khởi động vẫn được hoàn tất', () => {
  const CUS = 'TBS_ZZAPPR_IV';
  let got = 0;
  beforeAll(async () => {
    await fresh([CUS]);
    const m = await boot('1000');
    await m.get(ApprovalSweepScheduler).whenIdle();
    await pendingDebited(CUS); // sập giữa chừng, sau lượt khởi động
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      got = await prisma.approvalRequest.count({ where: { status: 2 } });
      if (got) break;
    }
  }, 20_000);
  afterAll(closeAllButFirst);
  it('trong vòng 5 giây phiếu thành APPROVED', () => {
    expect(got).toBe(1);
  });
  it('không trừ thêm', async () => {
    expect(await withdrawals(CUS)).toBe(1);
  });
});

describe('quan sát được: thiếu sàn cutover ⇒ log cảnh báo; phiếu trước sàn ⇒ log từ chối', () => {
  let warnNoFloor: string[];
  let warnRefused: string[];
  let preId: number;
  beforeAll(async () => {
    await fresh(['TBS_ZZAPPR_OBS']);
    const floor = process.env[FLOOR];
    const spy = jest.spyOn(Logger.prototype, 'warn');
    delete process.env[FLOOR];
    await (await boot('0')).get(ApprovalSweepScheduler).tick('thử');
    warnNoFloor = spy.mock.calls.map((c) => String(c[0]));
    spy.mockClear();
    process.env[FLOOR] = floor;
    preId = await approvedUnsynced('TBS_ZZAPPR_OBS', Number(floor) - 100);
    await (await boot('0')).get(ApprovalSweepScheduler).tick('thử');
    warnRefused = spy.mock.calls.map((c) => String(c[0]));
    spy.mockRestore();
  });
  afterAll(closeAllButFirst);
  it('thiếu sàn: cảnh báo "KHÔNG chạy" kèm tên biến', () => {
    expect(warnNoFloor.some((w) => w.includes('KHÔNG chạy') && w.includes('APPROVAL_SWEEP_CUTOVER_AT chưa đặt'))).toBe(true);
  });
  it('trước sàn: cảnh báo nêu số phiếu bị từ chối', () => {
    expect(warnRefused.some((w) => w.includes('trước sàn cutover') && w.includes('#' + preId))).toBe(true);
  });
  it('đối chứng: phiếu trước sàn không bị trừ', async () => {
    expect(await withdrawals('TBS_ZZAPPR_OBS')).toBe(0);
  });
});

describe('một máy: lượt mới không chồng lên lượt đang chạy', () => {
  let second: SweepResult | null | undefined;
  beforeAll(async () => {
    await fresh([]);
    const s = (await boot('0')).get(ApprovalSweepScheduler);
    const first = s.tick('a');
    second = await s.tick('b');
    await first;
  });
  afterAll(closeAllButFirst);
  it('lượt thứ hai bị bỏ qua (null)', () => {
    expect(second).toBeNull();
  });
});

describe('HAI MÁY quét cùng lúc — không chạy trùng hiệu ứng', () => {
  const P = 'TBS_ZZAPPR_M1'; // phiếu giữa-sập (PENDING, đã trừ)
  const Q = 'TBS_ZZAPPR_M2'; // phiếu APPROVED chưa đồng bộ
  let rs: SweepResult[];
  let maxInEffect = 0;
  let pId: number, qId: number;
  beforeAll(async () => {
    await fresh([P, Q]);
    pId = await pendingDebited(P);
    qId = await approvedUnsynced(Q, now());
    const a = await boot('0');
    const b = await boot('0');
    // RÀO CHẮN: hiệu ứng của một phiếu chờ tới khi máy KIA cũng vào hiệu ứng CÙNG phiếu (tối đa 1,5 giây).
    // Có khoá dòng phiếu ⇒ máy kia không bao giờ vào được lúc này ⇒ rào hết hạn, chạy một mình.
    // Mất khoá ⇒ cả hai cùng vào ⇒ rào mở ⇒ cả hai cùng hoàn tất (và cùng báo).
    const inEffect = new Map<number, number>();
    const waiters = new Map<number, (() => void)[]>();
    for (const m of [a, b]) {
      const sync = m.get(BusinessSyncService);
      const orig = sync.runEffect.bind(sync);
      jest.spyOn(sync, 'runEffect').mockImplementation(async (rid: number) => {
        const n = (inEffect.get(rid) ?? 0) + 1;
        inEffect.set(rid, n);
        maxInEffect = Math.max(maxInEffect, n);
        if (n >= 2) (waiters.get(rid) ?? []).forEach((w) => w());
        else await new Promise<void>((res) => {
          waiters.set(rid, [...(waiters.get(rid) ?? []), res]);
          setTimeout(res, 1500);
        });
        try { return await orig(rid); } finally { inEffect.set(rid, (inEffect.get(rid) ?? 1) - 1); }
      });
    }
    rs = await Promise.all([a.get(ApprovalService).resumeUnfinished(), b.get(ApprovalService).resumeUnfinished()]);
    jest.restoreAllMocks();
  }, 30_000);
  afterAll(closeAllButFirst);
  it('không lúc nào hai máy cùng ở trong hiệu ứng của một phiếu', () => {
    expect(maxInEffect).toBe(1);
  });
  it('phiếu giữa-sập được báo hoàn tất ĐÚNG MỘT lần (tổng hai máy)', () => {
    expect([...rs[0].finalized, ...rs[1].finalized]).toEqual([pId]);
  });
  it('phiếu chưa đồng bộ được báo đồng bộ ĐÚNG MỘT lần (tổng hai máy)', () => {
    expect([...rs[0].synced, ...rs[1].synced]).toEqual([qId]);
  });
  it('phiếu giữa-sập: vẫn đúng một bút toán rút', async () => {
    expect(await withdrawals(P)).toBe(1);
  });
  it('phiếu chưa đồng bộ: trừ đúng một lần', async () => {
    expect(await withdrawals(Q)).toBe(1);
  });
});

/** Đóng mọi module trừ module đầu (module của `wallet`). */
async function closeAllButFirst() { while (mods.length > 1) await mods.pop()!.close(); }
