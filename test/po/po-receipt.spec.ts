// test/po/po-receipt.spec.ts — Task 6 #06: PoReceiptService phải sinh đúng
// hình dạng mà HoldService/WalletService (#03) đọc lại, không chỉ ghi một
// bảng rồi không ai dùng tới. Ca 1+2 dưới đây là CA LIÊN-MODULE — chúng cấu
// tạo HoldService/WalletService THẬT (cùng prisma client) để chứng minh nối
// dây thật, không stub/giả lập.
//
// ⚠ Prod hiện KHÔNG có dòng `wallet/no` nào (đo 23/09/2026: 196 `bank/yes`,
// 26 `wallet/yes`, 1 `bank/no`) — đường "tiền GIỮ" chỉ được bộ test NÀY tự
// dựng và phủ, đừng tưởng đã có dữ liệu thật đi qua.
//
// ⛔ VÁ FINDING F1 (review cuối #06, 23/09/2026): bản trước có `approve()`
// tự đổi `status` 'no' -> 'yes' bằng tay, KHÔNG trừ ví — tiền bị đếm HAI
// LẦN (khách giữ tiền thật VÀ PO coi như đã thu đúng số đó). File này KHÔNG
// còn `approve()` nữa; xem comment lớn đầu `src/po/po-receipt.service.ts`.
// Ca "KHÔNG có đường nào tới status='yes'" dưới đây THAY CHỖ cho ca cũ
// "approve() chuyển status -> yes" — ca cũ CHỨNG NHẬN đúng hành vi hỏng đó
// là đúng, phải xoá chứ không thể sửa nhẹ.
import { prisma, resetDb, seedAccounts } from '../helpers/db';
import { resetPo, seedPo, seedPoReceipt } from '../helpers/po-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { PoReceiptService } from '../../src/po/po-receipt.service';
import { HoldService } from '../../src/money/hold.service';
import { WalletService } from '../../src/money/wallet.service';
import { GlMapService } from '../../src/money/gl-map.service';
import { GlService } from '../../src/money/gl.service';
import { PoStatus } from '../../src/po/po.constants';

const hold = new HoldService(prisma as any);
const gl = new GlService(prisma as any);
const glmap = new GlMapService(prisma as any, gl);
const wallet = new WalletService(prisma as any, hold, glmap);
const receiptSvc = new PoReceiptService(prisma as any);

beforeEach(async () => {
  // resetDb() (money helpers) truncate tbl_wallet/tbl_wallet_detail/GL/...
  // VÀ tbl_po_receipts; resetPo() truncate tbl_purchase_orders/tbl_po_items/
  // tbl_po_diff_acceptance (lại đụng tbl_po_receipts lần nữa — vô hại, cả
  // hai đều RESTART IDENTITY CASCADE trên cùng bảng). resetMasterdata()
  // truncate tbl_customer — cần từ khi addReceipt() thêm chốt "khách phải
  // khớp buyer của PO" (không có FK buyer_id -> customer.id trong schema
  // nên 3 lệnh TRUNCATE này độc lập nhau, thứ tự không quan trọng).
  await resetDb();
  await seedAccounts();
  await resetPo();
  await resetMasterdata();
});
afterAll(() => prisma.$disconnect());

/** Tạo khách + PO đã duyệt đủ 2 cấp, buyer = khách vừa tạo, totalAmount rộng
 *  rãi (10 triệu) trừ khi override — dùng chung cho các ca không cố tình
 *  test chốt chặn. */
async function seedApprovedPoWithBuyer(poCode: string, customerCode: string, totalAmount = 10_000_000) {
  const cus = await seedCustomer(customerCode);
  const po = await seedPo(poCode, { status: PoStatus.DA_DUYET, buyerId: cus.id, totalAmount });
  return { cus, po };
}

describe('PoReceiptService — thu theo đợt, giữ ngữ nghĩa hold #03 (Task 6 #06)', () => {
  it('CA LIÊN-MODULE 1: tạo receipt wallet/no -> HoldService.holdAmount tăng ĐÚNG số tiền', async () => {
    const { po } = await seedApprovedPoWithBuyer('PO-RCPT-001', 'TBSRCPT1');
    expect(await hold.holdAmount('TBSRCPT1')).toBe(0n);

    const r = await receiptSvc.addReceipt(
      po.id,
      { customerId: 'TBSRCPT1', amount: 3_000_000, method: 'wallet', dot: 1 },
      'kt1',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('setup');
    expect(r.receipt.status).toBe('no'); // mặc định — CHƯA duyệt = đang GIỮ

    expect(await hold.holdAmount('TBSRCPT1')).toBe(3_000_000n);

    // thêm một đợt nữa -> hold cộng dồn, không ghi đè
    await receiptSvc.addReceipt(
      po.id,
      { customerId: 'TBSRCPT1', amount: 1_500_000, method: 'wallet', dot: 2 },
      'kt1',
    );
    expect(await hold.holdAmount('TBSRCPT1')).toBe(4_500_000n);
  });

  it('CA LIÊN-MODULE 2: tiền GIỮ chặn THẬT WalletService.applyEntry — rút vào phần đang giữ bị REFUSED', async () => {
    const { po } = await seedApprovedPoWithBuyer('PO-RCPT-002', 'TBSRCPT2');
    // khách có 10tr trong ví
    const nap = await wallet.applyEntry('TBSRCPT2', 10_000_000, 0, 'nạp', 'kt1');
    expect(nap.ok).toBe(true);

    // giữ 8tr cho PO (receipt wallet/no) -> khả dụng chỉ còn 2tr
    await receiptSvc.addReceipt(
      po.id,
      { customerId: 'TBSRCPT2', amount: 8_000_000, method: 'wallet', dot: 1 },
      'kt1',
    );

    // rút 3tr (> 2tr khả dụng, dù số dư THẬT vẫn còn 10tr) -> phải bị CHẶN
    const spendTooMuch = await wallet.applyEntry('TBSRCPT2', -3_000_000, 4, 'chi', 'kt1');
    expect(spendTooMuch.ok).toBe(false);
    expect(spendTooMuch.hold).toBe(8_000_000n);
    // số dư THẬT không bị đụng — chứng minh giao dịch bị chặn TRƯỚC khi ghi
    expect(await wallet.getBalanceTrue('TBSRCPT2')).toBe(10_000_000n);

    // rút trong phạm vi khả dụng (1.5tr < 2tr còn lại) -> phải cho qua
    const spendOk = await wallet.applyEntry('TBSRCPT2', -1_500_000, 4, 'chi hợp lệ', 'kt1');
    expect(spendOk.ok).toBe(true);
    expect(await wallet.getBalanceTrue('TBSRCPT2')).toBe(8_500_000n);
  });

  it('KHÔNG có đường nào trong service đưa phiếu thu tới status=\'yes\' (vá F1)', async () => {
    expect((receiptSvc as any).approve).toBeUndefined();

    const { po } = await seedApprovedPoWithBuyer('PO-RCPT-003', 'TBSRCPT3');
    // Kể cả ép kiểu để nhét `status: 'yes'` vào input (bỏ qua TS) — service
    // vẫn PHẢI ghi 'no'. `AddReceiptInput` không còn field `status`; test
    // này pin RUNTIME behaviour, không chỉ tin vào kiểu TS lúc biên dịch.
    const r = await receiptSvc.addReceipt(
      po.id,
      { customerId: 'TBSRCPT3', amount: 2_000_000, method: 'wallet', dot: 1, status: 'yes' } as any,
      'kt1',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('setup');
    expect(r.receipt.status).toBe('no');

    // đọc lại DB, không tin giá trị trả về
    const reread = await prisma.poReceipt.findUniqueOrThrow({ where: { id: r.receipt.id } });
    expect(reread.status).toBe('no');

    // vẫn đang GIỮ — chưa có gì "nhả" nó ra được từ service này
    expect(await hold.holdAmount('TBSRCPT3')).toBe(2_000_000n);
  });

  it('receipt method=bank (BẤT KỲ status nào) KHÔNG BAO GIỜ góp vào hold', async () => {
    const { po } = await seedApprovedPoWithBuyer('PO-RCPT-004', 'TBSRCPT4');
    // addReceipt() chỉ còn sinh 'no' — dòng 'yes' phải chèn thẳng (mô phỏng
    // một trong hai luồng chốt CHƯA port, xem comment đầu file service) để
    // vẫn phủ được ca "bank/yes không góp vào hold".
    await receiptSvc.addReceipt(
      po.id,
      { customerId: 'TBSRCPT4', amount: 5_000_000, method: 'bank', dot: 1 },
      'kt1',
    );
    await seedPoReceipt({
      poId: po.id, customerId: 'TBSRCPT4', amount: 5_000_000, method: 'bank', status: 'yes', dot: 2, cdate: 1,
    });
    expect(await hold.holdAmount('TBSRCPT4')).toBe(0n);
  });

  // ⚠ F3 (review cuối #06): receiptDate đổi Int(epoch) -> DateTime @db.Date —
  // so bằng .toISOString().slice(0,10) (KHÔNG so trực tiếp đối tượng Date,
  // Prisma trả về một instance mới, và KHÔNG so .getTime() vì @db.Date không
  // giữ giờ/phút/giây, chỉ ngày).
  it('addReceipt ghi đủ các cột mở rộng (dot/receiptCode/bankRef/receiptDate/note/createdBy/cdate)', async () => {
    const { po } = await seedApprovedPoWithBuyer('PO-RCPT-005', 'TBSRCPT5');
    const r = await receiptSvc.addReceipt(
      po.id,
      {
        customerId: 'TBSRCPT5',
        amount: 1_000_000,
        method: 'bank',
        dot: 2,
        receiptCode: 'PT-001',
        bankRef: 'REF123',
        receiptDate: new Date('2023-11-15'),
        note: 'Thu đợt 2 qua chuyển khoản',
      },
      'kt1',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('setup');
    expect(r.receipt.status).toBe('no'); // mặc định, không cách nào truyền khác
    expect(r.receipt.poId).toBe(po.id);
    expect(r.receipt.dot).toBe(2);
    expect(r.receipt.receiptCode).toBe('PT-001');
    expect(r.receipt.bankRef).toBe('REF123');
    expect(r.receipt.receiptDate?.toISOString().slice(0, 10)).toBe('2023-11-15');
    expect(r.receipt.note).toBe('Thu đợt 2 qua chuyển khoản');
    expect(r.receipt.createdBy).toBe('kt1');
    expect(r.receipt.cdate).not.toBeNull();
  });

  it('listByPo trả đúng phiếu thu của TỪNG PO, không lẫn PO khác', async () => {
    const cus = await seedCustomer('TBSRCPT6');
    const poA = await seedPo('PO-RCPT-006A', { status: PoStatus.DA_DUYET, buyerId: cus.id, totalAmount: 10_000_000 });
    const poB = await seedPo('PO-RCPT-006B', { status: PoStatus.DA_DUYET, buyerId: cus.id, totalAmount: 10_000_000 });
    await receiptSvc.addReceipt(poA.id, { customerId: 'TBSRCPT6', amount: 100, method: 'bank', dot: 1 }, 'kt1');
    await receiptSvc.addReceipt(poA.id, { customerId: 'TBSRCPT6', amount: 200, method: 'bank', dot: 2 }, 'kt1');
    await receiptSvc.addReceipt(poB.id, { customerId: 'TBSRCPT6', amount: 999, method: 'bank', dot: 1 }, 'kt1');

    const list = await receiptSvc.listByPo(poA.id);
    expect(list).toHaveLength(2);
    expect(list.map((x) => Number(x.amount))).toEqual([100, 200]);
    expect(list.every((x) => x.poId === poA.id)).toBe(true);
  });

  describe('3 chốt chặn của addReceipt (đều phải từ chối VÀ không ghi dòng nào)', () => {
    it('chốt 1: PO chưa duyệt đủ 2 cấp -> từ chối, không ghi phiếu', async () => {
      const cus = await seedCustomer('TBSRCPT7');
      const po = await seedPo('PO-RCPT-007', { status: PoStatus.CHO_TPKD, buyerId: cus.id, totalAmount: 10_000_000 });

      const r = await receiptSvc.addReceipt(
        po.id,
        { customerId: 'TBSRCPT7', amount: 1_000_000, method: 'wallet', dot: 1 },
        'kt1',
      );
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error('setup');
      expect(r.msg).toMatch(/duyệt/);

      const list = await receiptSvc.listByPo(po.id);
      expect(list).toHaveLength(0);
    });

    it('chốt 2a: PO chưa gắn buyer (buyerId null) -> từ chối, không ghi phiếu', async () => {
      const po = await seedPo('PO-RCPT-008', { status: PoStatus.DA_DUYET, buyerId: null, totalAmount: 10_000_000 });

      const r = await receiptSvc.addReceipt(
        po.id,
        { customerId: 'TBSRCPT8', amount: 1_000_000, method: 'wallet', dot: 1 },
        'kt1',
      );
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error('setup');
      expect(r.msg).toMatch(/khách mua/);

      const list = await receiptSvc.listByPo(po.id);
      expect(list).toHaveLength(0);
    });

    it('chốt 2b: customerId trên phiếu KHÁC buyer thật của PO -> từ chối (chặn giữ nhầm ví khách B vào PO khách A)', async () => {
      const buyerA = await seedCustomer('TBSRCPT9A');
      await seedCustomer('TBSRCPT9B');
      const po = await seedPo('PO-RCPT-009', { status: PoStatus.DA_DUYET, buyerId: buyerA.id, totalAmount: 10_000_000 });

      const r = await receiptSvc.addReceipt(
        po.id,
        { customerId: 'TBSRCPT9B', amount: 1_000_000, method: 'wallet', dot: 1 },
        'kt1',
      );
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error('setup');
      expect(r.msg).toMatch(/không khớp/);

      const list = await receiptSvc.listByPo(po.id);
      expect(list).toHaveLength(0);
      // ví khách A KHÔNG bị giữ tiền nhầm
      expect(await hold.holdAmount('TBSRCPT9A')).toBe(0n);
      expect(await hold.holdAmount('TBSRCPT9B')).toBe(0n);
    });

    it('chốt 3: thu vượt tổng PO (kể cả dung sai 1đ) -> từ chối, không ghi phiếu; trong dung sai thì CHO qua', async () => {
      const { po } = await seedApprovedPoWithBuyer('PO-RCPT-010', 'TBSRCPT10', 1_000_000);
      // đã CHỐT 999_999đ (status='yes', chèn thẳng — mô phỏng luồng chốt CHƯA
      // port) -> còn dư đúng 1đ + dung sai 1đ = 2đ có thể nhận thêm.
      await seedPoReceipt({
        poId: po.id, customerId: 'TBSRCPT10', amount: 999_999, method: 'bank', status: 'yes', dot: 1, cdate: 1,
      });

      // vượt: 999_999 + 3 = 1_000_002 > 1_000_000 + 1 -> từ chối
      const tooMuch = await receiptSvc.addReceipt(
        po.id,
        { customerId: 'TBSRCPT10', amount: 3, method: 'wallet', dot: 2 },
        'kt1',
      );
      expect(tooMuch.ok).toBe(false);
      if (tooMuch.ok) throw new Error('setup');
      expect(tooMuch.msg).toMatch(/vượt/);
      // không ghi dòng nào cho lần bị từ chối này
      expect(await receiptSvc.listByPo(po.id)).toHaveLength(1); // chỉ còn dòng seed 'yes'

      // trong dung sai: 999_999 + 2 = 1_000_001 = tổng + 1đ -> CHO qua
      const withinTolerance = await receiptSvc.addReceipt(
        po.id,
        { customerId: 'TBSRCPT10', amount: 2, method: 'wallet', dot: 2 },
        'kt1',
      );
      expect(withinTolerance.ok).toBe(true);
      expect(await receiptSvc.listByPo(po.id)).toHaveLength(2);
    });
  });

  describe('sumCollected / sumPending — 2 phép đọc "tiến độ thu" (không ai đọc trước Task này ngoài HoldService)', () => {
    it('cộng đúng theo status, bỏ qua method (bank lẫn wallet đều tính)', async () => {
      const { po } = await seedApprovedPoWithBuyer('PO-RCPT-011', 'TBSRCPT11', 100_000_000);
      await seedPoReceipt({ poId: po.id, customerId: 'TBSRCPT11', amount: 1_000_000, method: 'bank', status: 'yes', dot: 1, cdate: 1 });
      await seedPoReceipt({ poId: po.id, customerId: 'TBSRCPT11', amount: 2_000_000, method: 'wallet', status: 'yes', dot: 2, cdate: 1 });
      await seedPoReceipt({ poId: po.id, customerId: 'TBSRCPT11', amount: 500_000, method: 'bank', status: 'no', dot: 3, cdate: 1 });
      await seedPoReceipt({ poId: po.id, customerId: 'TBSRCPT11', amount: 700_000, method: 'wallet', status: 'no', dot: 4, cdate: 1 });

      expect(await receiptSvc.sumCollected(po.id)).toBe(3_000_000); // 1tr + 2tr, status='yes'
      expect(await receiptSvc.sumPending(po.id)).toBe(1_200_000); // 500k + 700k, status='no'
    });

    it('PO không có phiếu thu nào -> cả hai trả về 0', async () => {
      const { po } = await seedApprovedPoWithBuyer('PO-RCPT-012', 'TBSRCPT12');
      expect(await receiptSvc.sumCollected(po.id)).toBe(0);
      expect(await receiptSvc.sumPending(po.id)).toBe(0);
    });

    it('không lẫn PO khác', async () => {
      const cus = await seedCustomer('TBSRCPT13');
      const poA = await seedPo('PO-RCPT-013A', { status: PoStatus.DA_DUYET, buyerId: cus.id, totalAmount: 10_000_000 });
      const poB = await seedPo('PO-RCPT-013B', { status: PoStatus.DA_DUYET, buyerId: cus.id, totalAmount: 10_000_000 });
      await seedPoReceipt({ poId: poA.id, customerId: 'TBSRCPT13', amount: 1_000_000, method: 'bank', status: 'yes', dot: 1, cdate: 1 });
      await seedPoReceipt({ poId: poB.id, customerId: 'TBSRCPT13', amount: 9_999_999, method: 'bank', status: 'yes', dot: 1, cdate: 1 });

      expect(await receiptSvc.sumCollected(poA.id)).toBe(1_000_000);
      expect(await receiptSvc.sumCollected(poB.id)).toBe(9_999_999);
    });
  });
});
