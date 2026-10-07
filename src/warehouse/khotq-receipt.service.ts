import { Injectable } from '@nestjs/common';
import { KhoTqReceipt, KhoTqReceiptSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../iam/scope.service';
import { nowSec } from '../common/money';

// ═══ F3 (review cuối #07) ════════════════════════════════════════════════
// `ScopeService.buildDocScope` mặc định field 'saler' cho các nhánh
// own/team/dept/dept_tree khi caller không khai — `KhoTqReceipt` KHÔNG có
// cột đó. Trước bản vá này, một admin cấp `khotq_view` ở scope own (hoặc
// team/dept/dept_tree) cho MỘT user làm `listForUser` gọi Prisma với where
// `{ saler: ... }` -> `PrismaClientValidationError` -> lỗi 500, không phải
// danh sách rỗng. Cùng LỚP lỗi với bug storeId đã vá 23/09/2026 (xem
// `ScopeService.buildDocScope`), chạy NGƯỢC chiều: ở đó ScopeService tự DENY
// khi caller không khai cột kho; ở đây `KhoTqReceiptService` không khai cột
// nào cho own/team/dept vì — đúng như phần docblock `listForUser` bên dưới —
// model này CHƯA có quyết định nghiệp vụ cho khái niệm "người phụ trách" một
// phiếu nhận kho.
//
// `receivedBy` (người bấm nút nhận hàng) là ứng viên tự nhiên nhất để đóng
// vai "saler" ở đây — CÂN NHẮC rồi TỪ CHỐI: gán nó vào own/team/dept sẽ âm
// thầm biến "phạm vi xem" thành "mọi phiếu NV này từng nhận", một tính năng
// KHÔNG ai yêu cầu và không có test nghiệp vụ nào canh giữ ý nghĩa đó (khác
// hẳn "người phụ trách" của chứng từ sale — đây là "người thao tác", không
// phải "người sở hữu"). Không tự suy diễn quyết định nghiệp vụ ở lớp vá lỗi.
//
// Chọn: KHÔNG khai field nào (giữ nguyên hành vi hiện tại) — thay vào đó
// GUARD where trước khi đưa xuống Prisma: where nào tham chiếu field
// `KhoTqReceipt` không có thì coi là "phạm vi chưa có nghĩa với model này" ->
// trả RỖNG (fail-closed, không phải crash). Cùng khuôn
// `QuoteService.listForUser`/`referencesUnknownQuoteField`.
//
// ⛔ CHỈ dùng cho `where` do `ScopeService.buildDocScope()` sinh ra, và CHỈ ở
// `listForUser()`. Lý do: mọi nhánh của buildDocScope chỉ phát ra khoá là field
// VÔ HƯỚNG ở tầng trên cùng (`kho`, `saler`, `id`) — không bao giờ có filter
// quan hệ. Đem guard này soi một `where` giàu hơn (vd `{ packages: { some: {...} } }`,
// hay filter do caller trộn thêm) thì nó coi khoá quan hệ HỢP LỆ là "field lạ"
// và trả RỖNG cho một truy vấn ĐÚNG — tệ hơn cả cái crash nó thay thế, vì
// fail-closed kiểu đó KHÔNG AI NHẬN RA. Muốn dùng rộng hơn thì phải dạy nó
// biết khoá quan hệ + toán tử Prisma trước đã.
const KHOTQ_RECEIPT_FIELDS = new Set<string>(Object.values(Prisma.KhoTqReceiptScalarFieldEnum));

function referencesUnknownKhoTqReceiptField(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  for (const [key, val] of Object.entries(where as Record<string, unknown>)) {
    if (key === 'OR' || key === 'AND' || key === 'NOT') {
      const arr = Array.isArray(val) ? val : [val];
      if (arr.some((w) => referencesUnknownKhoTqReceiptField(w))) return true;
    } else if (!KHOTQ_RECEIPT_FIELDS.has(key)) {
      return true;
    }
  }
  return false;
}

// Nguồn cho phép NGƯỜI DÙNG tự khai khi nhận hàng. 'claimed' KHÔNG nằm trong
// danh sách này — đó là trạng thái ĐÍCH của claimUnclaimed(), không phải một
// nguồn nhận hàng thật; tạo thẳng một dòng 'claimed' qua receive() sẽ bỏ qua
// bước gán khách có kiểm soát. prod đo được: lark 1.249 · unclaimed 234 ·
// po_scan 85 · claimed 0 · manual 0 — 'manual' vẫn giữ vì là giá trị hợp lệ
// trong enum (nhập tay khi Lark/scan không chạy), dù chưa có dữ liệu thật.
const RECEIVE_SOURCES: KhoTqReceiptSource[] = ['lark', 'unclaimed', 'po_scan', 'manual'];

export type ReceiveInput = {
  source: KhoTqReceiptSource;
  kho: string;
  customerId?: string;
  receiptCode?: string;
  trackingCode?: string;
  poId?: number;
  poItemId?: number;
  lotId?: number;
  orderId?: number;
  productName?: string;
  quantity?: number;
  packages?: number;
  weight?: number | string;
  volume?: number | string;
  notes?: string;
};

type Result = { ok: true; msg: string; id: number } | { ok: false; msg: string };

@Injectable()
export class KhoTqReceiptService {
  constructor(private prisma: PrismaService, private scope: ScopeService) {}

  // Task 1 để cột `source` nullable, đẩy quyết định "bắt buộc hay không"
  // xuống tầng service (xem task-1-report.md). Quyết định ở đây: BẮT BUỘC —
  // một dòng không rõ nguồn thì không biết có cần customerId hay không (luật
  // ngay dưới), và cũng không phân biệt được với rác nhập lỗi.
  async receive(input: ReceiveInput, by: string): Promise<Result> {
    const source = input.source;
    if (!source || !RECEIVE_SOURCES.includes(source)) {
      return { ok: false, msg: 'Thiếu hoặc sai nguồn nhận hàng (source)' };
    }

    const kho = (input.kho ?? '').trim();
    // Không có kho -> nhân viên phạm vi kho (ScopeService.buildDocScope nhánh
    // 'warehouse') KHÔNG BAO GIỜ thấy được dòng này — coi như hàng thất lạc
    // trong hệ thống. Chặn cứng ngay từ khi nhận, không để lọt xuống DB.
    if (!kho) return { ok: false, msg: 'Thiếu kho — phiếu nhận không kho sẽ không ai thấy được' };

    const customerId = (input.customerId ?? '').trim() || null;
    // 'unclaimed' = hàng về nhưng chưa rõ của khách nào -> customerId được
    // phép trống. Mọi nguồn khác đã biết khách ngay từ lúc nhận -> bắt buộc.
    if (source !== 'unclaimed' && !customerId) {
      return { ok: false, msg: 'Thiếu customerId — chỉ nguồn "unclaimed" mới được để trống' };
    }

    const receipt = await this.prisma.khoTqReceipt.create({
      data: {
        source,
        kho,
        customerId,
        receiptCode: (input.receiptCode ?? '').trim() || null,
        trackingCode: (input.trackingCode ?? '').trim() || null,
        poId: input.poId ?? null,
        poItemId: input.poItemId ?? null,
        lotId: input.lotId ?? null,
        orderId: input.orderId ?? null,
        productName: (input.productName ?? '').trim() || null,
        quantity: input.quantity ?? null,
        packages: input.packages ?? null,
        weight: input.weight ?? null,
        volume: input.volume ?? null,
        notes: (input.notes ?? '').trim() || null,
        status: 1,
        receivedBy: by,
        receivedAt: nowSec(),
      },
    });
    return { ok: true, msg: 'OK', id: receipt.id };
  }

  // ⚠⚠⚠ Đường CHƯA TỪNG chạy thật trên prod: đo được 234 dòng source=
  // 'unclaimed' và ĐÚNG 0 dòng 'claimed' (xem test/warehouse/schema.spec.ts
  // và plan mục "⚠ ĐO PROD"). Bộ test của service này là chỗ DUY NHẤT phủ
  // luồng nhận chủ — đừng đọc "0 dòng claimed trên prod" thành "logic đã
  // được kiểm chứng bằng dữ liệu thật", vì nó chưa hề chạy.
  //
  // ⚠⚠ Nguyên tử theo đúng mẫu `PoService.transition` (#06): production
  // (`libs/cls.khovn.php:2478-2484`, cùng thao tác trên bảng kho VN, cùng
  // ngữ nghĩa) đã tự canh trước bẫy này — UPDATE có `WHERE id=$rid AND
  // source='unclaimed'` trong MỘT câu lệnh, vì hai người có thể cùng thấy
  // "chưa có chủ" và cùng bấm nhận cùng lúc; chỉ câu UPDATE nào THỰC SỰ đổi
  // được dòng mới là người thắng, người thua phải nhận ALREADY_CLAIMED chứ
  // không phải im lặng bị đè mất quyền sở hữu. Bản đầu của service này dùng
  // findUnique -> kiểm tra -> update({where:{id}}) (check-then-act): hai lời
  // gọi song song cùng đọc thấy 'unclaimed', cùng qua guard, cùng ghi — người
  // thứ hai âm thầm đè customerId của người thứ nhất, CẢ HAI đều nhận ok:true.
  // Sửa: gộp đọc-kiểm-ghi thành MỘT `updateMany({where:{id, source:
  // 'unclaimed'}})` — chỉ khớp và ghi khi CÒN đúng 'unclaimed' tại thời điểm
  // Postgres thực thi câu UPDATE, không phải tại thời điểm code đọc trước đó.
  // `count === 0` nghĩa là đã thua cuộc đua (hoặc không tồn tại/nguồn khác) ->
  // `findUnique` SAU ĐÓ chỉ để dựng thông điệp lỗi phân biệt hai trường hợp,
  // KHÔNG dùng để quyết định ok/không — quyết định đã chốt ở `updateMany`.
  // `_by` không dùng: đã ĐỐI CHIẾU production (`tbl_khotq_receipts`) — bảng
  // có `received_by`/`received_at`/`updated_at` nhưng KHÔNG có `claimed_by`/
  // `claimed_at`. Thiếu cột audit cho hành động claim là khoảng trống CÓ SẴN
  // ở production, không phải điều bản viết lại này bỏ sót. Giữ tham số để
  // khớp interface (và sẵn sàng nếu sau này thêm cột audit) nhưng không ghi
  // vào đâu vì không có chỗ ghi.
  async claimUnclaimed(receiptId: number, customerId: string, _by: string): Promise<Result> {
    const cus = (customerId ?? '').trim();
    if (!cus) return { ok: false, msg: 'Thiếu customerId để nhận chủ' };

    const result = await this.prisma.khoTqReceipt.updateMany({
      where: { id: receiptId, source: 'unclaimed' },
      data: { source: 'claimed', customerId: cus },
    });
    if (result.count === 0) {
      const receipt = await this.prisma.khoTqReceipt.findUnique({ where: { id: receiptId } });
      if (!receipt) return { ok: false, msg: 'Không tìm thấy phiếu nhận kho ' + receiptId };
      return {
        ok: false,
        msg: 'Chỉ phiếu nguồn "unclaimed" mới được nhận chủ (hiện là "' + receipt.source + '" — có thể vừa bị người khác nhận chủ)',
      };
    }
    return { ok: true, msg: 'OK', id: receiptId };
  }

  /**
   * Phạm vi xem theo #01 ScopeService, nhánh `warehouse`.
   *
   * `KhoTqReceipt` không có khái niệm "người phụ trách" (saler) — nó là
   * chứng từ KHO, không phải chứng từ SALE. Cố nhồi `saler`/`salerOther` vào
   * đây (vd trỏ vào `receivedBy`) sẽ làm các nhánh own/team/dept của
   * buildDocScope lọc theo "ai bấm nút nhận hàng" — SAI ý nghĩa nghiệp vụ và
   * không phải điều task này yêu cầu. Model này chỉ có MỘT trục phạm vi thật:
   * cột kho. Nếu sau này permission `khotq_view` được cấp ở scope own/team/
   * dept cho model này thì đó là quyết định nghiệp vụ mới, cần bàn riêng —
   * không tự suy diễn ở đây.
   *
   * Truyền `{ warehouse: 'kho' }` — QUAN TRỌNG NHẤT của cả task: model này
   * là nơi ĐẦU TIÊN thật sự có cột kho, nên nhánh `warehouse` (opt-in từ
   * 23/09/2026) mới có cột hợp lệ để lọc. Quên truyền field này ⇒ DENY toàn
   * bộ user phạm vi warehouse, nhìn giống hệt "chưa được gán kho nào" — xem
   * test 'quên truyền {warehouse:"kho"}' trong khotq-receipt.spec.ts để biết
   * cách phân biệt hai nguyên nhân đó.
   *
   * ⚠ F3 (review cuối #07): scope own/team/dept/dept_tree KHÔNG có cột hợp lệ
   * để lọc trên model này (xem block comment `referencesUnknownKhoTqReceiptField`
   * đầu file) — where do buildDocScope dựng cho các nhánh đó bị GUARD chặn
   * lại và trả RỖNG, không ném lỗi. Nếu sau này có quyết định nghiệp vụ cho
   * own/team/dept (vd theo `receivedBy`), sửa CẢ HAI chỗ: truyền field tương
   * ứng vào buildDocScope() bên dưới VÀ xoá guard cho field đó.
   */
  async listForUser(perm: string, uid: number): Promise<KhoTqReceipt[]> {
    const where = await this.scope.buildDocScope(perm, uid, { warehouse: 'kho' });
    if (referencesUnknownKhoTqReceiptField(where)) return [];
    return this.prisma.khoTqReceipt.findMany({ where, orderBy: { id: 'desc' } });
  }
}
