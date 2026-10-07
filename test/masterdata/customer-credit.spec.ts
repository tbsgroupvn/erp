import { prisma, resetIam } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { CustomerCodeService } from '../../src/masterdata/customer-code.service';
import {
  CustomerService,
  CREDIT_LIMIT_OBJECT_TYPE,
  CREDIT_LIMIT_FIELD_CUS,
  CREDIT_LIMIT_FIELD_AMOUNT,
} from '../../src/masterdata/customer.service';
import { AStatus } from '../../src/approval/approval.constants';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const codeSvc = new CustomerCodeService(prisma as any);
const svc = new CustomerService(prisma as any, codeSvc, scope);

/** Tạo một phiếu duyệt cấp hạn mức. Mặc định là phiếu HỢP LỆ (đã duyệt, đúng
 *  loại, đúng khách, đúng số tiền); truyền `over` để bẻ từng điều kiện một. */
async function seedCreditRequest(
  cus: string,
  amount: number,
  over: Partial<{ status: number; objectType: string; isDeleted: boolean; formData: string | null }> = {},
) {
  return prisma.approvalRequest.create({
    data: {
      templateId: 1,
      objectType: over.objectType ?? CREDIT_LIMIT_OBJECT_TYPE,
      objectId: 0,
      currentStepOrder: 1,
      status: over.status ?? AStatus.APPROVED,
      submittedBy: 'ktt1',
      submittedAt: 1,
      isDeleted: over.isDeleted ?? false,
      formData:
        over.formData !== undefined
          ? over.formData
          : JSON.stringify({ [CREDIT_LIMIT_FIELD_CUS]: cus, [CREDIT_LIMIT_FIELD_AMOUNT]: amount }),
    },
  });
}

describe('CustomerService.applyCreditLimit — chỉ đặt được qua PHIẾU DUYỆT THẬT', () => {
  beforeEach(async () => {
    await resetIam();
    perm.clearCache();
    await resetMasterdata();
    await prisma.approvalRequest.deleteMany({});
  });
  afterAll(() => prisma.$disconnect());

  it('phiếu hợp lệ -> ghi limit + creditAt/creditBy', async () => {
    await seedCustomer('TBS8200', 'sale1');
    const req = await seedCreditRequest('TBS8200', 50_000_000);
    const r = await svc.applyCreditLimit('TBS8200', 50_000_000, 30, 'ktt1', { approvedRequestId: req.id });
    expect(r.ok).toBe(true);
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8200' } });
    expect(c!.creditLimit).toBe(50_000_000n); // BigInt VND, không float
    expect(c!.creditDays).toBe(30);
    expect(c!.creditBy).toBe('ktt1');
    expect(c!.creditAt).toBeGreaterThan(0);
  });

  it('KHÔNG truyền phiếu -> từ chối, hạn mức không đổi', async () => {
    await seedCustomer('TBS8201', 'sale1');
    const r = await svc.applyCreditLimit('TBS8201', 99_000_000, 30, 'sale1', { approvedRequestId: 0 });
    expect(r.ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8201' } }))!.creditLimit).toBe(0n);
  });

  it('⚠ phiếu KHÔNG TỒN TẠI -> từ chối (trước đây chỉ cần id>0 là lọt)', async () => {
    await seedCustomer('TBS8204', 'sale1');
    const r = await svc.applyCreditLimit('TBS8204', 50_000_000, 30, 'ktt1', { approvedRequestId: 999_999 });
    expect(r.ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8204' } }))!.creditLimit).toBe(0n);
  });

  it('⚠ phiếu CHƯA DUYỆT (đang chờ) -> từ chối', async () => {
    await seedCustomer('TBS8205', 'sale1');
    const req = await seedCreditRequest('TBS8205', 50_000_000, { status: AStatus.PENDING });
    const r = await svc.applyCreditLimit('TBS8205', 50_000_000, 30, 'ktt1', { approvedRequestId: req.id });
    expect(r.ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8205' } }))!.creditLimit).toBe(0n);
  });

  it('⚠ phiếu đã bị TỪ CHỐI / THU HỒI -> từ chối', async () => {
    await seedCustomer('TBS8206', 'sale1');
    for (const st of [AStatus.REJECTED, AStatus.REVOKED]) {
      const req = await seedCreditRequest('TBS8206', 50_000_000, { status: st });
      const r = await svc.applyCreditLimit('TBS8206', 50_000_000, 30, 'ktt1', { approvedRequestId: req.id });
      expect(r.ok).toBe(false);
    }
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8206' } }))!.creditLimit).toBe(0n);
  });

  // Đây là lỗ NGUY HIỂM NHẤT nếu chỉ kiểm "có phiếu đã duyệt": mượn một phiếu
  // đã duyệt thuộc loại KHÁC (vd phiếu chi vặt) để đặt hạn mức tuỳ ý.
  it('⚠⚠ mượn phiếu ĐÃ DUYỆT thuộc LOẠI KHÁC -> từ chối', async () => {
    await seedCustomer('TBS8207', 'sale1');
    const req = await seedCreditRequest('TBS8207', 50_000_000, { objectType: 'wallet_alloc' });
    const r = await svc.applyCreditLimit('TBS8207', 50_000_000, 30, 'ktt1', { approvedRequestId: req.id });
    expect(r.ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8207' } }))!.creditLimit).toBe(0n);
  });

  it('⚠⚠ phiếu duyệt CHO KHÁCH KHÁC -> từ chối', async () => {
    await seedCustomer('TBS8208', 'sale1');
    await seedCustomer('TBS8209', 'sale1');
    const req = await seedCreditRequest('TBS8209', 50_000_000); // duyệt cho 8209
    const r = await svc.applyCreditLimit('TBS8208', 50_000_000, 30, 'ktt1', { approvedRequestId: req.id });
    expect(r.ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8208' } }))!.creditLimit).toBe(0n);
  });

  it('⚠⚠ áp SỐ TIỀN KHÁC số đã duyệt -> từ chối (chống duyệt 50tr rồi áp 500tr)', async () => {
    await seedCustomer('TBS8210', 'sale1');
    const req = await seedCreditRequest('TBS8210', 50_000_000);
    const r = await svc.applyCreditLimit('TBS8210', 500_000_000, 30, 'ktt1', { approvedRequestId: req.id });
    expect(r.ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8210' } }))!.creditLimit).toBe(0n);
  });

  it('phiếu đã XOÁ -> từ chối; form_data hỏng -> từ chối', async () => {
    await seedCustomer('TBS8211', 'sale1');
    const del = await seedCreditRequest('TBS8211', 50_000_000, { isDeleted: true });
    expect((await svc.applyCreditLimit('TBS8211', 50_000_000, 30, 'ktt1', { approvedRequestId: del.id })).ok).toBe(false);
    const bad = await seedCreditRequest('TBS8211', 50_000_000, { formData: '{khong-phai-json' });
    expect((await svc.applyCreditLimit('TBS8211', 50_000_000, 30, 'ktt1', { approvedRequestId: bad.id })).ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8211' } }))!.creditLimit).toBe(0n);
  });

  it('từ chối hạn mức âm và số thực (tiền phải nguyên đồng)', async () => {
    await seedCustomer('TBS8202', 'sale1');
    const req = await seedCreditRequest('TBS8202', 50_000_000);
    expect((await svc.applyCreditLimit('TBS8202', -1, 30, 'ktt1', { approvedRequestId: req.id })).ok).toBe(false);
    expect((await svc.applyCreditLimit('TBS8202', 1_000_000.5, 30, 'ktt1', { approvedRequestId: req.id })).ok).toBe(false);
    expect((await prisma.customer.findUnique({ where: { code: 'TBS8202' } }))!.creditLimit).toBe(0n);
  });
});
