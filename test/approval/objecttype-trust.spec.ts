// I-2 (review cuối nhánh fix/03-money-gaps) — `objectType` do NGƯỜI GỬI tự khai được tin.
//
// RequestService.submit từng lưu nguyên `objectType` người gửi đưa, không đối chiếu mẫu. Hiệu ứng tiền
// (BusinessSyncService) và tiền giữ (ApprovalPendingHoldProvider) đều chọn theo `objectType` ⇒
//   - mẫu BẤT KỲ có bước tự duyệt + objectType='wallet_withdraw' ⇒ trừ ví khách như lệnh rút (−3)
//     về STK người gửi tự gõ;
//   - mẫu BẤT KỲ ⇒ đóng băng số dư của khách bất kỳ qua tiền giữ.
// Prod quyết theo MÃ MẪU (viRutTienDuyetXong: tpl_code === 'rut_tien_vi_kh'). Hệ mới quyết theo
// `objectType` CỦA MẪU (do quản trị cấu hình), không theo lời người gửi — kiểm ở CẢ BA lớp.
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MoneyModule } from '../../src/money/money.module';
import { RequestService } from '../../src/approval/request.service';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';
import { WalletService } from '../../src/money/wallet.service';
import { HoldService } from '../../src/money/hold.service';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';

const RUT = 'TBS_ZZAPPR_rut_tien_vi_kh';
const OTHER = 'TBS_ZZAPPR_de_nghi_khac';
const VICTIM = 'TBS_ZZAPPR_VICTIM';
const CTL = 'TBS_ZZAPPR_CTL';

let mod: TestingModule;
let reqSvc: RequestService;
let approvalSvc: ApprovalService;
let sync: BusinessSyncService;
let wallet: WalletService;
let hold: HoldService;

async function fresh() {
  await resetApproval();
  await resetDb();
  await prisma.user.create({ data: { username: 'zzappr_kt', password: 'x', gid: 46 } }); // gid 46 = KẾ TOÁN LOGISTICS (prod)
  await prisma.user.create({ data: { username: 'zzappr_sale', password: 'x' } });
  const rut = await seedTemplate(RUT, { objectType: 'wallet_withdraw' });
  await seedApprover((await seedStep(rut.id, { order: 1 })).id, 'group', 46);
  // Mẫu KHÁC, có bước tự duyệt — đúng hình kẻ tấn công cần.
  const other = await seedTemplate(OTHER, { objectType: 'demo_other' });
  await seedStep(other.id, { order: 1, approvalMode: 'auto_approve' });
  await seedApprover((await seedStep(other.id, { order: 2 })).id, 'group', 46);
  await wallet.applyEntry(VICTIM, 1_000_000, 0, 'nạp', 'zzappr');
  await wallet.applyEntry(CTL, 1_000_000, 0, 'nạp', 'zzappr');
}
const tplId = async (code: string) => (await prisma.approvalTemplate.findUniqueOrThrow({ where: { code } })).id;
/** Phiếu GIẢ dựng thẳng trong CSDL — mô phỏng dữ liệu cũ/đường ghi khác lọt qua cổng submit. */
async function forged(status: number, cus: string) {
  return prisma.approvalRequest.create({ data: {
    templateId: await tplId(OTHER), objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 2, status,
    submittedBy: 'zzappr_sale', submittedAt: 1, pendingSince: 1,
    formData: JSON.stringify({ cus, so_tien: 400_000, chu_tk: 'KE GIAN', so_tk_nhan: '999', ngan_hang: 'X' }),
  } });
}
async function legit(status: number, cus: string) {
  return prisma.approvalRequest.create({ data: {
    templateId: await tplId(RUT), objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status,
    submittedBy: 'zzappr_sale', submittedAt: 1, pendingSince: 1,
    formData: JSON.stringify({ cus, so_tien: 400_000 }),
  } });
}
const withdrawals = (cus: string) => prisma.walletEntry.count({ where: { cusId: cus, type: -3 } });

beforeAll(async () => {
  mod = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await mod.init();
  reqSvc = mod.get(RequestService);
  approvalSvc = mod.get(ApprovalService);
  sync = mod.get(BusinessSyncService);
  wallet = mod.get(WalletService);
  hold = mod.get(HoldService);
});
afterAll(async () => {
  await resetApproval(); await resetDb();
  await mod.close();
  await prisma.$disconnect();
});

describe('LỚP 1 — submit: mẫu khác + objectType tự khai "wallet_withdraw"', () => {
  let err: string;
  let rows: number;
  beforeAll(async () => {
    await fresh();
    err = await reqSvc.submit(OTHER, 'wallet_withdraw', 0, 'X', 'zzappr_sale', { cus: VICTIM, so_tien: 400_000 })
      .then(async (r) => {
        // bước 1 tự duyệt, bước 2 người duyệt của mẫu (không phải KT rút tiền) bấm duyệt
        await approvalSvc.runAutomation(r.requestId).catch(() => undefined);
        await approvalSvc.approve(r.requestId, 'zzappr_kt').catch(() => undefined);
        return '';
      },
            (e) => String(e?.message ?? e));
    rows = await prisma.approvalRequest.count();
  });
  it('bị TỪ CHỐI', () => {
    expect(err).not.toBe('');
  });
  it('không tạo phiếu nào', () => {
    expect(rows).toBe(0);
  });
  it('ví nạn nhân không bị trừ', async () => {
    expect(await withdrawals(VICTIM)).toBe(0);
  });
  it('ví nạn nhân không bị đóng băng', async () => {
    expect(await hold.holdAmount(VICTIM)).toBe(0n);
  });
});

describe('LỚP 1 — đối chứng: submit đúng loại của mẫu vẫn chạy', () => {
  it('mẫu khác + objectType của chính mẫu ⇒ lưu đúng loại mẫu', async () => {
    await fresh();
    const r = await reqSvc.submit(OTHER, 'demo_other', 0, 'X', 'zzappr_sale', {});
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id: r.requestId } })).objectType).toBe('demo_other');
  });
  it('objectType bỏ trống ⇒ lấy theo mẫu', async () => {
    await fresh();
    const r = await reqSvc.submit(RUT, '', 0, 'X', 'zzappr_sale', { cus: CTL, so_tien: 400_000 });
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id: r.requestId } })).objectType).toBe('wallet_withdraw');
  });
  it('mẫu rút đúng ⇒ duyệt xong trừ ví đúng một lần', async () => {
    await fresh();
    const r = await reqSvc.submit(RUT, 'wallet_withdraw', 0, 'X', 'zzappr_sale', { cus: CTL, so_tien: 400_000 });
    await approvalSvc.approve(r.requestId, 'zzappr_kt');
    expect(await withdrawals(CTL)).toBe(1);
  });
});

describe('LỚP 2 — handler rút: phiếu GIẢ (mẫu khác, objectType wallet_withdraw) lọt qua submit', () => {
  let err: string;
  let ctlErr: string;
  beforeAll(async () => {
    await fresh();
    const h = (sync as any).handlers.get('wallet_withdraw');
    err = await h.sync(await forged(2, VICTIM)).then(() => '', (e: Error) => e.message);
    ctlErr = await h.sync(await legit(2, CTL)).then(() => '', (e: Error) => e.message);
  });
  it('handler TỪ CHỐI chạy', () => {
    expect(err).not.toBe('');
  });
  it('ví nạn nhân không bị trừ', async () => {
    expect(await withdrawals(VICTIM)).toBe(0);
  });
  it('đối chứng: phiếu đúng mẫu rút chạy không lỗi', () => {
    expect(ctlErr).toBe('');
  });
  it('đối chứng: phiếu đúng mẫu rút trừ ví', async () => {
    expect(await withdrawals(CTL)).toBe(1);
  });
});

describe('LỚP 2 — phiếu GIẢ đang chờ đi hết luồng duyệt', () => {
  let id: number;
  beforeAll(async () => {
    await fresh();
    id = (await forged(1, VICTIM)).id;
    await approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined);
  });
  it('phiếu KHÔNG thành APPROVED', async () => {
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).status).toBe(1);
  });
  it('ví nạn nhân không bị trừ', async () => {
    expect(await withdrawals(VICTIM)).toBe(0);
  });
});

describe('LỚP 3 — tiền giữ: phiếu GIẢ đang chờ không đóng băng được ví', () => {
  beforeAll(async () => {
    await fresh();
    await forged(1, VICTIM);
    await legit(1, CTL);
  });
  it('phiếu giả KHÔNG giữ tiền của nạn nhân', async () => {
    expect(await hold.holdAmount(VICTIM)).toBe(0n);
  });
  it('đối chứng: phiếu đúng mẫu rút giữ đúng số tiền', async () => {
    expect(await hold.holdAmount(CTL)).toBe(400_000n);
  });
});
