import { prisma, resetApproval, seedTemplate, seedStep } from '../helpers/approval-db';
import { ReturnService } from '../../src/approval/return.service';
import { RETURN_CHECKPOINTS } from '../../src/approval/return-checkpoints';

const svc = new ReturnService(prisma as any);
beforeEach(resetApproval);
afterAll(() => prisma.$disconnect());

function nowSec() { return Math.floor(Date.now() / 1000); }

async function seedFormFields(templateId: number, fields: { key: string; label: string; sortOrder?: number }[]) {
  for (const f of fields) {
    await prisma.approvalFormField.create({
      data: { templateId, fieldKey: f.key, label: f.label, fieldType: 'text', sortOrder: f.sortOrder ?? 0 },
    });
  }
}

// ─────────────────────────── mergeResubmit (hàm THUẦN) ───────────────────────────

describe('mergeResubmit — §4.1', () => {
  test('"1200" vs "1200.00" là KHÁC (so sánh ép chuỗi, không ép số)', () => {
    const { data, doi, chan } = svc.mergeResubmit(['price_cyn'], { price_cyn: '1200' }, { price_cyn: '1200.00' });
    expect(data.price_cyn).toBe('1200.00');
    expect(doi.price_cyn).toEqual({ cu: '1200', moi: '1200.00' });
    expect(chan).toEqual([]);
  });

  test('khoá ngoài whitelist mà giá trị THỰC SỰ đổi ⇒ vào chan, giá trị cũ GIỮ NGUYÊN', () => {
    const { data, doi, chan } = svc.mergeResubmit(['price_cyn'], { confirm: 'no' }, { confirm: 'yes' });
    expect(chan).toEqual(['confirm']);
    expect(data.confirm).toBe('no'); // giữ nguyên, KHÔNG bị ghi đè
    expect(doi.confirm).toBeUndefined();
  });

  test('khoá ngoài whitelist mà giá trị KHÔNG đổi ⇒ KHÔNG vào chan', () => {
    const { chan, data } = svc.mergeResubmit(['price_cyn'], { confirm: 'no' }, { confirm: 'no' });
    expect(chan).toEqual([]);
    expect(data.confirm).toBe('no');
  });

  test('khoá mới (không có trong cu) và không được phép ⇒ rơi mất (không vào data, không vào chan)', () => {
    const { data, doi, chan } = svc.mergeResubmit(['price_cyn'], {}, { hack_field: 'x' });
    expect(data.hack_field).toBeUndefined();
    expect(chan).toEqual([]);
    expect(doi.hack_field).toBeUndefined();
  });

  test('khoá mới (không có trong cu) và được phép ⇒ vào data + doi với cu=null', () => {
    const { data, doi } = svc.mergeResubmit(['price_cyn'], {}, { price_cyn: '500' });
    expect(data.price_cyn).toBe('500');
    expect(doi.price_cyn).toEqual({ cu: null, moi: '500' });
  });

  test('khoá được phép mà giá trị KHÔNG đổi ⇒ không vào doi', () => {
    const { doi, data } = svc.mergeResubmit(['price_cyn'], { price_cyn: '100' }, { price_cyn: '100' });
    expect(doi.price_cyn).toBeUndefined();
    expect(data.price_cyn).toBe('100');
  });

  test('khoá có trong cu mà moi không gửi ⇒ giữ nguyên trong data', () => {
    const { data } = svc.mergeResubmit(['price_cyn', 'rate_buy'], { price_cyn: '100', rate_buy: '3.5' }, { price_cyn: '200' });
    expect(data.rate_buy).toBe('3.5');
    expect(data.price_cyn).toBe('200');
  });

  test('giá trị không vô hướng (mảng) so bằng JSON.stringify, không phải ép chuỗi kiểu PHP "Array"', () => {
    const { doi } = svc.mergeResubmit(['files'], { files: ['a.jpg'] }, { files: ['a.jpg', 'b.jpg'] });
    expect(doi.files).toEqual({ cu: ['a.jpg'], moi: ['a.jpg', 'b.jpg'] });
  });

  test('mảng giống hệt nhau (JSON.stringify bằng nhau) ⇒ không vào doi', () => {
    const { doi } = svc.mergeResubmit(['files'], { files: ['a.jpg'] }, { files: ['a.jpg'] });
    expect(doi.files).toBeUndefined();
  });
});

// ─────────────────────────── config / catalog / editableFields — §3 ───────────────────────────

describe('config() — §3.1', () => {
  test('không có dòng nào ⇒ null (điểm duyệt TẮT trả về)', async () => {
    expect(await svc.config('approval', '99999')).toBeNull();
  });

  test('edit_mode=off ⇒ null dù có dòng', async () => {
    await prisma.returnConfig.create({ data: { checkpointType: 'approval', checkpointRef: '1', editMode: 'off', requireReason: true } });
    expect(await svc.config('approval', '1')).toBeNull();
  });

  test('edit_mode=all ⇒ trả về dòng', async () => {
    await prisma.returnConfig.create({ data: { checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc', editMode: 'all', requireReason: true } });
    const cfg = await svc.config('biz', 'payment.duyet_ncc');
    expect(cfg?.editMode).toBe('all');
  });

  test('ctype khác "approval" bị ép thành "biz"', async () => {
    await prisma.returnConfig.create({ data: { checkpointType: 'biz', checkpointRef: 'x', editMode: 'all', requireReason: true } });
    const cfg = await svc.config('anything_else', 'x');
    expect(cfg?.checkpointType).toBe('biz');
  });
});

describe('catalog() — §3.3', () => {
  test('biz: trả field_key=>label của RETURN_CHECKPOINTS; khoá lạ ⇒ {}', async () => {
    const dm = await svc.catalog('biz', 'payment.duyet_ncc');
    expect(dm).toEqual(RETURN_CHECKPOINTS['payment.duyet_ncc'].fields);
    expect(await svc.catalog('biz', 'no_such_key')).toEqual({});
  });

  test('approval: mọi trường của MẪU chứa bước ref, thứ tự sort_order,id', async () => {
    const t = await seedTemplate('cat_tpl');
    const s1 = await seedStep(t.id, { order: 1 });
    await seedFormFields(t.id, [
      { key: 'b', label: 'Nhãn B', sortOrder: 2 },
      { key: 'a', label: 'Nhãn A', sortOrder: 1 },
    ]);
    const dm = await svc.catalog('approval', String(s1.id));
    expect(Object.keys(dm)).toEqual(['a', 'b']);
    expect(dm.a).toBe('Nhãn A');
  });

  test('approval: bước không tồn tại ⇒ {}', async () => {
    expect(await svc.catalog('approval', '999999')).toEqual({});
  });
});

describe('editableFields() — §3.3', () => {
  test('off ⇒ []', async () => {
    await prisma.returnConfig.create({ data: { checkpointType: 'biz', checkpointRef: 'k1', editMode: 'off', requireReason: true } });
    expect(await svc.editableFields('biz', 'k1')).toEqual([]);
  });

  test('không có dòng cấu hình ⇒ []', async () => {
    expect(await svc.editableFields('biz', 'no_row')).toEqual([]);
  });

  test('all ⇒ mọi khoá của danh mục (biz)', async () => {
    await prisma.returnConfig.create({ data: { checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc', editMode: 'all', requireReason: true } });
    const fields = await svc.editableFields('biz', 'payment.duyet_ncc');
    expect(fields.sort()).toEqual(Object.keys(RETURN_CHECKPOINTS['payment.duyet_ncc'].fields).sort());
  });

  test('whitelist ⇒ chỉ trường trong tbl_return_fields VÀ còn trong danh mục', async () => {
    const t = await seedTemplate('wl_tpl');
    const s1 = await seedStep(t.id, { order: 1 });
    await seedFormFields(t.id, [{ key: 'kept', label: 'Kept' }, { key: 'other', label: 'Other' }]);
    const cfg = await prisma.returnConfig.create({
      data: { checkpointType: 'approval', checkpointRef: String(s1.id), editMode: 'whitelist', requireReason: true },
    });
    await prisma.returnConfigField.create({ data: { configId: cfg.id, fieldKey: 'kept' } });
    // whitelist trỏ tới trường ĐÃ BỊ XOÁ khỏi mẫu (không còn trong danh mục) — phải bị bỏ, không thành cửa hậu
    await prisma.returnConfigField.create({ data: { configId: cfg.id, fieldKey: 'removed_from_template' } });

    const fields = await svc.editableFields('approval', String(s1.id));
    expect(fields).toEqual(['kept']);
  });
});

// ─────────────────────────── returnObject / markResubmitted / activeReturn / state ───────────────────────────

describe('returnObject() — upsert §2.2, A3', () => {
  test('chưa có dòng ⇒ tạo round=1, state=returned', async () => {
    const st = await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 501, checkpointType: 'approval', checkpointRef: '10',
      reason: 'thiếu chứng từ', fieldsOpened: ['a', 'b'], dataBefore: { a: 1 }, returnedBy: 'kt1',
    });
    expect(st.round).toBe(1);
    expect(st.state).toBe('returned');
    expect(st.resubmittedAt).toBeNull();
  });

  test('vòng 2: round tăng lên, ghi đè reason/fieldsOpened/dataBefore/returnedBy, resubmittedAt=null, GIỮ NGUYÊN dataAfter (A3)', async () => {
    await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 502, checkpointType: 'approval', checkpointRef: '10',
      reason: 'lần 1', fieldsOpened: ['a'], dataBefore: { a: 1 }, returnedBy: 'kt1',
    });
    await svc.markResubmitted(prisma, 'approval_request', 502, { a: 'sau khi sửa vòng 1' });

    const st2 = await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 502, checkpointType: 'approval', checkpointRef: '11',
      reason: 'lần 2', fieldsOpened: ['a', 'c'], dataBefore: { a: 2 }, returnedBy: 'kt2',
    });
    expect(st2.round).toBe(2);
    expect(st2.state).toBe('returned');
    expect(st2.reason).toBe('lần 2');
    expect(st2.checkpointRef).toBe('11');
    expect(st2.fieldsOpened).toEqual(['a', 'c']);
    expect(st2.dataBefore).toEqual({ a: 2 });
    expect(st2.returnedBy).toBe('kt2');
    expect(st2.resubmittedAt).toBeNull();
    expect(st2.dataAfter).toEqual({ a: 'sau khi sửa vòng 1' }); // A3 — không bị xoá
  });

  // Fix round 1 (review): returnObject() phải nguyên tử ở tầng CSDL (upsert ON CONFLICT),
  // không phải findUnique-rồi-create/update — hai lượt trả đồng thời trên đối tượng MỚI
  // (chưa có dòng) không được để lượt sau vỡ P2002 khi lượt trước vừa tạo xong.
  test('hai lượt returnObject() ĐỒNG THỜI trên cùng đối tượng MỚI ⇒ một dòng, round=2, không lỗi', async () => {
    const objectType = 'approval_request';
    const objectId = 1001;
    const call = () => prisma.$transaction((tx) => svc.returnObject(tx, {
      objectType, objectId, checkpointType: 'approval', checkpointRef: '1',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    }));

    const results = await Promise.all([call(), call()]);
    expect(results).toHaveLength(2);

    const rows = await prisma.returnState.findMany({ where: { objectType, objectId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].round).toBe(2);
  });
});

describe('markResubmitted() + activeReturn() + state()', () => {
  test('activeReturn: trả dòng khi returned, null khi resubmitted hoặc không có dòng', async () => {
    expect(await svc.activeReturn(prisma, 'approval_request', 601)).toBeNull();
    await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 601, checkpointType: 'approval', checkpointRef: '1',
      reason: 'r', fieldsOpened: ['a'], dataBefore: {}, returnedBy: 'kt',
    });
    expect((await svc.activeReturn(prisma, 'approval_request', 601))?.state).toBe('returned');

    await svc.markResubmitted(prisma, 'approval_request', 601, { a: 1 });
    expect(await svc.activeReturn(prisma, 'approval_request', 601)).toBeNull();
    expect((await svc.state('approval_request', 601))?.state).toBe('resubmitted');
  });

  test('activeReturn nhận được tx của $transaction', async () => {
    await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 602, checkpointType: 'approval', checkpointRef: '1',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    });
    const found = await prisma.$transaction(async (tx) => svc.activeReturn(tx, 'approval_request', 602));
    expect(found?.objectId).toBe(602);
  });
});

describe('clear()', () => {
  test('xoá cứng dòng trạng thái', async () => {
    await svc.returnObject(prisma, {
      objectType: 'payment', objectId: 701, checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    });
    await svc.clear('payment', 701);
    expect(await svc.state('payment', 701)).toBeNull();
  });

  test('không có dòng vẫn không lỗi', async () => {
    await expect(svc.clear('payment', 99999)).resolves.toBeUndefined();
  });
});

// ─────────────────────────── changedFields — §4.3 ───────────────────────────

describe('changedFields()', () => {
  test('null ⇒ {}', () => {
    expect(svc.changedFields(null)).toEqual({});
  });

  // Fix round 1 (review, Minor): trước chỉ test nhánh st===null; cần một ReturnState THẬT
  // với state='returned' để xác nhận guard §4.3 độc lập ("chỉ khi resubmitted").
  test('state=returned (chưa nộp lại) ⇒ {} dù dataBefore/dataAfter có dữ liệu', async () => {
    const st = await svc.returnObject(prisma, {
      objectType: 'payment', objectId: 802, checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc',
      reason: 'r', fieldsOpened: ['price_cyn'], dataBefore: { price_cyn: '100' }, returnedBy: 'kt',
    });
    expect(st.state).toBe('returned');
    expect(svc.changedFields(st)).toEqual({});
  });

  test('resubmitted: so dataBefore/dataAfter CHỈ trên fieldsOpened, thiếu khoá = null', async () => {
    await svc.returnObject(prisma, {
      objectType: 'payment', objectId: 801, checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc',
      reason: 'r', fieldsOpened: ['price_cyn', 'ncc_receiver'], dataBefore: { price_cyn: '100', ncc_receiver: 'A' }, returnedBy: 'kt',
    });
    await svc.markResubmitted(prisma, 'payment', 801, { price_cyn: '200' }); // ncc_receiver không gửi lại ⇒ thiếu khoá

    const st = await svc.state('payment', 801);
    const diff = svc.changedFields(st);
    expect(diff.price_cyn).toEqual({ cu: '100', moi: '200' });
    expect(diff.ncc_receiver).toEqual({ cu: 'A', moi: null }); // thiếu khoá ở after = null, khác 'A' ⇒ đổi
  });
});

// ─────────────────────────── notReturnedWhere — §5.2 ───────────────────────────

describe('notReturnedWhere()', () => {
  test('loại đúng object đang returned, KHÔNG loại resubmitted', async () => {
    await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 901, checkpointType: 'approval', checkpointRef: '1',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    });
    await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 902, checkpointType: 'approval', checkpointRef: '1',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    });
    await svc.markResubmitted(prisma, 'approval_request', 902, {}); // 902 đã nộp lại — KHÔNG được loại

    const where = await svc.notReturnedWhere('approval_request');
    expect(where.id.notIn).toContain(901);
    expect(where.id.notIn).not.toContain(902);
  });

  test('objectType khác không ảnh hưởng lẫn nhau', async () => {
    await svc.returnObject(prisma, {
      objectType: 'payment', objectId: 951, checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    });
    const where = await svc.notReturnedWhere('approval_request');
    expect(where.id.notIn).not.toContain(951);
  });

  // Fix round 1 (review): notReturnedWhere() phải nhận được `tx` tuỳ chọn để bên gọi (màn
  // liệt kê/đếm — §5.2) tính trong CÙNG transaction với câu findMany/count chính, tránh đọc
  // lệch snapshot. Không phải cổng chặn (đó là việc của activeReturn() dưới khoá dòng).
  test('nhận tx tuỳ chọn — thấy dòng vừa tạo trong CÙNG transaction trước khi commit', async () => {
    const notIn = await prisma.$transaction(async (tx) => {
      await svc.returnObject(tx, {
        objectType: 'approval_request', objectId: 999, checkpointType: 'approval', checkpointRef: '1',
        reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
      });
      const where = await svc.notReturnedWhere('approval_request', tx);
      return where.id.notIn;
    });
    expect(notIn).toContain(999);
  });

  test('không truyền tx vẫn hoạt động như trước (mặc định dùng prisma)', async () => {
    await svc.returnObject(prisma, {
      objectType: 'approval_request', objectId: 998, checkpointType: 'approval', checkpointRef: '1',
      reason: 'r', fieldsOpened: [], dataBefore: {}, returnedBy: 'kt',
    });
    const where = await svc.notReturnedWhere('approval_request');
    expect(where.id.notIn).toContain(998);
  });
});
