import * as fs from 'fs';
import * as path from 'path';
import { prisma, resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { CustomerCodeService } from '../../src/masterdata/customer-code.service';
import { CustomerService } from '../../src/masterdata/customer.service';
import { CUSTOMER_DTO_KEYS } from '../../src/common/dto/customer.dto';

// ═══════════════════════════════════════════════════════════════════════════
// F-2 của review CUỐI nhánh feat/api-dot1 — TẦNG DTO TRƯỚC ĐÂY LÀ ĐỒ TRƯNG BÀY.
//
// `toCustomerDto`/`toUserDto` (Task 3) được viết, được test kỹ bằng
// test/common/dto-no-leak.spec.ts... và KHÔNG ĐƯỢC GỌI Ở ĐÂU trong src/. Chỗ
// rò mà chúng sinh ra để bịt — `CustomerService.listForUser` trả
// `Promise<Customer[]>`, tức có cả `password` (hash bcrypt cổng khách) — vẫn
// nguyên si. Một bộ test XANH chứng nhận một lớp bảo vệ CHƯA ĐƯỢC LẮP.
//
// Hai ca dưới đây đi qua ĐÚNG hàm thật (không phải hàm chuyển đổi đứng một
// mình) trên CSDL thật, với một khách CÓ password trong bảng — nếu ai đó gỡ
// phép map ra khỏi listForUser thì chúng đỏ ngay.
// ═══════════════════════════════════════════════════════════════════════════

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const codeSvc = new CustomerCodeService(prisma as any);
const svc = new CustomerService(prisma as any, codeSvc, scope);

async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: 'r' + uid + '_' + code, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

describe('CustomerService.listForUser KHÔNG được trả model Prisma thô', () => {
  let uid: number;

  beforeEach(async () => {
    await resetIam();
    perm.clearCache();
    await resetMasterdata();
    uid = (await seedUser({ username: 'sale1' })).id;
    await grant(uid, 'customer_view', 'own');
    // Khách CÓ mật khẩu cổng khách thật trong CSDL — nếu hàm trả model thô thì
    // chuỗi hash này nằm ngay trong kết quả.
    await prisma.customer.create({
      data: { code: 'ZZAPI_DTO1', name: 'KH DTO', saler: 'sale1', cdate: 1, mdate: 1,
              password: '$2b$10$ZZAPIhashgiadinhkhongduocrongoai' },
    });
  });
  afterAll(() => prisma.$disconnect());

  // Ca "không vacuous": nếu listForUser trả mảng rỗng (vd vì fixture hỏng) thì
  // ca kiểm password bên dưới sẽ XANH MỘT CÁCH VÔ NGHĨA. Ca này chặn điều đó.
  it('vẫn trả đúng khách trong phạm vi (chống ca kiểm rò xanh vacuously)', async () => {
    const rows = await svc.listForUser('customer_view', uid);
    expect(rows.map((r) => r.code)).toEqual(['ZZAPI_DTO1']);
  });

  it('kết quả KHÔNG mang trường password', async () => {
    const rows = await svc.listForUser('customer_view', uid);
    expect(Object.keys(rows[0])).not.toContain('password');
  });

  // Mạnh hơn "không có password": khớp TUYỆT ĐỐI allow-list. Cột bí mật MỚI
  // thêm vào model sau này mặc định bị GIỮ LẠI, không phải mặc định bị lộ.
  it('bộ khoá trả ra khớp TUYỆT ĐỐI allow-list CUSTOMER_DTO_KEYS', async () => {
    const rows = await svc.listForUser('customer_view', uid);
    expect(Object.keys(rows[0]).sort()).toEqual([...CUSTOMER_DTO_KEYS].sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Lưới TĨNH: không hàm nào trong src/ được KHAI BÁO trả về model Prisma mang
// bí mật. Ca runtime ở trên chỉ canh đúng MỘT hàm đang tồn tại; lưới này canh
// những hàm CHƯA được viết — đúng chỗ F-2 phát sinh ("hàm list đầu tiên của
// đợt 2 viết `return this.customers.listForUser(...)`, tsc im lặng").
//
// ⚠ GIỚI HẠN THẬT (ghi ra, không che): lưới bắt KIỂU TRẢ VỀ ĐƯỢC KHAI BÁO. Một
// hàm KHÔNG chú thích kiểu (`async get(id) { return this.prisma.user.find... }`)
// vẫn lọt — TypeScript suy ra `User` mà không có chữ 'User' nào trên dòng đó.
// Bù lại bằng: (a) đòi khai kiểu trả về cho method public trong review,
// (b) ca runtime cho từng hàm list thật như ở trên.
// ═══════════════════════════════════════════════════════════════════════════
const SECRET_MODELS = ['Customer', 'User']; // Customer.password · User.password · User.gsecret
// Khớp phần KIỂU TRẢ VỀ: dấu ')' đóng danh sách tham số, rồi ':', rồi mọi thứ
// cho tới '{' hoặc '=>' — tên model đứng trong đó là khai báo trả về model thô.
const RETURN_TYPE = /\)\s*:\s*([^{]*?)(?:\{|=>|$)/;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...listTsFiles(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const SRC_ROOT = path.join(__dirname, '..', '..', 'src');
const REPO_ROOT = path.join(__dirname, '..', '..');

describe('không hàm nào trong src/ khai báo trả về model Prisma mang bí mật', () => {
  it('không có kiểu trả về nào chứa Customer/User thô', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(SRC_ROOT)) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      // Chính hai tệp DTO PHẢI nhận `Customer`/`User` làm THAM SỐ (chúng là cửa
      // chuyển đổi) — tham số nằm TRƯỚC dấu ')' nên mẫu trên không chạm tới.
      fs.readFileSync(file, 'utf8').split('\n').forEach((raw, idx) => {
        const m = RETURN_TYPE.exec(raw);
        if (!m) return;
        const ret = m[1];
        for (const model of SECRET_MODELS) {
          if (new RegExp(`\\b${model}\\b`).test(ret)) {
            offenders.push(`${rel}:${idx + 1}: ${raw.trim()}`);
            break;
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
