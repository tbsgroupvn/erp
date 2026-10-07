// M-5 + M-4 (review cuối nhánh fix/03-money-gaps) — handler RÚT TIỀN ví qua duyệt.
//
// M-5: các nhánh còn thiếu test — thất bại, chạy lần hai, payInfo, author, bút toán GL loại −3.
// M-4: khoá chống trùng cũ `approval:<id>` không mang loại hiệu ứng ⇒ hiệu ứng tiền thứ hai trên cùng
//      phiếu bị bỏ qua lặng lẽ. Khoá mới `approval:<id>:wallet_withdraw`; bút toán đã ghi bằng khoá cũ
//      (cùng loại −3) hoặc mang dấu prod "[PHIEU-RUT#<id>]" KHÔNG được trừ lần hai.
//
// Khách TBS_ZZAPPR_* (không bắt đầu bằng ZZ) để GL KHÔNG bỏ qua — ca GL mới kiểm được gì đó.
import { prisma, resetApproval, seedTemplate } from '../helpers/approval-db';
import { resetDb, seedAccounts } from '../helpers/db';
import { WalletWithdrawHandler } from '../../src/approval/wallet-withdraw.handler';
import { WalletService } from '../../src/money/wallet.service';
import { HoldService } from '../../src/money/hold.service';
import { GlMapService } from '../../src/money/gl-map.service';
import { GlService } from '../../src/money/gl.service';

const CUS = 'TBS_ZZAPPR_W';
const hold = new HoldService(prisma as any);
const glmap = new GlMapService(prisma as any, new GlService(prisma as any));
const wallet = new WalletService(prisma as any, hold, glmap);
const h = new WalletWithdrawHandler(wallet, prisma as any);

async function fresh(balance: number) {
  await resetApproval();
  await resetDb();
  if (balance) await wallet.applyEntry(CUS, balance, 0, 'nạp', 'zzappr');
  await seedTemplate('TBS_ZZAPPR_rut_tien_vi_kh', { objectType: 'wallet_withdraw' });
}
async function request(so_tien: number, extra: Record<string, unknown> = {}, submittedBy = 'zzappr_sale_nop') {
  const t = await prisma.approvalTemplate.findUniqueOrThrow({ where: { code: 'TBS_ZZAPPR_rut_tien_vi_kh' } });
  return prisma.approvalRequest.create({ data: {
    templateId: t.id, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 2,
    submittedBy, submittedAt: 1,
    formData: JSON.stringify({ cus: CUS, so_tien, chu_tk: ' NGUYEN VAN A ', so_tk_nhan: '0123456789', ngan_hang: 'VCB', ...extra }),
  } });
}
const rut = () => prisma.walletEntry.findMany({ where: { cusId: CUS, type: -3 } });

afterAll(async () => { await resetApproval(); await resetDb(); await prisma.$disconnect(); });

describe('trừ thành công', () => {
  let id: number;
  let e: Awaited<ReturnType<typeof rut>>[number];
  beforeAll(async () => {
    await fresh(1_000_000);
    id = (await request(300_000)).id;
    await h.sync(await prisma.approvalRequest.findUniqueOrThrow({ where: { id } }));
    e = (await rut())[0];
  });
  it('số tiền −300.000', () => {
    expect(e.money).toBe(-300_000n);
  });
  it('payInfo = chủ TK + số TK + ngân hàng (đã trim)', () => {
    expect(e.payInfo).toBe('NGUYEN VAN A 0123456789 VCB');
  });
  it('author = người nộp phiếu (như prod)', () => {
    expect(e.author).toBe('zzappr_sale_nop');
  });
  it('refKey mang loại hiệu ứng (M-4)', () => {
    expect(e.refKey).toBe('approval:' + id + ':wallet_withdraw');
  });
  it('note = NGUYÊN VĂN prod, mang dấu [PHIEU-RUT#id] (chép ngược về MySQL thì PHP nhận ra đã trừ)', () => {
    // prod cls.approval.php viRutTienDuyetXong(): $note = "Rut tien theo phieu duyet #".$rid." ".$dau; $dau = "[PHIEU-RUT#".$rid."]"
    // và PHP chống trừ lần hai bằng: note LIKE '%[PHIEU-RUT#<id>]%'. Thiếu dấu ⇒ dòng v2 chép ngược (L13) bị PHP trừ LẦN HAI.
    expect(e.note).toBe('Rut tien theo phieu duyet #' + id + ' [PHIEU-RUT#' + id + ']');
    expect((e.note ?? '').includes('[PHIEU-RUT#' + id + ']')).toBe(true);
  });
});

describe('chạy lần hai', () => {
  beforeAll(async () => {
    await fresh(1_000_000);
    const req = await request(300_000);
    await h.sync(req);
    await h.sync(req);
  });
  it('đúng một bút toán', async () => {
    expect((await rut()).length).toBe(1);
  });
  it('số dư trừ đúng một lần', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(700_000n);
  });
});

describe('thất bại — số dư không đủ', () => {
  let err: string;
  beforeAll(async () => {
    await fresh(100_000);
    err = await h.sync(await request(300_000)).then(() => '', (e: Error) => e.message);
  });
  it('NÉM lỗi applyEntry (fail-visible)', () => {
    expect(err).toMatch(/^applyEntry thất bại: Số dư ví không đủ/);
  });
  it('không có bút toán rút', async () => {
    expect((await rut()).length).toBe(0);
  });
  it('số dư giữ nguyên', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(100_000n);
  });
});

describe('thất bại — đối chứng: số dư đủ thì không ném', () => {
  it('không lỗi', async () => {
    await fresh(300_000);
    await expect(h.sync(await request(300_000))).resolves.toBeUndefined();
  });
});

describe('GL loại −3 (wallet_rut) — ánh xạ ĐÃ duyệt', () => {
  let gl: { sourceType: string; lines: { accountCode: string; debit: unknown; credit: unknown }[] } | null;
  let entryId: bigint;
  beforeAll(async () => {
    await fresh(1_000_000);
    await seedAccounts();
    await prisma.glAccount.create({ data: { code: '112', name: 'Tiền gửi NH', nature: 'debit' } });
    // tài khoản như ánh xạ prod wallet_rut (131/112) — prod đang để TẮT, đây là ca giả định đã bật
    await prisma.glMapping.create({ data: { bizType: 'wallet_rut', bizLabel: 'Rút tiền ví', debitAccount: '131',
      creditAccount: '112', isApproved: true, active: true } });
    // đổi tên tác giả 25/09: postBiz nay bỏ qua dữ liệu thử theo createdBy zz*/reg như prod cls.glmap.php:55-66 — assertion giữ nguyên
    await h.sync(await request(300_000, {}, 'appr_sale_nop_test'));
    entryId = (await rut())[0].id;
    gl = await prisma.glEntry.findUnique({ where: { sourceType_sourceId: { sourceType: 'wallet_detail', sourceId: entryId } },
      include: { lines: { orderBy: { lineNo: 'asc' } } } });
  });
  it('có bút toán GL neo vào dòng ví', () => {
    expect(gl?.sourceType).toBe('wallet_detail');
  });
  it('Nợ 131 / Có 112 đúng 300.000', () => {
    expect(gl!.lines.map((l) => [l.accountCode, Number(l.debit), Number(l.credit)]))
      .toEqual([['131', 300_000, 0], ['112', 0, 300_000]]);
  });
});

describe('GL loại −3 — đối chứng: ánh xạ như prod (chưa duyệt, tắt) ⇒ không ghi GL, ví vẫn trừ', () => {
  beforeAll(async () => {
    await fresh(1_000_000);
    await seedAccounts();
    await prisma.glAccount.create({ data: { code: '112', name: 'Tiền gửi NH', nature: 'debit' } });
    await prisma.glMapping.create({ data: { bizType: 'wallet_rut', bizLabel: 'Rút tiền ví', debitAccount: '131',
      creditAccount: '112', isApproved: false, active: false } });
    // Review cuối #09b I-1: tác giả mặc định 'zzappr_sale_nop' làm postBiz bỏ qua như DỮ LIỆU THỬ trước khi
    // tới cổng ánh xạ ⇒ ca đối chứng này từng XANH bất kể ánh xạ. Dùng tác giả thật để nó canh đúng cổng ánh xạ.
    await h.sync(await request(300_000, {}, 'appr_sale_nop_test'));
  });
  it('không có bút toán GL', async () => {
    expect(await prisma.glEntry.count()).toBe(0);
  });
  it('ví vẫn bị trừ', async () => {
    expect((await rut()).length).toBe(1);
  });
});

describe('GL loại −3 — đối chứng: ánh xạ ĐÃ duyệt nhưng TẮT (active=false) ⇒ không ghi GL', () => {
  // Review cuối #09b M-10: cổng `active` chưa có ca riêng. Tác giả thật (không zz) để không bị cổng dữ liệu thử che.
  beforeAll(async () => {
    await fresh(1_000_000);
    await seedAccounts();
    await prisma.glAccount.create({ data: { code: '112', name: 'Tiền gửi NH', nature: 'debit' } });
    await prisma.glMapping.create({ data: { bizType: 'wallet_rut', bizLabel: 'Rút tiền ví', debitAccount: '131',
      creditAccount: '112', isApproved: true, active: false } });
    await h.sync(await request(300_000, {}, 'appr_sale_nop_test'));
  });
  it('không có bút toán GL', async () => {
    expect(await prisma.glEntry.count()).toBe(0);
  });
  it('ví vẫn bị trừ', async () => {
    expect((await rut()).length).toBe(1);
  });
});

describe('GL loại −3 — đối chứng: ánh xạ BẬT nhưng CHƯA duyệt (isApproved=false) ⇒ không ghi GL', () => {
  // Ca đối chứng gốc (cả hai cờ tắt) để cổng `active` che mất cổng `isApproved` — gỡ riêng cổng duyệt vẫn xanh.
  // Ca này tách riêng cổng duyệt.
  beforeAll(async () => {
    await fresh(1_000_000);
    await seedAccounts();
    await prisma.glAccount.create({ data: { code: '112', name: 'Tiền gửi NH', nature: 'debit' } });
    await prisma.glMapping.create({ data: { bizType: 'wallet_rut', bizLabel: 'Rút tiền ví', debitAccount: '131',
      creditAccount: '112', isApproved: false, active: true } });
    await h.sync(await request(300_000, {}, 'appr_sale_nop_test'));
  });
  it('không có bút toán GL', async () => {
    expect(await prisma.glEntry.count()).toBe(0);
  });
  it('ví vẫn bị trừ', async () => {
    expect((await rut()).length).toBe(1);
  });
});

describe('M-4 — bút toán ĐÃ ghi bằng khoá CŨ approval:<id> (cùng loại −3)', () => {
  beforeAll(async () => {
    await fresh(1_000_000);
    const req = await request(300_000);
    // mô phỏng bút toán do mã TRƯỚC M-4 ghi
    await wallet.applyEntry(CUS, -300_000, -3, 'Rút tiền theo phiếu duyệt #' + req.id, 'zzappr_sale_nop', 0,
      { refKey: 'approval:' + req.id, holdExcludeRequest: req.id });
    await h.sync(req);
  });
  it('KHÔNG trừ lần hai', async () => {
    expect((await rut()).length).toBe(1);
  });
  it('số dư chỉ trừ một lần', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(700_000n);
  });
});

describe('M-4 — khoá cũ approval:<id> thuộc hiệu ứng KHÁC (phân bổ, type 4) trên cùng phiếu', () => {
  beforeAll(async () => {
    await fresh(1_000_000);
    const req = await request(300_000);
    await wallet.applyEntry(CUS, -100_000, 4, 'Phân bổ ví (phiếu #' + req.id + ')', 'approval', 0,
      { refKey: 'approval:' + req.id, holdExcludeRequest: req.id });
    await h.sync(req);
  });
  it('hiệu ứng rút KHÔNG bị bỏ qua lặng lẽ', async () => {
    expect((await rut()).length).toBe(1);
  });
  it('số dư = 1.000.000 − 100.000 − 300.000', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(600_000n);
  });
});

describe('dấu prod "[PHIEU-RUT#<id>]" (bút toán nạp từ prod, ref_key NULL)', () => {
  beforeAll(async () => {
    await fresh(1_000_000);
    const req = await request(300_000);
    await wallet.applyEntry(CUS, -300_000, -3, 'Rut tien theo phieu duyet #' + req.id + ' [PHIEU-RUT#' + req.id + ']', 'zzappr_sale_nop', 0,
      { holdExcludeRequest: req.id });
    await h.sync(req);
  });
  it('KHÔNG trừ lần hai', async () => {
    expect((await rut()).length).toBe(1);
  });
});

describe('dấu prod — đối chứng: dấu trùng số phiếu nhưng KHÁC số tiền (id phiếu không giữ nguyên khi nạp)', () => {
  beforeAll(async () => {
    await fresh(1_000_000);
    const req = await request(300_000);
    await wallet.applyEntry(CUS, -50_000, -3, 'Rut tien theo phieu duyet #' + req.id + ' [PHIEU-RUT#' + req.id + ']', 'zzappr_sale_nop', 0,
      { holdExcludeRequest: req.id });
    await h.sync(req);
  });
  it('vẫn trừ phiếu hiện tại', async () => {
    expect((await rut()).length).toBe(2);
  });
});
