/**
 * L13 Task 2 — GIẢ LẬP GHI MỚI trên v2 cho tổng duyệt khứ hồi: gọi CHÍNH các service v2 (TreasuryService,
 * BankIngestService, SupplierPaymentService + ReturnService) trên PrismaClient của CSDL DIỄN TẬP.
 *
 * ⛔ Chỉ chạy trên `*_rehearsal`: người gọi đã qua `assertRehearsalTarget`; hàm này tự kiểm lại
 *    `current_database()` TRƯỚC mọi ghi (lớp thứ hai). Dữ liệu giả lập TỰ DỰNG (tiền tố RTL13/rtl13_),
 *    không lấy từ prod; không in STK / nội dung chuyển khoản / giá trị dòng.
 * ⛔ Cổng quyền/danh tính của service thay bằng stub TRONG tiến trình (đích diễn tập chưa có user/vai #01),
 *    đúng cách `src/rehearsal/gates` làm: `perm.scopeOf` = 'all', `scope.buildDocScope` = {} (mọi phiếu),
 *    `SupplierPaymentService.actor(uid)` = bảng danh tính cố định dưới đây. GL (#03 chưa nạp) = stub
 *    `postBiz` → 'skipped' (GL không thuộc 17 bảng chép ngược).
 *
 * v2 CHƯA có service TẠO phiếu FX / phiếu thanh toán NCC (09c L8, 09a đợt sau) ⇒ hai phiếu gốc là
 * FIXTURE tạo bằng Prisma (ghi rõ trong `gaps`); mọi thao tác NGHIỆP VỤ trên chúng (fxGhiSoPhieu,
 * returnDoc/resubmitDoc, postPaymentEntry) đi qua service thật. Không có câu SQL tay nào ghi dữ liệu.
 *
 * Cố ý có HAI thao tác nghiệp vụ bình thường đụng dòng TRƯỚC cutover (phải ra exit 5 ở chép ngược):
 *  - trả chứng từ + nộp lại một phiếu NCC có sẵn ⇒ `tbl_payment` bị UPDATE (mdate, ncc_bank_note);
 *  - xoá một phiếu NCC có sẵn chưa duyệt ĐÃ có trạng thái trả từ trước (`SupplierPaymentService.delete` —
 *    DELETE cứng, cascade `tbl_payment_orders`, dọn `tbl_return_state` qua ReturnService.clear).
 */
import { PrismaService } from '../../prisma/prisma.service';
import { PermService } from '../../iam/perm.service';
import { ScopeService } from '../../iam/scope.service';
import { TreasuryService } from '../../money/treasury.service';
import { GlMapService } from '../../money/gl-map.service';
import { BankIngestService } from '../../bank/bank-ingest.service';
import { ReturnService } from '../../approval/return.service';
import { SupplierPaymentService, phpTrim } from '../../supplier-payment/supplier-payment.service';
import { EtlSafeError } from '../etl/convert';
import { ExpectedFlags, SimStep, SimulationResult } from './types';

type Actor = { username: string; gid: number | null };

/** uid giả lập — chỉ tồn tại trong bảng danh tính stub của tiến trình này. */
export const SIM_UID = { ketoan: 913001, sale: 913002, chuPhieuCu: 913003 } as const;
export const SIM_USER = { ketoan: 'rtl13_ketoan', sale: 'rtl13_sale' } as const;

export interface SimServices {
  treasury: TreasuryService;
  returns: ReturnService;
  payments: SupplierPaymentService;
  bank: BankIngestService;
  actors: Map<number, Actor>;
}

export function buildSimServices(p: PrismaService): SimServices {
  const treasury = new TreasuryService(p);
  const returns = new ReturnService(p);
  const perm = { scopeOf: async () => 'all' } as unknown as PermService;
  const scope = { buildDocScope: async () => ({}) } as unknown as ScopeService;
  const payments = new SupplierPaymentService(p, scope, returns, perm);
  const actors = new Map<number, Actor>([
    [SIM_UID.ketoan, { username: SIM_USER.ketoan, gid: null }],
    [SIM_UID.sale, { username: SIM_USER.sale, gid: null }],
  ]);
  (payments as unknown as { actor: (uid: number) => Promise<Actor | null> }).actor = async (uid) => actors.get(uid) ?? null;
  const gl = { postBiz: async () => ({ status: 'skipped' }) } as unknown as GlMapService;
  const bank = new BankIngestService(p, treasury, gl);
  return { treasury, returns, payments, bank, actors };
}

const ids = (xs: (number | bigint | string)[]) => xs.map((x) => String(x));

/** 'YYYY-MM-DD HH:MM:SS' giờ VN (SePay gửi giờ máy chủ). */
function vnNow(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}
const nowSec = () => Math.floor(Date.now() / 1000);

export async function simulateV2Writes(p: PrismaService, expectedDb: string): Promise<SimulationResult> {
  const db = (await p.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db'))[0]?.db;
  if (db !== expectedDb || !String(db).endsWith('_rehearsal')) {
    throw new EtlSafeError(`giả lập v2: current_database()="${String(db)}" không phải CSDL diễn tập "${expectedDb}" — TỪ CHỐI ghi.`);
  }
  const sv = buildSimServices(p);
  const steps: SimStep[] = [];
  const gaps: string[] = [
    'v2 CHƯA có service TẠO phiếu FX (09c L8) ⇒ phiếu FX-RTL13-001 là fixture Prisma; ghi sổ qua TreasuryService.fxGhiSoPhieu (thật).',
    'v2 CHƯA có service TẠO phiếu thanh toán NCC (09a chỉ có đọc/xoá/trả/nộp lại) ⇒ phiếu RTL13-DH-0001 + 1 dòng tbl_payment_orders là fixture Prisma; trả/nộp lại/ghi sổ chi qua service thật.',
    'v2 CHƯA có service DUYỆT (confirm) phiếu NCC ⇒ "sửa dòng trước cutover" dùng luồng thật trả chứng từ + nộp lại (SupplierPaymentService.returnDoc/resubmitDoc) trên một phiếu có sẵn.',
    'GL (#03) chưa nạp ⇒ BankIngestService dùng stub GlMapService.postBiz → skipped (GL không thuộc 17 bảng chép ngược).',
  ];

  // ── danh mục quỹ (đọc) — chọn theo tệ, không in STK.
  const accs = await p.fundAccount.findMany({ where: { isActive: 1 }, orderBy: { id: 'asc' } });
  const vnd = accs.filter((a) => a.currency === 'VND');
  const cny = accs.find((a) => a.currency === 'CNY');
  const bankAcc = accs.find((a) => a.stk !== '');
  if (vnd.length < 2 || !cny || !bankAcc) throw new EtlSafeError('giả lập v2: thiếu ví VND×2 / CNY / ví có STK đang bật');

  // ── chọn TRƯỚC khi tạo fixture: 2 phiếu NCC có sẵn (dòng trước cutover), chưa duyệt, chưa có trạng thái trả.
  const pre = await p.supplierPayment.findMany({
    where: { confirm: 'no', saler: { not: null } },
    orderBy: { id: 'desc' },
    select: { id: true, saler: true, _count: { select: { orders: true } } },
    take: 200,
  });
  const states = new Set(
    (await p.returnState.findMany({ where: { objectType: 'payment', objectId: { in: pre.map((x) => x.id) } }, select: { objectId: true } }))
      .map((x) => x.objectId),
  );
  const cands = pre.filter((x) => !states.has(x.id) && phpTrim(x.saler ?? '') !== '');
  // Phiếu XOÁ: có sẵn, chưa duyệt, ĐÃ có tbl_return_state từ trước (+ ưu tiên có tbl_payment_orders) ⇒ delete()
  // phải kéo theo cascade orders VÀ dọn trạng thái trả — cả ba đều là dòng trước cutover, phải được báo xoá.
  const statePayIds = (await p.returnState.findMany({ where: { objectType: 'payment' }, select: { objectId: true } })).map((x) => x.objectId);
  const delCands = await p.supplierPayment.findMany({
    where: { confirm: 'no', id: { in: statePayIds } },
    orderBy: { id: 'desc' },
    select: { id: true, _count: { select: { orders: true } } },
  });
  const pDel = delCands.find((x) => x._count.orders > 0) ?? delCands[0];
  const pEdit = cands[0];
  if (!pDel || !pEdit) throw new EtlSafeError('giả lập v2: không tìm được phiếu NCC có sẵn chưa duyệt để sửa (không trạng thái trả) / xoá (có trạng thái trả)');
  sv.actors.set(SIM_UID.chuPhieuCu, { username: phpTrim(pEdit.saler ?? ''), gid: null });

  // S1 + S2 — sổ quỹ: 3 bút toán mới (2 vào số dư, 1 treo) + đảo theo nguồn.
  const s1 = await p.$transaction(async (tx) => {
    const thu = await sv.treasury.postEntry(tx, vnd[0].code, 'in', '12345678.90', {
      status: 1, cuser: SIM_USER.ketoan, approveUser: SIM_USER.ketoan, rate: '1',
      sourceModule: 'rtl13_thu', sourceId: 13001, note: 'RTL13 khứ hồi — thu tự dựng',
    });
    const chi = await sv.treasury.postEntry(tx, vnd[1].code, 'out', '2345678.12', {
      status: 1, cuser: SIM_USER.ketoan, approveUser: SIM_USER.ketoan, rate: '1',
      sourceModule: 'rtl13_chi', sourceId: 13002, note: 'RTL13 khứ hồi — chi tự dựng',
    });
    const treo = await sv.treasury.postEntry(tx, vnd[0].code, 'out', '999000', {
      status: 0, cuser: SIM_USER.ketoan, sourceModule: 'rtl13_treo', sourceId: 13003, note: 'RTL13 khứ hồi — treo (status 0)',
    });
    const dao = await sv.treasury.daoTheoNguon(tx, 'rtl13_chi', 13002, 'RTL13 khứ hồi — đảo thử', SIM_USER.ketoan);
    const daoIds = (await tx.treasuryEntry.findMany({ where: { reversalOf: { in: dao.idsDaDao } }, select: { id: true } })).map((r) => r.id);
    return { thu, chi, treo, dao, daoIds };
  });
  steps.push({
    id: 'S1', title: 'sổ quỹ: 2 bút toán status=1 + 1 bút toán treo', via: 'TreasuryService.postEntry',
    ok: s1.thu > 0 && s1.chi > 0 && s1.treo > 0, ids: { tbl_account_histories: ids([s1.thu, s1.chi, s1.treo]) },
  });
  steps.push({
    id: 'S2', title: 'đảo bút toán chi theo nguồn', via: 'TreasuryService.daoTheoNguon',
    ok: s1.dao.daDao === 1 && s1.daoIds.length === 1, ids: { tbl_account_histories: ids(s1.daoIds) },
  });

  // S3 — FX: phiếu tự dựng (fixture) + ghi sổ qua cửa DUY NHẤT fxGhiSoPhieu. rate 6 số lẻ ⇒ ép 6→2 khi chép ngược.
  const now = nowSec();
  const fx = await p.fxTransfer.create({
    data: {
      code: 'FX-RTL13-001', fromTk: vnd[0].code, toTk: cny.code, fromCurrency: 'VND', toCurrency: 'CNY',
      amountOut: '3612345.68', amountIn: '1000', rate: '3612.345678', fee: '0', feeCurrency: '',
      note: 'RTL13 khứ hồi — phiếu FX tự dựng', status: 'approved', createdBy: SIM_USER.sale, createdAt: now,
      approvedBy: SIM_USER.sale, approvedAt: now,
    },
    select: { id: true },
  });
  const fxRes = await p.$transaction((tx) => sv.treasury.fxGhiSoPhieu(tx, fx.id, SIM_USER.sale, { choAm: true }));
  const fxLegs = (await p.treasuryEntry.findMany({ where: { sourceModule: 'fx_transfer', sourceId: fx.id }, select: { id: true }, orderBy: { id: 'asc' } }))
    .map((r) => r.id);
  steps.push({
    id: 'S3', title: 'phiếu FX VND→CNY: ghi sổ 2 chân', via: 'fixture Prisma (FxTransfer) + TreasuryService.fxGhiSoPhieu',
    ok: fxRes.chang1 === 'moi' && fxLegs.length === 2, ids: { tbl_fx_transfers: ids([fx.id]), tbl_account_histories: ids(fxLegs) },
  });

  // S4 — ngân hàng: 2 giao dịch SePay tự dựng (tiền về nội bộ ⇒ sổ + chi tiết; tiền ra ⇒ chi tiết "ẩn").
  const bIn = await sv.bank.ingest({
    id: 'RT13IN01', gateway: 'RTL13BANK', transactionDate: vnNow(), accountNumber: bankAcc.stk,
    transferType: 'in', transferAmount: 5000000, content: 'RTL13 chuyen tien noi bo dien tap khu hoi',
  });
  const bOut = await sv.bank.ingest({
    id: 'RT13OUT01', gateway: 'RTL13BANK', transactionDate: vnNow(), accountNumber: bankAcc.stk,
    transferType: 'out', transferAmount: 750000, content: 'RTL13 thanh toan dien tap khu hoi',
  });
  const btIds = [bIn.bankTxId, bOut.bankTxId].filter((x): x is number => x !== undefined);
  const details = (await p.bankTransactionDetail.findMany({ where: { tranId: { in: btIds.map((x) => BigInt(x)) } }, select: { id: true } }))
    .map((r) => r.id);
  steps.push({
    id: 'S4', title: 'SePay: tiền về nội bộ (ghi sổ) + tiền ra', via: 'BankIngestService.ingest',
    ok: bIn.status === 'posted' && bOut.status === 'recorded' && details.length === 2,
    ids: { tbl_bank_transaction: ids(btIds), tbl_bank_transaction_detail: ids(details), tbl_account_histories: ids(bIn.histId ? [bIn.histId] : []) },
    note: `ingest in=${bIn.status}${bIn.classify ? '/' + bIn.classify : ''} out=${bOut.status}${bOut.classify ? '/' + bOut.classify : ''}`,
  });

  // S5 — phiếu NCC tự dựng: trả chứng từ → nộp lại (sửa 2 trường) → ghi sổ chi.
  const pay = await p.supplierPayment.create({
    data: {
      cdate: now, priceCyn: '1500.00', currency: 'CNY', rateBuy: 3600, saler: SIM_USER.sale, from: 'Khác', source: '',
      codeOrder: 'RTL13-DH-0001', orderId: 0, note: 'RTL13 khứ hồi — phiếu NCC tự dựng', payment: 'no', status: 'no',
      confirm: 'no', poId: 0, payType: '', accountCode: vnd[0].code, nccReceiver: 'RTL13 NCC', nccBankName: 'RTL13 BANK',
      nccBankNote: 'RTL13 ghi chu', nccPayChannel: 'bank',
      orders: { create: [{ orderId: 0, rmb: '1500.00', cdate: now }] },
    },
    select: { id: true, orders: { select: { id: true } } },
  });
  await sv.payments.returnDoc(SIM_UID.ketoan, pay.id, 'khac', 'RTL13 khứ hồi — trả thử');
  const rs = await sv.payments.resubmitDoc(SIM_UID.sale, pay.id, {
    fields: { ncc_bank_note: 'RTL13 ghi chu da sua', price_cyn: '1600.00' }, note: 'RTL13 nộp lại',
  });
  const payHist = await p.$transaction((tx) => sv.treasury.postPaymentEntry(tx, pay.id, SIM_USER.ketoan));
  const payState = await p.returnState.findMany({ where: { objectType: 'payment', objectId: pay.id }, select: { id: true } });
  const payLogs = await p.supplierPaymentLog.findMany({ where: { paymentId: pay.id }, select: { id: true } });
  steps.push({
    id: 'S5', title: 'phiếu NCC mới: trả chứng từ → nộp lại → ghi sổ chi',
    via: 'fixture Prisma (SupplierPayment + 1 PaymentOrder) + SupplierPaymentService.returnDoc/resubmitDoc + TreasuryService.postPaymentEntry',
    ok: rs.state === 'resubmitted' && rs.changed.length === 2 && payHist > 0,
    ids: {
      tbl_payment: ids([pay.id]), tbl_payment_orders: ids(pay.orders.map((o) => o.id)), tbl_return_state: ids(payState.map((x) => x.id)),
      tbl_payment_log: ids(payLogs.map((x) => x.id)), tbl_account_histories: ids([payHist]),
    },
  });

  // S6 — SỬA DÒNG TRƯỚC CUTOVER bằng nghiệp vụ bình thường: trả + nộp lại phiếu NCC có sẵn.
  await sv.payments.returnDoc(SIM_UID.ketoan, pEdit.id, 'sai_stk', 'RTL13 khứ hồi — trả phiếu có sẵn');
  const rsOld = await sv.payments.resubmitDoc(SIM_UID.chuPhieuCu, pEdit.id, {
    fields: { ncc_bank_note: 'RTL13 — sửa trên v2 (diễn tập khứ hồi)' }, note: 'RTL13 nộp lại phiếu có sẵn',
  });
  const editState = await p.returnState.findMany({ where: { objectType: 'payment', objectId: pEdit.id }, select: { id: true } });
  steps.push({
    id: 'S6', title: 'SỬA dòng trước cutover: trả chứng từ + nộp lại phiếu NCC có sẵn (UPDATE tbl_payment)',
    via: 'SupplierPaymentService.returnDoc/resubmitDoc',
    ok: rsOld.state === 'resubmitted' && rsOld.changed.join(',') === 'ncc_bank_note',
    ids: { tbl_payment: ids([pEdit.id]), tbl_return_state: ids(editState.map((x) => x.id)) },
  });

  // S7 — XOÁ CỨNG dòng trước cutover: phiếu NCC có sẵn chưa duyệt (cascade tbl_payment_orders).
  const delOrders = (await p.supplierPaymentOrder.findMany({ where: { paymentId: pDel.id }, select: { id: true } })).map((x) => x.id);
  const delStates = (await p.returnState.findMany({ where: { objectType: 'payment', objectId: pDel.id }, select: { id: true } })).map((x) => x.id);
  const del = await sv.payments.delete(SIM_UID.ketoan, pDel.id);
  const left = await p.supplierPaymentOrder.count({ where: { paymentId: pDel.id } });
  steps.push({
    id: 'S7', title: 'XOÁ CỨNG dòng trước cutover: phiếu NCC chưa duyệt (+ cascade tbl_payment_orders + dọn tbl_return_state)',
    via: 'SupplierPaymentService.delete',
    ok: del.deleted === true && left === 0 && delStates.length > 0 &&
      (await p.returnState.count({ where: { objectType: 'payment', objectId: pDel.id } })) === 0,
    ids: { tbl_payment: ids([pDel.id]), tbl_payment_orders: ids(delOrders), tbl_return_state: ids(delStates) },
  });

  const expected: ExpectedFlags = {
    modified: [{ table: 'tbl_payment', id: String(pEdit.id), columns: ['mdate', 'ncc_bank_note'] }],
    deleted: [
      { table: 'tbl_payment', id: String(pDel.id) },
      ...delOrders.map((id) => ({ table: 'tbl_payment_orders', id: String(id) })),
      ...delStates.map((id) => ({ table: 'tbl_return_state', id: String(id) })),
    ],
    coerced: fxLegs.map((id) => ({ table: 'tbl_account_histories', id: String(id) })),
  };
  return { steps, expected, gaps };
}
