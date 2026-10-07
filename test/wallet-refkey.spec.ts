import { prisma, resetDb, seedAccounts } from './helpers/db';
import { WalletService } from '../src/money/wallet.service';
import { HoldService } from '../src/money/hold.service';
import { GlMapService } from '../src/money/gl-map.service';
import { GlService } from '../src/money/gl.service';

const hold = new HoldService(prisma as any);
const gl = new GlService(prisma as any);
const glmap = new GlMapService(prisma as any, gl);
const wallet = new WalletService(prisma as any, hold, glmap);

beforeEach(async () => {
  await resetDb();
  await seedAccounts();
});
afterAll(() => prisma.$disconnect());

// Vì sao có bộ này: business-sync (#04) đặt cờ `synced` TRƯỚC khi handler chạy.
// Tiến trình chết giữa hai bước ⇒ phiếu mang tiếng đã đồng bộ mà tiền CHƯA đi,
// và không cách nào chạy lại an toàn vì sổ ví không phân biệt được "chưa ghi"
// với "đã ghi rồi". `refKey` gỡ đúng nút đó: neo bút toán vào khoá nghiệp vụ.
describe('WalletService.applyEntry — refKey: an toàn khi chạy lại', () => {
  it('gọi HAI lần cùng refKey -> chỉ ghi MỘT bút toán, số dư trừ đúng một lần', async () => {
    await wallet.applyEntry('TBSRK1', 1_000_000, 0, 'nạp', 'kt1');
    expect(await wallet.getBalanceTrue('TBSRK1')).toBe(1_000_000n);

    const a = await wallet.applyEntry('TBSRK1', -400_000, 4, 'phân bổ', 'approval', 0, { refKey: 'approval:77' });
    expect(a.ok).toBe(true);
    expect(a.alreadyApplied).toBeUndefined();
    expect(await wallet.getBalanceTrue('TBSRK1')).toBe(600_000n);

    const b = await wallet.applyEntry('TBSRK1', -400_000, 4, 'phân bổ', 'approval', 0, { refKey: 'approval:77' });
    expect(b.ok).toBe(true); // KHÔNG phải lỗi — đã ghi rồi là trạng thái ĐÚNG
    expect(b.alreadyApplied).toBe(true);
    expect(b.detailId).toBe(a.detailId); // trỏ về chính bút toán cũ
    expect(await wallet.getBalanceTrue('TBSRK1')).toBe(600_000n); // KHÔNG trừ lần hai

    expect(await prisma.walletEntry.count({ where: { refKey: 'approval:77' } })).toBe(1);
  });

  it('⚠ hai lời gọi SONG SONG cùng refKey -> vẫn chỉ MỘT bút toán', async () => {
    await wallet.applyEntry('TBSRK2', 1_000_000, 0, 'nạp', 'kt1');
    const [r1, r2] = await Promise.all([
      wallet.applyEntry('TBSRK2', -300_000, 4, 'p', 'approval', 0, { refKey: 'approval:88' }),
      wallet.applyEntry('TBSRK2', -300_000, 4, 'p', 'approval', 0, { refKey: 'approval:88' }),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(await prisma.walletEntry.count({ where: { refKey: 'approval:88' } })).toBe(1);
    expect(await wallet.getBalanceTrue('TBSRK2')).toBe(700_000n);
  });

  it('refKey KHÁC nhau -> ghi bình thường (neo không được chặn nhầm)', async () => {
    await wallet.applyEntry('TBSRK3', 1_000_000, 0, 'nạp', 'kt1');
    await wallet.applyEntry('TBSRK3', -100_000, 4, 'p1', 'approval', 0, { refKey: 'approval:1' });
    await wallet.applyEntry('TBSRK3', -100_000, 4, 'p2', 'approval', 0, { refKey: 'approval:2' });
    expect(await wallet.getBalanceTrue('TBSRK3')).toBe(800_000n);
  });

  it('KHÔNG truyền refKey -> giữ nguyên hành vi cũ, mỗi lần gọi là một bút toán', async () => {
    await wallet.applyEntry('TBSRK4', 1_000_000, 0, 'nạp', 'kt1');
    await wallet.applyEntry('TBSRK4', -100_000, 4, 'p', 'approval');
    await wallet.applyEntry('TBSRK4', -100_000, 4, 'p', 'approval');
    expect(await wallet.getBalanceTrue('TBSRK4')).toBe(800_000n); // trừ HAI lần, đúng ý
    expect(await prisma.walletEntry.count({ where: { cusId: 'TBSRK4', refKey: null } })).toBe(3);
  });

  it('bút toán bị TỪ CHỐI (thiếu số dư) KHÔNG chiếm chỗ refKey — chạy lại được', async () => {
    await wallet.applyEntry('TBSRK5', 10_000, 0, 'nạp ít', 'kt1');
    const fail = await wallet.applyEntry('TBSRK5', -900_000, 4, 'p', 'approval', 0, { refKey: 'approval:99' });
    expect(fail.ok).toBe(false); // không đủ số dư
    expect(await prisma.walletEntry.count({ where: { refKey: 'approval:99' } })).toBe(0);

    // nạp thêm rồi chạy lại CÙNG refKey -> phải ghi được, không bị neo chặn oan
    await wallet.applyEntry('TBSRK5', 1_000_000, 0, 'nạp thêm', 'kt1');
    const ok = await wallet.applyEntry('TBSRK5', -900_000, 4, 'p', 'approval', 0, { refKey: 'approval:99' });
    expect(ok.ok).toBe(true);
    expect(ok.alreadyApplied).toBeUndefined();
    expect(await wallet.getBalanceTrue('TBSRK5')).toBe(110_000n);
  });
});
