// Q7 (docs/rewrite-spec/migration/03-vi-gl.md mục 5.11) — GIỮ TIỀN cho phiếu RÚT/PHÂN BỔ
// ví đang chờ duyệt. Nguồn sự thật: prod `libs/cls.wallet.php` holdCalc() (đọc 24/09/2026):
//   giữ += max(0, round(tbs_num(form.so_tien)))   cho mỗi phiếu rut_tien_vi_kh (object_type
//   wallet_withdraw) có status=1 AND (is_deleted IS NULL OR 0) AND id<>$ex AND trim(form.cus)===cus.
// Trước bản vá: HoldService KHÔNG có provider nào ⇒ khách tiêu được tiền đang chờ rút.
// Ca thật trên prod: TBS1931, phiếu #91795, 15.965.000đ, số dư sổ đúng 15.965.000đ.
//
// Mỗi describe dựng kịch bản MỘT LẦN trong beforeAll rồi mỗi it() khẳng định đúng MỘT điều.
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ApprovalModule } from '../src/approval/approval.module';
import { MoneyModule } from '../src/money/money.module';
import { RequestService } from '../src/approval/request.service';
import { ApprovalService } from '../src/approval/approval.service';
import { WalletService } from '../src/money/wallet.service';
import { HoldService } from '../src/money/hold.service';
import { tbsNum } from '../src/money/pending-approval-hold';
import { DUNG_SAI_AM } from '../src/common/money';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from './helpers/approval-db';
import { resetDb } from './helpers/db';

const RUT = 'ZZHOLD_rut_tien_vi_kh';
const PB = 'ZZHOLD_phan_bo_vi_kh';

let mod: TestingModule;
let reqSvc: RequestService;
let approvalSvc: ApprovalService;
let wallet: WalletService;
let hold: HoldService;

async function fresh() {
  await resetApproval();
  await resetDb();
  await prisma.user.create({ data: { username: 'zzhold_kt', password: 'x', gid: 46 } }); // gid 46 = KẾ TOÁN LOGISTICS (prod)
  await prisma.user.create({ data: { username: 'zzhold_sale', password: 'x' } });
  for (const [code, objectType] of [[RUT, 'wallet_withdraw'], [PB, 'wallet_alloc']] as const) {
    const t = await seedTemplate(code, { objectType });
    const s = await seedStep(t.id, { order: 1 });
    await seedApprover(s.id, 'group', 46);
  }
}
const submitRut = (cus: string, soTien: unknown, extra: Record<string, unknown> = {}) =>
  reqSvc.submit(RUT, 'wallet_withdraw', 0, 'RUT-' + cus, 'zzhold_sale', { cus, so_tien: soTien, ...extra });
const nap = (cus: string, amt: number, accountType: 'cty' | 'ca_nhan' = 'cty') =>
  wallet.applyEntry(cus, amt, 0, 'nạp thử', 'zzhold', 0, { accountType });

beforeAll(async () => {
  mod = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await mod.init(); // onModuleInit của ApprovalModule đăng ký handler nghiệp vụ
  reqSvc = mod.get(RequestService);
  approvalSvc = mod.get(ApprovalService);
  wallet = mod.get(WalletService);
  hold = mod.get(HoldService);
});
afterAll(async () => {
  await resetApproval(); await resetDb(); // dọn dữ liệu ZZHOLD_
  await mod.close();
  await prisma.$disconnect();
});

describe('khách có phiếu RÚT đang chờ duyệt', () => {
  beforeAll(async () => {
    await fresh();
    await nap('ZZHOLD_A', 1_000_000);
    await submitRut('ZZHOLD_A', 300_000);
    await nap('ZZHOLD_B', 1_000_000); // đối chứng: không có phiếu nào
  });
  it('số dư KHẢ DỤNG giảm đúng số tiền phiếu', async () => {
    expect(await wallet.getBalanceAvailable('ZZHOLD_A')).toBe(700_000n);
  });
  it('số dư THẬT (sổ) không đổi', async () => {
    expect(await wallet.getBalanceTrue('ZZHOLD_A')).toBe(1_000_000n);
  });
  it('đối chứng: khách không có phiếu chờ — khả dụng = số dư thật', async () => {
    expect(await wallet.getBalanceAvailable('ZZHOLD_B')).toBe(1_000_000n);
  });
  it('holdAmount loại đúng phiếu được chỉ định (excludeRequestId)', async () => {
    const r = await prisma.approvalRequest.findFirstOrThrow({ where: { objectCode: 'RUT-ZZHOLD_A' } });
    expect(await hold.holdAmount('ZZHOLD_A', r.id)).toBe(0n);
  });
});

describe('sau khi DUYỆT phiếu rút', () => {
  let approve: { ok: boolean; status: number };
  let reqId: number;
  beforeAll(async () => {
    await fresh();
    await nap('ZZHOLD_A', 1_000_000);
    reqId = (await submitRut('ZZHOLD_A', 300_000)).requestId;
    approve = await approvalSvc.approve(reqId, 'zzhold_kt');
  });
  it('phiếu chuyển APPROVED', () => {
    expect(approve.status).toBe(2);
  });
  it('ví bị trừ ĐÚNG MỘT LẦN', async () => {
    expect(await wallet.getBalanceTrue('ZZHOLD_A')).toBe(700_000n);
  });
  it('đúng một bút toán rút (type -3) neo vào phiếu', async () => {
    // M-4 (24/09/2026): khoá mang loại hiệu ứng — `approval:<id>:wallet_withdraw` (trước: `approval:<id>`).
    expect(await prisma.walletEntry.count({ where: { cusId: 'ZZHOLD_A', type: -3, refKey: 'approval:' + reqId + ':wallet_withdraw' } })).toBe(1);
  });
  it('tiền giữ được nhả', async () => {
    expect(await hold.holdAmount('ZZHOLD_A')).toBe(0n);
  });
  it('khả dụng = số dư thật (không trừ giữ lần nữa)', async () => {
    expect(await wallet.getBalanceAvailable('ZZHOLD_A')).toBe(700_000n);
  });
});

describe('sau khi TỪ CHỐI phiếu rút', () => {
  beforeAll(async () => {
    await fresh();
    await nap('ZZHOLD_A', 1_000_000);
    const r = await submitRut('ZZHOLD_A', 300_000);
    await approvalSvc.reject(r.requestId, 'zzhold_kt', 'không đủ chứng từ');
  });
  it('tiền giữ được nhả', async () => {
    expect(await hold.holdAmount('ZZHOLD_A')).toBe(0n);
  });
  it('khả dụng trở lại bằng số dư thật', async () => {
    expect(await wallet.getBalanceAvailable('ZZHOLD_A')).toBe(1_000_000n);
  });
  it('không có bút toán rút nào được ghi', async () => {
    expect(await prisma.walletEntry.count({ where: { cusId: 'ZZHOLD_A', type: -3 } })).toBe(0);
  });
});

describe('⛔ TIÊU HAI LẦN — phiếu rút X đang chờ trên số dư đúng X', () => {
  const X = 15_965_000; // đúng ca TBS1931 trên prod
  let spend: Awaited<ReturnType<WalletService['applyEntry']>>;
  let spendCtl: Awaited<ReturnType<WalletService['applyEntry']>>;
  let approveErr: string;
  let synced: boolean;
  beforeAll(async () => {
    await fresh();
    // đối chứng làm TRƯỚC: cùng số dư, KHÔNG có phiếu chờ ⇒ tiêu được
    await nap('ZZHOLD_B', X);
    spendCtl = await wallet.applyEntry('ZZHOLD_B', -X, 1, 'thanh toán đơn', 'zzhold_sale');
    await nap('ZZHOLD_A', X);
    const r = await submitRut('ZZHOLD_A', X);
    spend = await wallet.applyEntry('ZZHOLD_A', -X, 1, 'thanh toán đơn', 'zzhold_sale');
    // handler trừ ví lỗi thì BusinessSync NÉM ra — bắt lại để các it() còn chạy và nói rõ lý do
    approveErr = await approvalSvc.approve(r.requestId, 'zzhold_kt').then(() => '', (e) => String(e?.message ?? e));
    synced = (await prisma.approvalRequest.findUniqueOrThrow({ where: { id: r.requestId } })).synced;
  });
  it('lần tiêu X bị TỪ CHỐI', () => {
    expect(spend.ok).toBe(false);
  });
  it('bị từ chối VÌ tiền đang giữ (hold = X), không phải lý do khác', () => {
    expect(spend.hold).toBe(BigInt(X));
  });
  it('duyệt phiếu rút sau đó KHÔNG lỗi', () => {
    expect(approveErr).toBe('');
  });
  it('duyệt phiếu rút sau đó trừ ví xong (synced)', () => {
    expect(synced).toBe(true);
  });
  it('ví về đúng 0 — không xuống dưới dung sai âm', async () => {
    expect(await wallet.getBalanceTrue('ZZHOLD_A')).toBe(0n);
  });
  it('ví không bao giờ dưới −DUNG_SAI_AM', async () => {
    expect((await wallet.getBalanceTrue('ZZHOLD_A')) >= -DUNG_SAI_AM).toBe(true);
  });
  it('đối chứng: khách không có phiếu chờ tiêu được X', () => {
    expect(spendCtl.ok).toBe(true);
  });
});

describe('quy tắc giữ chép ĐÚNG prod holdCalc', () => {
  beforeAll(async () => {
    await fresh();
    await submitRut('ZZHOLD_VN', '15.965.000');            // tbs_num: chấm ngăn nghìn VN
    await submitRut(' ZZHOLD_TRIM ', 100_000);             // prod trim(form.cus)
    await submitRut('zzhold_case', 100_000);               // prod so === (phân biệt hoa thường)
    await submitRut('ZZHOLD_NEG', -50_000);                // max(0, …)
    await submitRut('ZZHOLD_ST', 111_000);                 // sẽ đổi trạng thái bên dưới
    const del = await submitRut('ZZHOLD_DEL', 222_000);
    await prisma.approvalRequest.update({ where: { id: del.requestId }, data: { isDeleted: true } });
    const st = await prisma.approvalRequest.findFirstOrThrow({ where: { objectCode: 'RUT-ZZHOLD_ST' } });
    await prisma.approvalRequest.update({ where: { id: st.id }, data: { status: -2 } }); // thu hồi
    const t = await seedTemplate('ZZHOLD_other', { objectType: 'demo_sync' });
    await prisma.approvalRequest.create({ data: { templateId: t.id, objectType: 'demo_sync', objectId: 0, currentStepOrder: 1,
      status: 1, submittedBy: 'zzhold_sale', submittedAt: 1, formData: JSON.stringify({ cus: 'ZZHOLD_OTH', so_tien: 999 }) } });
    await prisma.approvalRequest.create({ data: { templateId: t.id, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1,
      status: 1, submittedBy: 'zzhold_sale', submittedAt: 1, formData: '{hỏng' } });
    await reqSvc.submit(PB, 'wallet_alloc', 0, 'PB-1', 'zzhold_sale', { cus: 'ZZHOLD_PB', so_tien: 400_000 });
  });
  it('số tiền kiểu VN "15.965.000" giữ 15.965.000', async () => {
    expect(await hold.holdAmount('ZZHOLD_VN')).toBe(15_965_000n);
  });
  it('mã khách trong phiếu có dấu cách vẫn khớp (trim)', async () => {
    expect(await hold.holdAmount('ZZHOLD_TRIM')).toBe(100_000n);
  });
  it('mã khách khác hoa/thường KHÔNG khớp (như === của prod)', async () => {
    expect(await hold.holdAmount('ZZHOLD_CASE')).toBe(0n);
  });
  it('đối chứng: đúng hoa/thường thì khớp', async () => {
    expect(await hold.holdAmount('zzhold_case')).toBe(100_000n);
  });
  it('số tiền âm giữ 0 (max 0)', async () => {
    expect(await hold.holdAmount('ZZHOLD_NEG')).toBe(0n);
  });
  it('phiếu đã xoá mềm không giữ', async () => {
    expect(await hold.holdAmount('ZZHOLD_DEL')).toBe(0n);
  });
  it('phiếu đã thu hồi (status -2) không giữ', async () => {
    expect(await hold.holdAmount('ZZHOLD_ST')).toBe(0n);
  });
  it('phiếu loại khác (không trừ ví) không giữ', async () => {
    expect(await hold.holdAmount('ZZHOLD_OTH')).toBe(0n);
  });
  it('form_data hỏng bị bỏ qua, không làm sập phép tính', async () => {
    expect(await hold.holdAmount('ZZHOLD_VN')).toBe(15_965_000n);
  });
  it('phiếu phân bổ (wallet_alloc) chờ duyệt giữ đúng số handler sẽ trừ (so_tien)', async () => {
    expect(await hold.holdAmount('ZZHOLD_PB')).toBe(400_000n);
  });
});

describe('tái hiện ca prod TBS1931 (luồng Cá nhân)', () => {
  beforeAll(async () => {
    await fresh();
    await nap('ZZHOLD_1931', 15_965_000, 'ca_nhan');
    await submitRut('ZZHOLD_1931', '15965000', { loai_tk: 'Cá nhân (hàng mẫu)' });
  });
  it('khả dụng = 0 như prod', async () => {
    expect(await wallet.getBalanceAvailable('ZZHOLD_1931')).toBe(0n);
  });
  it('duyệt xong bút toán rút ghi vào luồng ca_nhan', async () => {
    const r = await prisma.approvalRequest.findFirstOrThrow({ where: { objectCode: 'RUT-ZZHOLD_1931' } });
    await approvalSvc.approve(r.id, 'zzhold_kt');
    const e = await prisma.walletEntry.findFirstOrThrow({ where: { cusId: 'ZZHOLD_1931', type: -3 } });
    expect(e.accountType).toBe('ca_nhan');
  });
});

describe('tbsNum — bản chép tbs_num() prod (global/libs/gffunc.php)', () => {
  it.each([
    ['1.234.567,89', 1234567.89], ['1,234,567.89', 1234567.89], ['1234567.89', 1234567.89],
    ['5,5', 5.5], ['1.500', 1500], ['15965000', 15965000], ['15.965.000 đ', 15965000],
    ['1,234,567', 1234567], ['1,234', 1.234], ['', 0], ['-', 0], ['-1.500', -1500], ['abc', 0],
  ])('%p → %p', (v, n) => {
    expect(tbsNum(v)).toBe(n);
  });
});
