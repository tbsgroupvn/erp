// test/po/order-gen-surface.spec.ts — review cuối #06 đợt 2, I-2: lưới TĨNH
// canh bề mặt công khai của việc sinh đơn. Hàm lõi `createOrdersPerItem`
// (src/po/order-gen.core.ts) KHÔNG có cổng nào; trên prod mọi cổng nằm ở nơi
// gọi (process_gen_orders.php). Bản đầu nhánh này export hàm lõi qua DI ⇒ gọi
// được trên PO chưa duyệt. Lưới này chặn đường đó mọc lại "vô tình".
import * as fs from 'fs';
import * as path from 'path';
import { OrderGenService } from '../../src/po/order-gen.service';

function listTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listTs(p);
    return e.name.endsWith('.ts') ? [p] : [];
  });
}

const ROOT = path.resolve(__dirname, '../..');

describe('I-2 — bề mặt công khai của sinh đơn', () => {
  it('CHỈ src/po/order-gen.service.ts được import order-gen.core trong src/ (import/require/re-export)', () => {
    const users = listTs(path.join(ROOT, 'src'))
      .filter((f) => !f.endsWith(`order-gen.core.ts`))
      // Khớp CHUỖI ĐẶC TẢ MODULE ('./order-gen.core', "../po/order-gen.core",
      // `…/order-gen.core`) — mọi import/require/import()/export-from đều phải
      // viết nó; chú thích nhắc tên file `order-gen.core.ts` thì không khớp.
      .filter((f) => /['"`][^'"`\n]*order-gen\.core['"`]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(users).toEqual(['src/po/order-gen.service.ts']);
  });

  it('OrderGenService chỉ có ĐÚNG một phương thức công khai: generateOrdersForPo', () => {
    const methods = Object.getOwnPropertyNames(OrderGenService.prototype).filter((n) => n !== 'constructor');
    expect(methods).toEqual(['generateOrdersForPo']);
  });
});
