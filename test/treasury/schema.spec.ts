// 09b đợt 1, Task 1 — model + migration only (không service/HTTP).
// Giá trị tiền thật lấy từ đặc tả §2/§3.3 (docs/rewrite-spec/09b-so-quy-treasury.md)
// để bảo đảm round-trip không mất chữ số qua Decimal(20,5)/Decimal(18,6), và các
// sentinel (reversal_of=0, source_module='', status 0/1/9, type 'tranfer' sic)
// được giữ nguyên nghĩa như prod.
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';

beforeEach(resetTreasury);
afterAll(() => prisma.$disconnect());

describe('FundAccount schema (09b đợt 1)', () => {
  test('TK02 — opening_balance 4.157.885 CNY round-trip đủ chữ số qua Decimal(20,5)', async () => {
    const a = await seedFundAccount('TK02', {
      name: 'RMB AGENT BẰNG TƯỜNG',
      currency: 'CNY',
      accGroup: 'bank',
      openingBalance: new Prisma.Decimal('4157885'),
      glAccount: '1122',
    });
    const found = await prisma.fundAccount.findUniqueOrThrow({ where: { id: a.id } });
    expect(found.openingBalance.toFixed(5)).toBe('4157885.00000');
    expect(found.currency).toBe('CNY');
    expect(found.glAccount).toBe('1122');
  });

  test('TK07 — gl_account rỗng là THẬT (chưa khai), KHÔNG NULL (đặc tả §2.1, migration 2.1)', async () => {
    const a = await seedFundAccount('TK07', {
      name: 'TK CỌC',
      accGroup: 'store',
      isActive: 0,
    });
    const found = await prisma.fundAccount.findUniqueOrThrow({ where: { id: a.id } });
    expect(found.glAccount).toBe('');
    expect(found.accGroup).toBe('store');
    expect(found.isActive).toBe(0);
  });

  test('code UNIQUE như prod', async () => {
    await seedFundAccount('TK01');
    await expect(seedFundAccount('TK01')).rejects.toThrow();
  });

  test('không mang cột password (đặc tả §2.1/Q15 — KHÔNG port, không mã nào đọc)', () => {
    const schema = readFileSync(join(__dirname, '../../prisma/schema.prisma'), 'utf8');
    const start = schema.indexOf('model FundAccount');
    const block = schema.slice(start, start + schema.slice(start).indexOf('\n}'));
    // Chỉ soi các dòng KHAI BÁO CỘT (bỏ dòng `//` chú thích, vốn được phép nhắc
    // tới "password" để giải thích LÝ DO không mang cột này).
    const fieldLines = block.split('\n').filter((l) => !l.trim().startsWith('//'));
    expect(fieldLines.join('\n')).not.toMatch(/password/i);
  });
});

describe('TreasuryEntry schema (09b đợt 1)', () => {
  test('TK02 — opening 4.157.885 + Σstatus=1 −4.328.821,87 = số dư −170.936,87 (đặc tả §3.3, T1)', async () => {
    await seedFundAccount('TK02', {
      currency: 'CNY',
      openingBalance: new Prisma.Decimal('4157885'),
    });
    await seedTreasuryEntry({
      tkCode: 'TK02',
      type: 'out',
      money: new Prisma.Decimal('-4328821.87'),
      status: 1,
      sourceModule: 'payment',
      sourceId: 1,
    });
    // dòng status=0/9 KHÔNG được vào số dư (T1/T4) — thêm để chứng minh không lẫn
    await seedTreasuryEntry({
      tkCode: 'TK02',
      type: 'out',
      money: new Prisma.Decimal('-999999'),
      status: 0,
      sourceModule: '',
      sourceId: 0,
    });
    await seedTreasuryEntry({
      tkCode: 'TK02',
      type: 'out',
      money: new Prisma.Decimal('-888888'),
      status: 9,
      sourceModule: 'thu_chi_tbs',
      sourceId: 2,
    });

    const acc = await prisma.fundAccount.findFirstOrThrow({ where: { code: 'TK02' } });
    const agg = await prisma.treasuryEntry.aggregate({
      where: { tkCode: 'TK02', status: 1 },
      _sum: { money: true },
    });
    const balance = acc.openingBalance.plus(agg._sum.money ?? new Prisma.Decimal(0));
    expect(balance.toFixed(2)).toBe('-170936.87');
  });

  test('id lớn nhất đo được trên prod (1.790.251.005) round-trip qua Int (< 2³¹)', async () => {
    const row = await seedTreasuryEntry({
      id: 1_790_251_005,
      tkCode: 'TK02',
      type: 'in',
      money: new Prisma.Decimal('100'),
      status: 1,
    });
    expect(row.id).toBe(1_790_251_005);
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: 1_790_251_005 } });
    expect(found.id).toBe(1_790_251_005);
  });

  test('status 0 (treo), 1 (lên sổ), 9 (huỷ chưa lên sổ) — cả ba giữ nguyên nghĩa (§3.2)', async () => {
    const s0 = await seedTreasuryEntry({ tkCode: 'TK09', type: 'out', money: new Prisma.Decimal('-1'), status: 0 });
    const s1 = await seedTreasuryEntry({ tkCode: 'TK09', type: 'out', money: new Prisma.Decimal('-1'), status: 1 });
    const s9 = await seedTreasuryEntry({ tkCode: 'TK09', type: 'out', money: new Prisma.Decimal('-1'), status: 9 });
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: s0.id } })).status).toBe(0);
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: s1.id } })).status).toBe(1);
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: s9.id } })).status).toBe(9);
  });

  test('type "tranfer" (sic) giữ nguyên chính tả — là KHOÁ lọc báo cáo (§12.1), KHÔNG "sửa" thành transfer', async () => {
    const row = await seedTreasuryEntry({
      tkCode: 'TK01',
      type: 'tranfer',
      money: new Prisma.Decimal('-100'),
      status: 1,
      sourceModule: '', // chân nguồn luân chuyển tay ghi source_module='' (đặc tả §5.5)
    });
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(found.type).toBe('tranfer');
  });

  test('rate 18 dòng fx_transfer đo được có 6 chữ số lẻ — round-trip qua Decimal(18,6) (Q8/M3 nới)', async () => {
    const row = await seedTreasuryEntry({
      tkCode: 'TK01',
      type: 'tranfer',
      money: new Prisma.Decimal('-1000'),
      status: 1,
      rate: new Prisma.Decimal('3925.123456'),
    });
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(found.rate?.toFixed(6)).toBe('3925.123456');
  });

  test('rate NULL ≠ 0 (39 dòng INSERT cũ không có cột, đặc tả §2.2) — giữ phân biệt', async () => {
    const row = await seedTreasuryEntry({
      tkCode: 'TK01',
      type: 'out',
      money: new Prisma.Decimal('-1'),
      status: 1,
      // rate omitted -> NULL
    });
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(found.rate).toBeNull();
  });

  test('reversal_of=0 là sentinel "không phải dòng đảo" (mặc định, KHÔNG NULL) — đặc tả §2.2/T3', async () => {
    const row = await seedTreasuryEntry({
      tkCode: 'TK01',
      type: 'out',
      money: new Prisma.Decimal('-1'),
      status: 1,
    });
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(found.reversalOf).toBe(0);
  });

  test('tk_code "CHI-TBS" hợp lệ dù KHÔNG có trong tbl_accounts — KHÔNG FK (39 dòng thật, đặc tả §5.3/§12.5)', async () => {
    // Cố ý KHÔNG seed FundAccount('CHI-TBS') — mã theo dõi, không phải ví.
    const row = await seedTreasuryEntry({
      tkCode: 'CHI-TBS',
      type: 'out',
      money: new Prisma.Decimal('-226.80423'),
      status: 9,
      sourceModule: 'thu_chi_tbs',
      sourceId: 95019,
      reversalReason: 'nộp thuế NK #95019',
    });
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(found.tkCode).toBe('CHI-TBS');
    expect(found.money?.toFixed(5)).toBe('-226.80423');
  });

  test('cus_id NULL khác "" (2.014 NULL, 256 rỗng — đặc tả §2.2) — giữ phân biệt, KHÔNG NULLIF', async () => {
    const withNull = await seedTreasuryEntry({ tkCode: 'TK01', type: 'in', money: new Prisma.Decimal('1'), status: 1 });
    const withEmpty = await seedTreasuryEntry({
      tkCode: 'TK01',
      type: 'in',
      money: new Prisma.Decimal('1'),
      status: 1,
      cusId: '',
    });
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: withNull.id } })).cusId).toBeNull();
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: withEmpty.id } })).cusId).toBe('');
  });

  test('ix_source (source_module, source_id) KHÔNG unique ở CSDL (chống trùng ở tầng code, §10.2/Q3) — 2 dòng cùng khoá được phép', async () => {
    await seedTreasuryEntry({
      tkCode: 'TK01',
      type: 'out',
      money: new Prisma.Decimal('-1'),
      status: 1,
      sourceModule: 'payment',
      sourceId: 999,
    });
    await expect(
      seedTreasuryEntry({
        tkCode: 'TK01',
        type: 'out',
        money: new Prisma.Decimal('-1'),
        status: 1,
        sourceModule: 'payment',
        sourceId: 999,
      }),
    ).resolves.toBeDefined();
    const count = await prisma.treasuryEntry.count({ where: { sourceModule: 'payment', sourceId: 999 } });
    expect(count).toBe(2);
  });

  test('money 5 chữ số lẻ (dòng gõ tay CHI-TBS, đặc tả §2.2) round-trip qua Decimal(20,5)', async () => {
    const row = await seedTreasuryEntry({
      tkCode: 'CHI-TBS',
      type: 'out',
      money: new Prisma.Decimal('-307833920.07640'),
      status: 9,
    });
    const found = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(found.money?.toFixed(5)).toBe('-307833920.07640');
  });
});
