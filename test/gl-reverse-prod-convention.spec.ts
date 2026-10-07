// Q5 (24/09/2026) — GlService.reverse() phải nhận ra quy ước ĐẢO CỦA PROD.
//
// Prod (libs/cls.gl.php::reverse) đảo X bằng: bút toán mới source_type='reversal',
// source_id=X, reversal_of=X (UPDATE riêng, ngoài giao dịch) và đặt status=-1 cho X.
// Prod chỉ từ chối khi status=-1; post() của prod còn chặn lần hai qua findBySource('reversal', X).
// Hệ mới đảo bằng 'daoxoa_<loại gốc>' ⇒ trên dữ liệu đã migrate, không thấy ('reversal', X)
// và ĐẢO LẦN HAI 25 bút toán prod đã đảo.
//
// Đo prod 24/09: 32 bút toán 'reversal' (reversal_of = source_id ở cả 32), 7 mồ côi; 25 gốc
// còn tồn tại đều status=-1; 21/25 gốc CHÍNH LÀ bút toán 'reversal' ⇒ prod CHO đảo một bút
// toán đảo (chuỗi 4 tầng) — hệ mới cũng phải cho (ca đối chứng C2).
import { prisma, resetDb, seedAccounts } from './helpers/db';
import { GlService } from '../src/money/gl.service';

const gl = new GlService(prisma as any);
beforeEach(async () => { await resetDb(); await seedAccounts(); });
afterAll(() => prisma.$disconnect());

const LINES = [
  { accountCode: '111', debit: 1000, credit: 0, cusId: 'ZZGL_KH1' },
  { accountCode: '131', debit: 0, credit: 1000, cusId: 'ZZGL_KH1' },
];

async function seedOriginal(sid: number): Promise<number> {
  const r = await gl.post({ entryDate: 1, sourceType: 'wallet_nap', sourceId: sid, createdBy: 'ZZGL_t', lines: LINES });
  return r.entryId!;
}

/** Dựng đúng hình dạng prod để lại: bút toán ('reversal', X) Nợ/Có đảo, reversal_of theo tham số. */
async function seedProdReversal(x: number, reversalOf: number | undefined): Promise<number> {
  const r = await gl.post({
    entryDate: 1, sourceType: 'reversal', sourceId: x, createdBy: 'ZZGL_prod',
    description: 'ZZGL ĐẢO bút toán (dữ liệu prod đã migrate)', reversalOf,
    lines: LINES.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
  });
  return r.entryId!;
}

const countReversalsOf = (x: number) =>
  prisma.glEntry.count({ where: { sourceType: { startsWith: 'daoxoa_' }, sourceId: BigInt(x) } });

describe('reverse() — quy ước prod: status = -1', () => {
  it('bút toán gốc status=-1 (không thấy dòng đảo) KHÔNG bị đảo lần nữa', async () => {
    const x = await seedOriginal(101);
    await prisma.glEntry.update({ where: { id: x }, data: { status: -1 } });
    await gl.reverse(x, 'ZZGL_admin', 'thử đảo lần hai');
    expect(await countReversalsOf(x)).toBe(0);
  });

  it('bút toán gốc status=-1 trả status error', async () => {
    const x = await seedOriginal(102);
    await prisma.glEntry.update({ where: { id: x }, data: { status: -1 } });
    const r = await gl.reverse(x, 'ZZGL_admin', 'thử đảo lần hai');
    expect(r.status).toBe('error');
  });
});

describe("reverse() — quy ước prod: đã có bút toán ('reversal', X)", () => {
  it("có ('reversal', X) nhưng reversal_of rỗng (UPDATE thứ hai của prod hỏng) ⇒ KHÔNG đảo lần nữa", async () => {
    const x = await seedOriginal(201);
    await seedProdReversal(x, undefined);
    await gl.reverse(x, 'ZZGL_admin', 'thử đảo lần hai');
    expect(await countReversalsOf(x)).toBe(0);
  });

  it("có ('reversal', X) ⇒ trả exists kèm id bút toán đảo sẵn có", async () => {
    const x = await seedOriginal(202);
    const rid = await seedProdReversal(x, undefined);
    const r = await gl.reverse(x, 'ZZGL_admin', 'thử đảo lần hai');
    expect(r).toEqual({ status: 'exists', entryId: rid });
  });

  it('đủ hình dạng prod (status=-1 + reversal_of=X) ⇒ KHÔNG đảo lần nữa', async () => {
    const x = await seedOriginal(203);
    await seedProdReversal(x, x);
    await prisma.glEntry.update({ where: { id: x }, data: { status: -1 } });
    await gl.reverse(x, 'ZZGL_admin', 'thử đảo lần hai');
    expect(await countReversalsOf(x)).toBe(0);
  });
});

describe('reverse() — tín hiệu reversal_of = X (câu hỏi chuẩn "đã đảo chưa", tài liệu migration 4.1)', () => {
  it('có bút toán reversal_of=X với source khác (không phải reversal/daoxoa_) ⇒ KHÔNG đảo lần nữa', async () => {
    const x = await seedOriginal(401);
    await gl.post({
      entryDate: 1, sourceType: 'ZZGL_dao_tay', sourceId: 999, createdBy: 'ZZGL_t', reversalOf: x,
      lines: LINES.map((l) => ({ ...l, debit: l.credit, credit: l.debit })),
    });
    await gl.reverse(x, 'ZZGL_admin', 'thử đảo lần hai');
    expect(await countReversalsOf(x)).toBe(0);
  });
});

describe('reverse() — đối chứng: bút toán CHƯA đảo vẫn đảo được', () => {
  it('C1: bút toán chưa đảo, bên cạnh có bút toán prod đã đảo ⇒ vẫn đảo được', async () => {
    const daDao = await seedOriginal(301);
    await seedProdReversal(daDao, daDao);
    await prisma.glEntry.update({ where: { id: daDao }, data: { status: -1 } });
    const x = await seedOriginal(302);
    const r = await gl.reverse(x, 'ZZGL_admin', 'đảo lần đầu');
    expect(r.status).toBe('posted');
  });

  it("C2: chính bút toán ('reversal', …) chưa bị đảo ⇒ đảo được (prod cho phép — 21 ca thật)", async () => {
    const goc = await seedOriginal(303);
    const rv = await seedProdReversal(goc, goc);
    await prisma.glEntry.update({ where: { id: goc }, data: { status: -1 } });
    const r = await gl.reverse(rv, 'ZZGL_admin', 'đảo bút toán đảo');
    expect(r.status).toBe('posted');
  });
});
