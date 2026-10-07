import * as fs from 'fs';
import * as path from 'path';

// Lưới TĨNH chặn "e.message"/"e?.message" (và mọi biến thể TÊN BIẾN) MỚI xuất
// hiện trong src/ — bài học Fix round 2 (sau Task 4): coordinator từng grep
// bằng `e\.message` để kết luận chỉ 1 điểm rò rỉ (po.service.ts:148), nhưng
// mẫu đó KHÔNG khớp optional chaining `e?.message` — bỏ lọt thêm 2 điểm y
// hệt (customer.service.ts, packing-lot.service.ts). Quét bằng `\??\.` để
// bắt CẢ HAI dạng.
//
// Task 5 PART C — CÙNG MỘT LỚP LỖI, lộ ra lần nữa: mẫu cũ chỉ khớp đúng 3 tên
// biến cố định `e`/`err`/`error`. Một điểm rò viết bằng tên khác — `ex.message`,
// `caught.message` — lọt lưới y hệt cách `e?.message` từng lọt lưới `e\.message`.
// Đây KHÔNG phải một bug riêng lẻ, mà là DẤU HIỆU của cùng thói quen: viết một
// mẫu trông có vẻ đầy đủ nhưng âm thầm loại trừ biến thể chưa nghĩ tới. Đổi
// `(?:e|err|error)` → `\w+`: khớp BẤT KỲ định danh nào đứng ngay trước
// `.message`/`?.message`, không neo cứng vào danh sách tên biến.
//
// ⚠ Vẫn còn một biến thể lưới này (cố ý CHƯA) bắt được: định danh bị NGOẶC/ÉP
// KIỂU đứng giữa nó và `.message`, vd `(err as Error).message` — thấy ở
// gl.service.ts:60 và wallet.service.ts:92 (cả hai đều KHÔNG bị sửa ở đây:
// gl.service.ts ngoài phạm vi file Task 5 liệt kê, wallet.service.ts nằm
// trong src/money/ mà Task 5 CHỈ được phép đụng wallet.controller.ts). Ghi lại
// ở đây để không lặp lại nhầm lẫn "lưới trông đầy đủ" một lần nữa — xem thêm
// docs/rewrite-spec/no-ky-thuat.md.
//
// Đây là lưới AN TOÀN CUỐI — không thay được review, chỉ chặn TÁI PHẠM: một
// điểm .message MỚI nối vào response/throw ra ngoài mà không qua review kỹ
// như đợt sửa này sẽ bị lưới này chặn ngay.
//
// Cho phép ĐÚNG 5 điểm đã soát kỹ (không phải 2 như yêu cầu gốc — 3 điểm
// .logger.error(...) THÊM MỚI ở chính đợt sửa này CŨNG hợp lệ, cùng bản chất
// với dòng log của filter: ghi SERVER-SIDE, không trả ra client):
//   1. http-exception.filter.ts — dòng log của chính filter (Task 4).
//   2. po.service.ts — `PoCodeRefused`, lỗi nghiệp vụ có KIỂU, message viết
//      cho người dùng cuối (KHÔNG phải exception thô) — brief Task 4 đã chỉ
//      rõ đây là false positive, không được "fix".
//   3–5. po.service.ts / customer.service.ts / packing-lot.service.ts — ba
//      dòng `this.logger.error(...)` MỚI thêm ở Fix round 2, thay cho việc
//      nối .message vào response client thấy.
// Allow-list khớp theo file + NGUYÊN VĂN dòng (đã trim) — khớp đúng "ngữ
// cảnh" thay vì chỉ số dòng (số dòng trôi theo mọi sửa đổi không liên quan
// trong cùng file; nguyên văn dòng thì không).
const PATTERN = /\b\w+\??\.message\b/;

const ALLOW: ReadonlyArray<{ file: string; line: string }> = [
  {
    file: 'src/common/http-exception.filter.ts',
    line: "`${req?.method ?? '?'} ${req?.originalUrl ?? req?.url ?? '?'} -> ${err?.message ?? String(err)}`,",
  },
  {
    file: 'src/po/po.service.ts',
    line: 'if (e instanceof PoCodeRefused) return { ok: false, msg: e.message };',
  },
  {
    file: 'src/po/po.service.ts',
    line: "this.logger.error('createPo: ' + (e?.message ?? String(e)), e?.stack);",
  },
  {
    file: 'src/masterdata/customer.service.ts',
    line: "this.logger.error('create: ' + (e?.message ?? String(e)), e?.stack);",
  },
  {
    file: 'src/warehouse/packing-lot.service.ts',
    line: "this.logger.error('createLot: ' + (e?.message ?? String(e)), e?.stack);",
  },
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listTsFiles(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const SRC_ROOT = path.join(__dirname, '..', '..', 'src');
const REPO_ROOT = path.join(__dirname, '..', '..');

describe('src/ không có e.message/e?.message (hay err/error tương đương) rò rỉ MỚI ra ngoài allow-list', () => {
  it('mọi chỗ khớp mẫu trong src/ đều nằm trong allow-list đã soát kỹ', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(SRC_ROOT)) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((raw, idx) => {
        if (!PATTERN.test(raw)) return;
        const trimmed = raw.trim();
        const allowed = ALLOW.some((a) => a.file === rel && a.line === trimmed);
        if (!allowed) offenders.push(`${rel}:${idx + 1}: ${trimmed}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
