import { prisma } from '../helpers/db';
import { resetMasterdata, seedWarehouses } from '../helpers/masterdata-db';
import { CatalogService } from '../../src/masterdata/catalog.service';

const cat = new CatalogService(prisma as any);

describe('CatalogService', () => {
  beforeEach(async () => {
    await resetMasterdata();
  });
  afterAll(() => prisma.$disconnect());

  it('Warehouse: chỉ nhận VN/TQ, sắp theo sort', async () => {
    await seedWarehouses();
    const ws = await cat.listWarehouses();
    expect(ws.map((w) => w.ma)).toEqual(['VN_HN', 'VN_HCM', 'TQ_BANGTUONG', 'TQ_NGHIAO']);
    await expect(cat.upsertWarehouse({ ma: 'X', ten: 'X', loai: 'LAO' as any })).rejects.toThrow();
  });

  it('Warehouse: giữ đúng 4 kho gốc sau seed (mô hình 4 kho #07)', async () => {
    await seedWarehouses();
    expect(await prisma.warehouse.count()).toBe(4);
  });

  it('CustomerGroup: code là khoá chính, upsert không đẻ bản trùng', async () => {
    await cat.upsertCustomerGroup({ code: 'VIP', name: 'Khách VIP' }, 'admin');
    await cat.upsertCustomerGroup({ code: 'VIP', name: 'VIP sửa tên' }, 'admin');
    expect(await prisma.customerGroup.count()).toBe(1);
    expect((await prisma.customerGroup.findUnique({ where: { code: 'VIP' } }))!.name).toBe('VIP sửa tên');
  });

  it('listCustomerGroups chỉ trả nhóm đang bật', async () => {
    await cat.upsertCustomerGroup({ code: 'ON', name: 'Bật' }, 'admin');
    await cat.upsertCustomerGroup({ code: 'OFF', name: 'Tắt' }, 'admin');
    await prisma.customerGroup.update({ where: { code: 'OFF' }, data: { isactive: 0 } });
    expect((await cat.listCustomerGroups()).map((g) => g.code)).toEqual(['ON']);
  });

  it('listWarehouses chỉ trả kho đang bật (isactive)', async () => {
    await seedWarehouses();
    await prisma.warehouse.update({ where: { ma: 'VN_HCM' }, data: { isactive: 0 } });
    const mas = (await cat.listWarehouses()).map((w) => w.ma);
    expect(mas).not.toContain('VN_HCM');
    expect(mas).toEqual(['VN_HN', 'TQ_BANGTUONG', 'TQ_NGHIAO']);
  });

  it('listCrmCategories chỉ trả nhóm đang bật (active) — vô hiệu hoá phải có tác dụng', async () => {
    await cat.upsertCrmCategory({ name: 'Bật', sort: 1, active: 1 });
    const off = await cat.upsertCrmCategory({ name: 'Tắt', sort: 2, active: 0 });
    const names = (await cat.listCrmCategories()).map((c) => c.name);
    expect(names).toContain('Bật');
    expect(names).not.toContain('Tắt');
    expect(off.active).toBe(0); // xác nhận cờ đã ghi đúng, không phải upsert lỗi
  });

  // Pin hành vi 23/09/2026: upsert = "nhóm này phải tồn tại VÀ dùng được".
  // Trước đây update chỉ ghi name/mdate, nên upsert một nhóm đã tắt trả về
  // 'thành công' mà nhóm vẫn không hiện ở listCustomerGroups — hỏng im lặng.
  it('upsert một nhóm ĐÃ TẮT phải KÍCH HOẠT LẠI nó', async () => {
    await cat.upsertCustomerGroup({ code: 'REACT1', name: 'Nhóm' }, 'admin');
    await prisma.customerGroup.update({ where: { code: 'REACT1' }, data: { isactive: 0 } });
    expect((await cat.listCustomerGroups()).map((g: any) => g.code)).not.toContain('REACT1');

    await cat.upsertCustomerGroup({ code: 'REACT1', name: 'Nhóm (bật lại)' }, 'admin');
    const rows = await cat.listCustomerGroups();
    expect(rows.map((g: any) => g.code)).toContain('REACT1');
    expect(rows.find((g: any) => g.code === 'REACT1')!.name).toBe('Nhóm (bật lại)');
  });
});
