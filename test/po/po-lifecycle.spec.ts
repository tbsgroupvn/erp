import { Logger } from '@nestjs/common';
import { prisma, resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { resetPo, seedPo } from '../helpers/po-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { PoService } from '../../src/po/po.service';
import { PoStatus, statusLabel } from '../../src/po/po.constants';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const svc = new PoService(prisma as any, scope);

// Không dùng seedRole dùng chung (nó tách permCode bằng dấu '.' để suy module/
// action) — 'po_view' không có dấu chấm nên tách hỏng. tbl_role_perm không có
// FK sang tbl_perm nên bỏ qua bước tạo permission, tạo thẳng role + rolePermission.
// Mirror test/masterdata/customer-scope.spec.ts / test/quote/quote-service.spec.ts.
let seq = 0;
async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: `r${uid}_${code}_${sc}_${seq++}`, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

/** Khách hàng dùng làm `buyerId` cho createPo() — mã PO (từ Fix round) cần
 *  `customer.code` hợp lệ, nên mọi test PHẢI seed một Customer trước. */
async function seedBuyer(code: string) {
  const c = await seedCustomer(code, 'sale1');
  return c.id;
}

describe('PoService — vòng đời tuần tự (Task 2 #06)', () => {
  beforeEach(async () => {
    await resetIam();
    perm.clearCache();
    await resetMasterdata();
    await resetPo();
  });
  afterAll(() => prisma.$disconnect());

  it('happy path 0->1->2->3 qua submit/leaderApprove/tpkdApprove, đọc lại DB mỗi bước', async () => {
    const buyerId = await seedBuyer('TBS9101');
    const created = await svc.createPo({ buyerId }, 'sale1');
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('setup');
    const id = created.po.id;
    expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.NHAP);

    const r1 = await svc.submit(id, 'sale1');
    expect(r1.ok).toBe(true);
    expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.CHO_LEADER);

    const r2 = await svc.leaderApprove(id, 'leader1');
    expect(r2.ok).toBe(true);
    expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.CHO_TPKD);

    const r3 = await svc.tpkdApprove(id, 'tpkd1');
    expect(r3.ok).toBe(true);
    expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.DA_DUYET);
  });

  it('nhảy cóc bị TỪ CHỐI: tpkdApprove khi PO còn ở 0, trạng thái lưu KHÔNG đổi', async () => {
    const buyerId = await seedBuyer('TBS9102');
    const created = await svc.createPo({ buyerId }, 'sale1');
    if (!created.ok) throw new Error('setup');
    const id = created.po.id;

    const r = await svc.tpkdApprove(id, 'tpkd1');
    expect(r.ok).toBe(false);

    // đọc lại DB, không tin mỗi giá trị trả về
    const row = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(row!.status).toBe(PoStatus.NHAP);
  });

  it('nhảy cóc bị TỪ CHỐI: leaderApprove khi PO còn ở 0', async () => {
    const buyerId = await seedBuyer('TBS9103');
    const created = await svc.createPo({ buyerId }, 'sale1');
    if (!created.ok) throw new Error('setup');
    const id = created.po.id;

    const r = await svc.leaderApprove(id, 'leader1');
    expect(r.ok).toBe(false);
    const row = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(row!.status).toBe(PoStatus.NHAP);
  });

  it('reject từ 2 -> về 0, ghi rejectBy/rejectNote', async () => {
    const buyerId = await seedBuyer('TBS9104');
    const created = await svc.createPo({ buyerId }, 'sale1');
    if (!created.ok) throw new Error('setup');
    const id = created.po.id;
    await svc.submit(id, 'sale1');
    await svc.leaderApprove(id, 'leader1');
    expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.CHO_TPKD);

    const r = await svc.reject(id, 'thiếu chứng từ', 'tpkd1');
    expect(r.ok).toBe(true);

    const row = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(row!.status).toBe(PoStatus.NHAP);
    expect(row!.rejectNote).toBe('thiếu chứng từ');
    expect(row!.rejectBy).toBe('tpkd1');
    expect(row!.rejectAt).not.toBeNull();
  });

  // Fix round: đo prod 23/09/2026 — rejectBy được set trên PO ĐANG ở status
  // 3(72)/0(7)/1(2)/-1(3): đây là VẾT LỊCH SỬ, không phải cờ trạng thái hiện
  // tại. Một PO có thể bị từ chối rồi sau đó được duyệt lại — vết KHÔNG bị
  // xoá. Pin: leaderApprove/tpkdApprove sau một lần reject KHÔNG được xoá
  // rejectBy/rejectAt/rejectNote.
  it('vết reject SỐNG SÓT qua lần duyệt sau — không bị leaderApprove/tpkdApprove xoá', async () => {
    const buyerId = await seedBuyer('TBS9105');
    const created = await svc.createPo({ buyerId }, 'sale1');
    if (!created.ok) throw new Error('setup');
    const id = created.po.id;

    await svc.submit(id, 'sale1');
    const rej = await svc.reject(id, 'thiếu hồ sơ', 'leader1');
    expect(rej.ok).toBe(true);

    // nộp lại và duyệt trót lọt lần này
    await svc.submit(id, 'sale1');
    await svc.leaderApprove(id, 'leader1');
    await svc.tpkdApprove(id, 'tpkd1');

    const row = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(row!.status).toBe(PoStatus.DA_DUYET);
    // vết reject cũ vẫn còn nguyên
    expect(row!.rejectBy).toBe('leader1');
    expect(row!.rejectNote).toBe('thiếu hồ sơ');
    expect(row!.rejectAt).not.toBeNull();
  });

  it('cancel rồi restoreFromCancel round-trip qua trạng thái KHÁC 0 (status=3) — huỷ từ 0 không chứng minh gì', async () => {
    const buyerId = await seedBuyer('TBS9106');
    const created = await svc.createPo({ buyerId }, 'sale1');
    if (!created.ok) throw new Error('setup');
    const id = created.po.id;
    await svc.submit(id, 'sale1');
    await svc.leaderApprove(id, 'leader1');
    await svc.tpkdApprove(id, 'tpkd1');
    expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.DA_DUYET);

    const c = await svc.cancel(id, 'khách huỷ', 'admin1');
    expect(c.ok).toBe(true);
    let row = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(row!.status).toBe(PoStatus.HUY);
    expect(row!.cancelPrevStatus).toBe(PoStatus.DA_DUYET);
    expect(row!.cancelNote).toBe('khách huỷ');
    expect(row!.cancelBy).toBe('admin1');

    const rest = await svc.restoreFromCancel(id, 'admin1');
    expect(rest.ok).toBe(true);
    row = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(row!.status).toBe(PoStatus.DA_DUYET);
  });

  // ═══ F8 (review cuối #06) — check-then-act race, ĐÃ VÁ nguyên tử ═══════
  describe('F8 — chuyển trạng thái đồng thời (check-then-act race, đã vá)', () => {
    // Ca DỄ pin nhất: HAI người dùng cùng bấm "duyệt Leader" cho CÙNG một PO
    // gần như cùng lúc (`leaderApprove` chỉ hợp lệ từ CHO_LEADER=1, đi tới
    // ĐÚNG một đích CHO_TPKD=2) — chạy thật sự song song bằng Promise.all.
    // ⚠ ĐÃ THỬ dùng `leaderApprove` + `reject` làm cặp "xung đột" ở đây
    // trước, nhưng đó KHÔNG phải một cặp loại-trừ-lẫn-nhau thật: `reject`
    // hợp lệ từ CẢ CHO_LEADER(1) LẪN CHO_TPKD(2), nên nếu `leaderApprove`
    // thắng trước (1->2), `reject` vẫn hợp lệ tiếp theo (2 nằm trong tập
    // from của nó) và ĐÚNG ĐẮN áp dụng tiếp — không phải bug, là một chuỗi
    // hợp lệ. Cặp DƯỚI ĐÂY mới thật sự loại-trừ-lẫn-nhau: cả hai đều CHỈ
    // chấp nhận from=1 và CÙNG đưa PO ra khỏi 1 — không có cách nào cả hai
    // cùng khớp WHERE tại thời điểm Postgres thực thi UPDATE.
    //
    // Trước bản vá (findUnique rồi update rời nhau): CẢ HAI có thể cùng đọc
    // thấy status=1, cùng qua guard, cùng ghi -> ai ghi SAU thắng, người ghi
    // TRƯỚC coi như chưa từng xảy ra dù đã trả `{ok:true}`. Sau vá
    // (`updateMany` nguyên tử theo WHERE status=from): CHỈ MỘT trong hai có
    // thể khớp WHERE -> chính xác MỘT `{ok:true}`, một `{ok:false}`, KHÔNG
    // BAO GIỜ cả hai cùng true.
    it('⚠⚠⚠ hai leaderApprove ĐỒNG THỜI (2 người cùng bấm duyệt) từ status=1 ⇒ đúng MỘT thành công, trạng thái cuối khớp với đúng MỘT người', async () => {
      const buyerId = await seedBuyer('TBS9111');
      const created = await svc.createPo({ buyerId }, 'sale1');
      if (!created.ok) throw new Error('setup');
      const id = created.po.id;
      await svc.submit(id, 'sale1');
      expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.CHO_LEADER);

      const [r1, r2] = await Promise.all([
        svc.leaderApprove(id, 'leader1'),
        svc.leaderApprove(id, 'leader2'),
      ]);

      // Đúng MỘT trong hai thành công — KHÔNG BAO GIỜ cả hai, KHÔNG BAO GIỜ
      // không ai (PO đang ở 1, đúng một trong hai chắc chắn khớp guard).
      const oks = [r1.ok, r2.ok].filter(Boolean);
      expect(oks).toHaveLength(1);

      const row = await prisma.purchaseOrder.findUnique({ where: { id } });
      expect(row!.status).toBe(PoStatus.CHO_TPKD); // luôn tiến đúng MỘT bước, không nhảy cóc, không đứng yên
      // leaderBy PHẢI khớp ĐÚNG người mà kết quả ok:true báo — người thua
      // KHÔNG được để lại dấu vết (nếu cả hai lỡ ghi được thì leaderBy sẽ là
      // của người ghi SAU CÙNG bất kể ai báo ok:true, lộ ra đã ghi đè).
      const winner = r1.ok ? 'leader1' : 'leader2';
      expect(row!.leaderBy).toBe(winner);
    });

    // Ca NÊU TRONG FINDING — kịch bản thật đã cắn: submit (0->1) và cancel
    // (hợp lệ từ MỌI trạng thái khác Huỷ, không có `from` cố định để đặt vào
    // WHERE — xem comment `cancel()`) chạy đồng thời từ status=0.
    //
    // KHÁC ca trên: `cancel` không có một `from` cố định nên không thể đảm
    // bảo "đúng một trong hai {ok:true}" theo nghĩa hẹp — `cancel` hợp lệ dù
    // `submit` đã thắng trước (huỷ một PO VỪA được nộp vẫn là thao tác hợp
    // lệ). Bất biến ĐÚNG cần giữ (đúng câu chữ finding): "never a state
    // where both appear to have applied" theo nghĩa cancelPrevStatus KHÔNG
    // BAO GIỜ được là một ảnh chụp CŨ/SAI — nó phải luôn khớp ĐÚNG những gì
    // `submit` thật sự đã làm, để `restoreFromCancel` sau đó không bao giờ
    // xoá âm thầm một submit đã thành công (đúng bug gốc F8 mô tả).
    it('⚠⚠⚠ submit và cancel chạy ĐỒNG THỜI từ status=0 ⇒ cancelPrevStatus KHÔNG BAO GIỜ là ảnh chụp cũ/sai — restoreFromCancel sau đó không xoá âm thầm một submit đã thành công', async () => {
      const buyerId = await seedBuyer('TBS9112');
      const created = await svc.createPo({ buyerId }, 'sale1');
      if (!created.ok) throw new Error('setup');
      const id = created.po.id;
      expect((await prisma.purchaseOrder.findUnique({ where: { id } }))!.status).toBe(PoStatus.NHAP);

      const [submitResult, cancelResult] = await Promise.all([
        svc.submit(id, 'sale1'),
        svc.cancel(id, 'khách huỷ gấp', 'admin1'),
      ]);

      // cancel hợp lệ từ MỌI trạng thái khác Huỷ nên LUÔN thành công trong
      // kịch bản này (dù submit thắng trước hay thua) — pin tiền đề trước
      // khi kiểm bất biến chính.
      expect(cancelResult.ok).toBe(true);

      const row = await prisma.purchaseOrder.findUnique({ where: { id } });
      expect(row!.status).toBe(PoStatus.HUY); // cancel luôn là lệnh SAU CÙNG áp dụng trong kịch bản này

      // ⚠⚠⚠ BẤT BIẾN CHÍNH — đây là ca F8 tồn tại để bắt:
      if (submitResult.ok) {
        // submit đã thật sự thắng (chạy/commit trước cancel) -> DB PHẢI ghi
        // nhận PO từng ở CHO_LEADER=1 trước khi bị huỷ. Bug cũ (check-then-
        // act): cancel có thể đọc trạng thái CŨ (0) từ TRƯỚC khi submit chạy
        // và ghi cancelPrevStatus=0 dù submit đã thắng -> restoreFromCancel
        // sau đó đưa PO về 0, XOÁ ÂM THẦM việc submit vừa làm. Assertion này
        // sập bẫy chính xác ca đó.
        expect(row!.cancelPrevStatus).toBe(PoStatus.CHO_LEADER);
        expect(row!.submittedBy).toBe('sale1'); // vết submit vẫn còn, không bị xoá

        const rest = await svc.restoreFromCancel(id, 'admin1');
        expect(rest.ok).toBe(true);
        const restored = await prisma.purchaseOrder.findUnique({ where: { id } });
        expect(restored!.status).toBe(PoStatus.CHO_LEADER); // KHÔNG về 0 — submit không bị mất
      } else {
        // cancel thắng trước (chạy/commit khi PO còn ở NHAP=0) -> submit
        // chạy SAU chỉ còn thấy status=-1, KHÔNG khớp guard (from=0) -> bị
        // từ chối đúng, KHÔNG để lại dấu vết.
        expect(row!.cancelPrevStatus).toBe(PoStatus.NHAP);
        expect(row!.submittedBy).toBeNull();

        const rest = await svc.restoreFromCancel(id, 'admin1');
        expect(rest.ok).toBe(true);
        const restored = await prisma.purchaseOrder.findUnique({ where: { id } });
        expect(restored!.status).toBe(PoStatus.NHAP);
      }
    });
  });

  it('restoreFromCancel từ chối khi PO không đang ở trạng thái Huỷ', async () => {
    const buyerId = await seedBuyer('TBS9107');
    const created = await svc.createPo({ buyerId }, 'sale1');
    if (!created.ok) throw new Error('setup');
    const r = await svc.restoreFromCancel(created.po.id, 'admin1');
    expect(r.ok).toBe(false);
  });

  describe('listForUser — phạm vi xem (#01 ScopeService.buildDocScope)', () => {
    it('chủ sở hữu thấy PO của mình, người khác không thấy', async () => {
      const u1 = await seedUser({ username: 'sale1' });
      const u2 = await seedUser({ username: 'sale2' });
      await grant(u1.id, 'po_view', 'own');
      await grant(u2.id, 'po_view', 'own');

      const buyerId = await seedBuyer('TBS9108');
      const created = await svc.createPo({ buyerId }, 'sale1');
      if (!created.ok) throw new Error('setup');

      const rows1 = await svc.listForUser('po_view', u1.id);
      expect(rows1.map((r) => r.id)).toContain(created.po.id);

      const rows2 = await svc.listForUser('po_view', u2.id);
      expect(rows2.map((r) => r.id)).not.toContain(created.po.id);
    });

    it('quyền lạ -> rỗng (fail-closed)', async () => {
      const u1 = await seedUser({ username: 'sale3' });
      const buyerId = await seedBuyer('TBS9109');
      const created = await svc.createPo({ buyerId }, 'sale3');
      expect(created.ok).toBe(true);

      const rows = await svc.listForUser('perm_khong_ton_tai', u1.id);
      expect(rows).toHaveLength(0);
    });

    // Lỗ nền #01 vá 23/09/2026 (đã cắn CustomerService + QuoteService): scope
    // 'warehouse' trên chứng từ KHÔNG có cột kho phải trả RỖNG, không được
    // ném PrismaClientValidationError.
    it('⚠⚠ scope warehouse (PO không có cột kho) -> fail-closed [], KHÔNG throw', async () => {
      const u1 = await seedUser({ username: 'wh1' });
      await grant(u1.id, 'po_view', 'warehouse');
      await prisma.userScope.create({ data: { userId: u1.id, loai: 'warehouse', giaTri: 'KHO_HN' } });
      const buyerId = await seedBuyer('TBS9110');
      const created = await svc.createPo({ buyerId }, 'sale1');
      expect(created.ok).toBe(true);

      await expect(svc.listForUser('po_view', u1.id)).resolves.toEqual([]);
    });
  });

  // ═══ Fix round — mã PO đúng luật đo prod 23/09/2026, đếm THEO TỪNG KHÁCH ═══
  describe('mã PO — PO<NNN>/<năm>-<mãKhách>, bộ đếm theo buyer_id (Fix round)', () => {
    it('PO đầu tiên của khách TBS984 -> PO001/<năm hiện tại>-TBS984', async () => {
      const buyerId = await seedBuyer('TBS984');
      const year = new Date().getFullYear();
      const r = await svc.createPo({ buyerId }, 'sale1');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.po.poCode).toBe(`PO001/${year}-TBS984`);
    });

    // Ca QUAN TRỌNG NHẤT: chứng minh bộ đếm là THEO TỪNG KHÁCH, không phải
    // sequence toàn cục. PO thứ hai của A -> 002; PO đầu của B (khác A) vẫn
    // là 001 dù đã có PO của A trong bảng.
    it('bộ đếm THEO TỪNG KHÁCH: PO thứ 2 của A -> 002, PO đầu của B (khác khách) vẫn -> 001', async () => {
      const year = new Date().getFullYear();
      const buyerA = await seedBuyer('TBS9201');
      const buyerB = await seedBuyer('TBS9202');

      const a1 = await svc.createPo({ buyerId: buyerA }, 'sale1');
      const a2 = await svc.createPo({ buyerId: buyerA }, 'sale1');
      const b1 = await svc.createPo({ buyerId: buyerB }, 'sale1');
      expect(a1.ok && a2.ok && b1.ok).toBe(true);
      if (!a1.ok || !a2.ok || !b1.ok) return;

      expect(a1.po.poCode).toBe(`PO001/${year}-TBS9201`);
      expect(a2.po.poCode).toBe(`PO002/${year}-TBS9201`);
      expect(b1.po.poCode).toBe(`PO001/${year}-TBS9202`); // KHÔNG phải 003
    });

    // Tolerance [-\/]: định dạng cũ (trước 23/08/2026) dùng '-' giữa số thứ
    // tự và năm. PO gần nhất của khách vẫn có thể ở dạng cũ này — đọc số thứ
    // tự phải chấp nhận CẢ HAI dấu, nhưng LUÔN phát ra dạng mới '/'.
    it('tương thích định dạng CŨ (PO007-2026-...) khi đọc số thứ tự, nhưng LUÔN phát dạng MỚI (/)', async () => {
      const buyerId = await seedBuyer('TBS9203');
      await seedPo('PO007-2026-TBS9203', { buyerId });

      const year = new Date().getFullYear();
      const r = await svc.createPo({ buyerId }, 'sale1');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.po.poCode).toBe(`PO008/${year}-TBS9203`);
    });

    // Phân kỳ CÓ CHỦ Ý so với PHP gốc: bản gốc trả mã RỖNG cho khách không có
    // code rồi để nó tự vỡ ở UNIQUE constraint khi có PO thứ hai (lỗi tiềm
    // ẩn). KHÔNG lặp lại: từ chối tạo PO ngay từ đầu.
    it('khách KHÔNG có code -> createPo từ chối {ok:false}, KHÔNG ghi dòng nào', async () => {
      const noCodeCustomer = await seedCustomer('', 'sale1');
      const before = await prisma.purchaseOrder.count({ where: { buyerId: noCodeCustomer.id } });
      expect(before).toBe(0);

      const r = await svc.createPo({ buyerId: noCodeCustomer.id }, 'sale1');
      expect(r.ok).toBe(false);

      // đọc lại DB — không có dòng nào được ghi
      const after = await prisma.purchaseOrder.count({ where: { buyerId: noCodeCustomer.id } });
      expect(after).toBe(0);
    });

    it('createPo hai lần liên tiếp cho cùng khách sinh poCode khác nhau, đúng định dạng đo trên prod', async () => {
      const buyerId = await seedBuyer('TBS9204');
      const a = await svc.createPo({ buyerId }, 'sale1');
      const b = await svc.createPo({ buyerId }, 'sale1');
      if (!a.ok || !b.ok) throw new Error('setup');
      expect(a.po.poCode).toMatch(/^PO\d{3}\/\d{4}-TBS9204$/);
      expect(b.po.poCode).toMatch(/^PO\d{3}\/\d{4}-TBS9204$/);
      expect(a.po.poCode).not.toBe(b.po.poCode);
    });
  });

  // Fix round 2 (coordinator, sau Task 4): createPo() có 3 nhánh trong catch —
  // PoCodeRefused (146, message nghiệp vụ, GIỮ NGUYÊN), P2002 (147, continue —
  // GIỮ NGUYÊN) và nhánh generic (148, TỪNG nối thẳng e.message — lỗi Postgres
  // thật mang theo đường dẫn file + chi tiết cột/ràng buộc). Ép lỗi CSDL THẬT
  // (numeric field overflow trên subtotal Decimal(20,2), không phải chuỗi giả
  // lập) để canh đúng nhánh 148, không đụng 2 nhánh kia.
  describe('createPo — lỗi CSDL không lường trước KHÔNG rò rỉ chi tiết (Fix round 2)', () => {
    it('numeric field overflow (lỗi Postgres thật) -> msg KHÔNG chứa đường dẫn file/chi tiết Postgres', async () => {
      const buyerId = await seedBuyer('ZZAPI_poerr1');
      const r = await svc.createPo({ buyerId, subtotal: '99999999999999999999' as any }, 'sale1');
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error('setup');
      expect(r.msg).not.toMatch(/postgres|prisma|invocation|numeric field overflow|precision|scale|22003|po\.service\.ts|tx\.purchaseOrder/i);
    });

    it('numeric field overflow -> vẫn ghi log server-side (không nuốt mất, mất log = mất khả năng gỡ lỗi)', async () => {
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as unknown as void);
      try {
        const buyerId = await seedBuyer('ZZAPI_poerr2');
        await svc.createPo({ buyerId, subtotal: '99999999999999999999' as any }, 'sale1');
        expect(spy).toHaveBeenCalled();
        const logged = spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
        expect(logged).toMatch(/numeric field overflow|22003/i);
      } finally {
        spy.mockRestore();
      }
    });

    it('PoCodeRefused (146, thiếu buyer_id) KHÔNG bị đổi bởi fix này — message nghiệp vụ nguyên trạng', async () => {
      const r = await svc.createPo({}, 'sale1');
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error('setup');
      expect(r.msg).toBe('Thiếu buyer_id (khách hàng) — không sinh được mã PO');
    });

    it('nhánh P2002 (147, continue -> thử lại) KHÔNG bị đổi bởi fix này — createPo liên tiếp vẫn ra 2 mã khác nhau', async () => {
      const buyerId = await seedBuyer('ZZAPI_poerr3');
      const a = await svc.createPo({ buyerId }, 'sale1');
      const b = await svc.createPo({ buyerId }, 'sale1');
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (!a.ok || !b.ok) throw new Error('setup');
      expect(a.po.poCode).not.toBe(b.po.poCode);
    });
  });

  it('statusLabel phủ đủ mọi giá trị của PoStatus (thiếu nhãn = "?" âm thầm trên UI)', () => {
    for (const v of Object.values(PoStatus)) {
      expect(statusLabel(v)).not.toBe('?');
    }
  });
});
