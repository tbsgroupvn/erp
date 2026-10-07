// test/po/order-gen-gates.spec.ts — review cuối #06 đợt 2, I-2 + M-3:
// `OrderGenService.generateOrdersForPo`, port `ajaxs/po/process_gen_orders.php`
// (prod, đọc read-only 24/09/2026). Mọi cổng có ca TỪ CHỐI kèm ca ĐỐI CHỨNG
// (cùng PO, điều kiện cổng được thoả ⇒ đi qua) — một service từ chối TẤT CẢ
// không thể xanh bộ này. Một `expect` cho mỗi `it`. Dữ liệu tiền tố ZZPO2_.
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db';
import { resetPo, seedOrder, seedPo, seedPoItem, seedPoSuborder } from '../helpers/po-db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { resetQuote } from '../helpers/quote-db';
import { SuborderService } from '../../src/po/suborder.service';
import {
  GEN_ORDERS_MSG, GenOrdersResult, OrderGenService, sanitizeNotesMap,
} from '../../src/po/order-gen.service';
import { PoStatus } from '../../src/po/po.constants';

// ── Móc (hook) vào client Prisma: bọc `<model>.<method>` bằng một hàm chạy
// TRƯỚC lệnh thật, xuyên qua cả `$transaction` (tx client cũng được bọc). Dùng
// để ép một va chạm GIỮA vòng lặp / một lượt gọi song song ĐÚNG thời điểm,
// thay vì trông vào may rủi của lịch chạy.
type Hooks = Record<string, (callNo: number) => Promise<void>>;
function hooked(client: any, hooks: Hooks): any {
  const counts: Record<string, number> = {};
  const wrapDelegate = (model: string, d: any) =>
    new Proxy(d, {
      get(t, k) {
        const key = `${model}.${String(k)}`;
        const v = Reflect.get(t, k);
        if (hooks[key] && typeof v === 'function') {
          return async (...args: unknown[]) => {
            counts[key] = (counts[key] ?? 0) + 1;
            await hooks[key](counts[key]);
            return v.apply(t, args);
          };
        }
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
  const wrapClient = (c: any): any =>
    new Proxy(c, {
      get(t, k) {
        if (k === '$transaction') {
          return (fn: any, opts: any) => t.$transaction((tx: any) => fn(wrapClient(tx)), opts);
        }
        const v = Reflect.get(t, k);
        if (typeof k === 'string' && Object.keys(hooks).some((h) => h.startsWith(k + '.'))) {
          return wrapDelegate(k, v);
        }
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
  return wrapClient(client);
}

function makeSvc(client: any = prisma): OrderGenService {
  return new OrderGenService(client, new SuborderService(client));
}
const svc = makeSvc();

type ItemSpec = { lineKind?: string | null; amount?: string };
async function seedApprovedPo(
  poCode: string,
  po: Partial<Prisma.PurchaseOrderUncheckedCreateInput> = {},
  items: ItemSpec[] = [{ lineKind: 'goods', amount: '100000' }],
) {
  const created = await seedPo(poCode, { status: PoStatus.DA_DUYET, ...po });
  const itemIds: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = await seedPoItem(created.id, {
      sortOrder: i + 1, amount: items[i].amount ?? '100000',
      lineKind: items[i].lineKind === undefined ? 'goods' : items[i].lineKind,
    });
    itemIds.push(it.id);
  }
  return { po: created, itemIds };
}

/** Mọi dấu vết ghi của một lượt sinh — dùng để khẳng định "từ chối = không ghi gì". */
async function footprint(poId: number) {
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  return {
    orders: await prisma.order.count({ where: { poId } }),
    suborders: await prisma.poSuborder.count({ where: { poId } }),
    suborderGenerated: po.suborderGenerated,
    ordersGenerated: po.ordersGenerated,
  };
}
const NOTHING_WRITTEN = { orders: 0, suborders: 0, suborderGenerated: 0, ordersGenerated: 0 };

const refused = (reason: keyof typeof GEN_ORDERS_MSG): GenOrdersResult =>
  ({ ok: false, reason, msg: GEN_ORDERS_MSG[reason] } as GenOrdersResult);
const generatedCount = (r: GenOrdersResult) => (r.ok && !r.already ? r.orderIds.length : -1);

beforeEach(async () => {
  await resetPo();
  await resetQuote();
  await resetMasterdata();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('I-2 — generateOrdersForPo: các cổng của process_gen_orders.php, đúng thứ tự prod', () => {
  it('cổng 0: PO không tồn tại ⇒ NOT_FOUND', async () => {
    expect(await svc.generateOrdersForPo(999999)).toEqual(refused('NOT_FOUND'));
  });

  // ── cổng 1: declares_customs ──
  it('cổng 1: declares_customs=1 ⇒ từ chối DECLARES_CUSTOMS', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0101', { declaresCustoms: 1 });
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('DECLARES_CUSTOMS'));
  });

  it('cổng 1: từ chối KHÔNG ghi gì (không đơn, không phụ lục, không cờ)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0102', { declaresCustoms: 1 });
    await svc.generateOrdersForPo(po.id);
    expect(await footprint(po.id)).toEqual(NOTHING_WRITTEN);
  });

  it('cổng 1 đối chứng: CÙNG PO với declares_customs=0 ⇒ sinh 1 đơn', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0103', { declaresCustoms: 0 });
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });

  // ── cổng 2: không có dòng hàng hoá ──
  it('cổng 2: PO TOÀN dòng fee ⇒ từ chối NO_GOODS', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0201', {}, [{ lineKind: 'fee' }, { lineKind: 'fee' }]);
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NO_GOODS'));
  });

  it('cổng 2: PO 0 dòng ⇒ cũng NO_GOODS (COUNT=0, đúng prod)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0202', {}, []);
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NO_GOODS'));
  });

  it('cổng 2 đối chứng: CÙNG PO toàn fee + THÊM 1 dòng goods ⇒ sinh đúng 1 đơn (fee bỏ qua)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0203', {}, [{ lineKind: 'fee' }, { lineKind: 'fee' }, { lineKind: 'goods' }]);
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });

  it('cổng 2: line_kind NULL tính là goods (nhất quán hàm lõi; prod cột NOT NULL DEFAULT goods)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0204', {}, [{ lineKind: null }]);
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });

  // ── cổng 3: status >= 3 ──
  it('cổng 3: status=2 (chờ TP.KD) ⇒ từ chối NOT_APPROVED', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0301', { status: PoStatus.CHO_TPKD });
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NOT_APPROVED'));
  });

  it('cổng 3: từ chối KHÔNG ghi gì', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0302', { status: PoStatus.CHO_TPKD });
    await svc.generateOrdersForPo(po.id);
    expect(await footprint(po.id)).toEqual(NOTHING_WRITTEN);
  });

  it('cổng 3: status=-1 (Huỷ) ⇒ NOT_APPROVED', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0303', { status: PoStatus.HUY });
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NOT_APPROVED'));
  });

  it('cổng 3 đối chứng: CÙNG PO ở status=3 (biên) ⇒ sinh 1 đơn', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0304', { status: PoStatus.DA_DUYET });
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });

  // ── cổng 4: orders_generated ──
  it('cổng 4: orders_generated=1 ⇒ THÀNH CÔNG already, trả id đơn cũ (po_id, order_type=1, po_item_id>0, ORDER BY id)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0401', { ordersGenerated: 1 });
    const a = await seedOrder({ poId: po.id, orderType: 1, poItemId: 90001 });
    await seedOrder({ poId: po.id, orderType: 1, poItemId: 0 }); // legacy po_item_id=0 — loại
    await seedOrder({ poId: po.id, orderType: 0, poItemId: 90004 }); // order_type≠1 dù po_item_id>0 — loại
    await seedOrder({ poId: po.id + 1000, orderType: 1, poItemId: 90002 }); // PO khác — loại
    const b = await seedOrder({ poId: po.id, orderType: 1, poItemId: 90003 });
    expect(await svc.generateOrdersForPo(po.id)).toEqual({
      ok: true, already: true, orderIds: [a.id, b.id], msg: 'PO này đã sinh đơn hàng rồi (2 đơn).',
    });
  });

  it('cổng 4: orders_generated=1 ⇒ KHÔNG sinh đơn cho dòng goods chưa có đơn', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0402', { ordersGenerated: 1 });
    await svc.generateOrdersForPo(po.id);
    expect(await prisma.order.count({ where: { poId: po.id } })).toBe(0);
  });

  it('cổng 4 đối chứng: CÙNG PO với orders_generated=0 ⇒ sinh 1 đơn', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0403', { ordersGenerated: 0 });
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });

  // ── THỨ TỰ cổng (quyết định thông báo người dùng thấy) ──
  it('thứ tự: declares_customs=1 VÀ toàn fee VÀ status=0 ⇒ DECLARES_CUSTOMS (cổng 1 trước hết)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0501', { declaresCustoms: 1, status: 0 }, [{ lineKind: 'fee' }]);
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('DECLARES_CUSTOMS'));
  });

  it('thứ tự: toàn fee VÀ status=0 ⇒ NO_GOODS (cổng 2 trước cổng 3)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0502', { status: 0 }, [{ lineKind: 'fee' }]);
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NO_GOODS'));
  });

  it('thứ tự: status=0 VÀ orders_generated=1 ⇒ NOT_APPROVED (cổng 3 trước cổng 4)', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0503', { status: 0, ordersGenerated: 1 });
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NOT_APPROVED'));
  });
});

describe('I-2 — điều phối toàn PO: lặp MỌI phụ lục, tự tách phụ lục, đặt cờ', () => {
  it('lặp MỌI phụ lục theo (sort_order, id) — không chỉ phụ lục đầu', async () => {
    const po = await seedPo('ZZPO2_G_0601', { status: PoStatus.DA_DUYET });
    const subLate = await seedPoSuborder(po.id, { subCode: 'ZZPO2_G_0601-Đ02', sortOrder: 2 });
    const subEarly = await seedPoSuborder(po.id, { subCode: 'ZZPO2_G_0601-Đ01', sortOrder: 1 });
    await seedPoItem(po.id, { suborderId: subLate.id, sortOrder: 1, amount: '1', lineKind: 'goods' });
    await seedPoItem(po.id, { suborderId: subEarly.id, sortOrder: 1, amount: '2', lineKind: 'goods' });
    await seedPoItem(po.id, { suborderId: subEarly.id, sortOrder: 2, amount: '3', lineKind: 'goods' });
    const r = await svc.generateOrdersForPo(po.id);
    const ids = r.ok ? r.orderIds : [];
    const codes = await Promise.all(ids.map(async (id) => (await prisma.order.findUniqueOrThrow({ where: { id } })).codeOrder));
    expect(codes).toEqual(['ZZPO2_G_0601-Đ01-01', 'ZZPO2_G_0601-Đ01-02', 'ZZPO2_G_0601-Đ02-01']);
  });

  it('PO chưa có phụ lục ⇒ tự tách <po_code>-Đ01 rồi sinh đơn từ nó', async () => {
    const { po, itemIds } = await seedApprovedPo('ZZPO2_G_0602');
    await svc.generateOrdersForPo(po.id);
    const o = await prisma.order.findFirstOrThrow({ where: { poItemId: itemIds[0], orderType: 1 } });
    expect(o.codeOrder).toBe('ZZPO2_G_0602-Đ01-01');
  });

  it('thành công ⇒ orders_generated = 1', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0603');
    await svc.generateOrdersForPo(po.id);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).ordersGenerated).toBe(1);
  });

  it('gọi lần hai ⇒ already với ĐÚNG id lần đầu', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0604', {}, [{ lineKind: 'goods' }, { lineKind: 'goods' }]);
    const first = await svc.generateOrdersForPo(po.id);
    const second = await svc.generateOrdersForPo(po.id);
    expect(second).toEqual({
      ok: true, already: true, orderIds: first.ok ? first.orderIds : ['x'], msg: 'PO này đã sinh đơn hàng rồi (2 đơn).',
    });
  });

  it('NO_SUBORDER: chưa có phụ lục mà suborder_generated=1 (tự tách bị chặn) ⇒ từ chối', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0605', { suborderGenerated: 1 });
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NO_SUBORDER'));
  });

  it('NO_SUBORDER đối chứng: CÙNG PO với suborder_generated=0 ⇒ sinh 1 đơn', async () => {
    const { po } = await seedApprovedPo('ZZPO2_G_0606', { suborderGenerated: 0 });
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });

  it('NOTHING_GENERATED: phụ lục chỉ chứa dòng fee, dòng goods chưa gán phụ lục ⇒ từ chối', async () => {
    const po = await seedPo('ZZPO2_G_0607', { status: PoStatus.DA_DUYET });
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_G_0607-Đ01' });
    await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, lineKind: 'fee' });
    await seedPoItem(po.id, { suborderId: 0, sortOrder: 2, lineKind: 'goods' });
    expect(await svc.generateOrdersForPo(po.id)).toEqual(refused('NOTHING_GENERATED'));
  });

  it('NOTHING_GENERATED: cờ orders_generated KHÔNG được đặt', async () => {
    const po = await seedPo('ZZPO2_G_0608', { status: PoStatus.DA_DUYET });
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_G_0608-Đ01' });
    await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, lineKind: 'fee' });
    await seedPoItem(po.id, { suborderId: 0, sortOrder: 2, lineKind: 'goods' });
    await svc.generateOrdersForPo(po.id);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).ordersGenerated).toBe(0);
  });

  it('NOTHING_GENERATED đối chứng: CÙNG dữ liệu nhưng dòng goods ĐÃ gán phụ lục ⇒ sinh 1 đơn', async () => {
    const po = await seedPo('ZZPO2_G_0609', { status: PoStatus.DA_DUYET });
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_G_0609-Đ01' });
    await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, lineKind: 'fee' });
    await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 2, lineKind: 'goods' });
    expect(generatedCount(await svc.generateOrdersForPo(po.id))).toBe(1);
  });
});

describe('I-2 — ghi chú tay (notesMap) làm sạch y prod', () => {
  it('sanitizeNotesMap: key phải >0, value trim khác rỗng', () => {
    expect(sanitizeNotesMap({ '0': 'a', '-1': 'b', abc: 'c', '7': '   ', '8': '  x  ' })).toEqual({ 8: 'x' });
  });

  // 'a' + emoji: cắt theo đơn vị UTF-16 rơi ĐÚNG ranh giới cặp (1+254=255) ⇒
  // ra chuỗi hợp lệ nhưng chỉ 128 ký tự — so GIÁ TRỊ bắt được, không nhờ lỗi CSDL.
  it('ghi chú cắt 255 KÝ TỰ (mb_substr, code point) — "a"+300 emoji ⇒ "a"+254 emoji', async () => {
    const { po, itemIds } = await seedApprovedPo('ZZPO2_G_0701');
    await svc.generateOrdersForPo(po.id, { [itemIds[0]]: 'a' + '😀'.repeat(300) });
    const o = await prisma.order.findFirstOrThrow({ where: { poItemId: itemIds[0], orderType: 1 } });
    expect(o.notes).toBe('a' + '😀'.repeat(254));
  });

  it('đối chứng: ghi chú 255 ký tự giữ NGUYÊN', async () => {
    const { po, itemIds } = await seedApprovedPo('ZZPO2_G_0702');
    await svc.generateOrdersForPo(po.id, { [itemIds[0]]: 'ă'.repeat(255) });
    const o = await prisma.order.findFirstOrThrow({ where: { poItemId: itemIds[0], orderType: 1 } });
    expect(o.notes).toBe('ă'.repeat(255));
  });
});

describe('I-2 — thông báo từ chối không lộ chi tiết nội bộ', () => {
  it('không thông báo nào chứa tên bảng/cột, lỗi Prisma/CSDL', () => {
    const leaky = /prisma|tbl_|_id\b|declares_customs|orders_generated|suborder_generated|line_kind|status\s*[<>=]|unique|constraint|P20\d\d|sql/i;
    expect(Object.values(GEN_ORDERS_MSG).filter((m) => leaky.test(m))).toEqual([]);
  });
});

// ═══ M-3 — va chạm GIỮA vòng lặp: không được để lại bộ đơn DỞ ═══
// Ép đúng kịch bản review mô tả: lượt sinh đã INSERT đơn cho dòng 1, rồi một
// đường ghi KHÁC (không qua khoá PO — giả lập bằng client ngoài, tự commit)
// chen một đơn cho dòng 2 vào GIỮA bước kiểm và bước INSERT của dòng 2 ⇒
// INSERT dòng 2 đụng partial unique index (P2002).
async function runMidLoopCollision(poCode: string, collide: boolean) {
  const { po, itemIds } = await seedApprovedPo(poCode, {}, [{ lineKind: 'goods' }, { lineKind: 'goods' }]);
  let injectedAtCreate = 0;
  const client = hooked(prisma, {
    'order.create': async (n) => {
      if (collide && n === 2) {
        injectedAtCreate = n;
        await prisma.order.create({ data: { poItemId: itemIds[1], orderType: 1, supplierCostRmb: 0, codeOrder: 'ZZPO2_INJECTED' } });
      }
    },
  });
  const res = await makeSvc(client).generateOrdersForPo(po.id);
  return { po, res, injectedAtCreate };
}

describe('M-3 — va chạm giữa vòng lặp ⇒ rollback TRỌN, kết quả xác định', () => {
  it('tiền đề: va chạm thật sự xảy ra ở lệnh INSERT thứ 2 (sau khi dòng 1 đã INSERT)', async () => {
    const r = await runMidLoopCollision('ZZPO2_G_0801', true);
    expect(r.injectedAtCreate).toBe(2);
  });

  it('người thua nhận từ chối CONFLICT, thông báo không lộ lỗi CSDL', async () => {
    const r = await runMidLoopCollision('ZZPO2_G_0802', true);
    expect(r.res).toEqual(refused('CONFLICT'));
  });

  it('KHÔNG còn đơn mồ côi nào của PO (đơn dòng 1 đã rollback)', async () => {
    const r = await runMidLoopCollision('ZZPO2_G_0803', true);
    expect(await prisma.order.count({ where: { poId: r.po.id } })).toBe(0);
  });

  it('phụ lục tự tách + cờ cũng rollback (không phụ lục, không cờ)', async () => {
    const r = await runMidLoopCollision('ZZPO2_G_0804', true);
    expect(await footprint(r.po.id)).toEqual(NOTHING_WRITTEN);
  });

  it('đối chứng: CÙNG kịch bản, móc không chen gì ⇒ sinh đủ 2 đơn', async () => {
    const r = await runMidLoopCollision('ZZPO2_G_0805', false);
    expect(generatedCount(r.res)).toBe(2);
  });
});

// ═══ M-3 — hai lượt gọi song song CÙNG PO: người thua CHỜ khoá rồi nhận 'already' ═══
// A giữ khoá dòng PO; ngay sau INSERT đầu tiên của A, móc khởi động B rồi chờ
// B đọc được PO (tối đa 1,5s). Có khoá: B kẹt ở FOR UPDATE, không đọc được ⇒ A
// hết chờ, commit ⇒ B đọc lại thấy orders_generated=1 ⇒ 'already', cùng id.
// Không khoá: B đọc PO ngay (cờ còn 0) và chạy song song với A ⇒ B không bao
// giờ ra 'already' (hoặc CONFLICT, hoặc tự coi là lượt sinh).
async function runConcurrentPair(poCode: string) {
  const po = await seedPo(poCode, { status: PoStatus.DA_DUYET });
  const sub = await seedPoSuborder(po.id, { subCode: `${poCode}-Đ01` });
  await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, lineKind: 'goods' });
  await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 2, lineKind: 'goods' });

  let signalBReadPo!: () => void;
  const bReadPo = new Promise<void>((res) => { signalBReadPo = res; });
  const svcB = makeSvc(hooked(prisma, {
    'purchaseOrder.findUnique': async () => { signalBReadPo(); },
  }));
  let pB: Promise<GenOrdersResult> | null = null;
  const svcA = makeSvc(hooked(prisma, {
    'order.create': async (n) => {
      if (n !== 1) return;
      pB = svcB.generateOrdersForPo(po.id);
      await Promise.race([bReadPo, new Promise((r) => setTimeout(r, 1500))]);
    },
  }));
  const rA = await svcA.generateOrdersForPo(po.id);
  const rB = await (pB as unknown as Promise<GenOrdersResult>);
  return { po, rA, rB };
}

describe('M-3 — hai lượt gọi song song cùng PO (khoá dòng PO)', () => {
  it('một lượt sinh, lượt kia nhận already', async () => {
    const { rA, rB } = await runConcurrentPair('ZZPO2_G_0901');
    expect([rA.ok && rA.already, rB.ok && rB.already]).toEqual([false, true]);
  });

  it('lượt thua nhận ĐÚNG các id lượt thắng đã sinh', async () => {
    const { rA, rB } = await runConcurrentPair('ZZPO2_G_0902');
    expect(rB.ok ? rB.orderIds : null).toEqual(rA.ok ? rA.orderIds : 'A failed');
  });

  it('CSDL chỉ có đúng 2 đơn cho PO', async () => {
    const { po } = await runConcurrentPair('ZZPO2_G_0903');
    expect(await prisma.order.count({ where: { poId: po.id } })).toBe(2);
  });
});
