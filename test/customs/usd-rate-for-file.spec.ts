// test/customs/usd-rate-for-file.spec.ts — #08 fix-round-1 + fix-round-2
//
// DeclSourceService.usdRateForFile(fileId) — tái hiện NGUYÊN VĂN
// `tbs_decl_usd_rate($file_id)` (libs/decl_source.php), thang tra tỷ giá
// USD của cont:
//
//   1. tbl_transport_files.usd_rate_closed > 0 -> dùng thẳng (src='cont')
//   2. else nếu closed_at có giá trị: THỬ getRate('USD', date(closed_at)).
//      NẾU >0 -> trả (src='treasury_closed'). NẾU KHÔNG (kể cả 0) —
//      ⚠⚠⚠ RƠI TIẾP xuống rung 3, KHÔNG return sớm. Đây là if KHÔNG có
//      else trong PHP gốc — bản fix-round-1 từng dịch sai thành if/else,
//      khiến rung 3 KHÔNG THỂ CHẠM TỚI mỗi khi closed_at có giá trị dù
//      treasury không có dòng nào khớp ngày đó (CRITICAL, xem
//      task-2-report.md mục "Fix round 2").
//   3. getRate('USD', hôm nay — giờ VIỆT NAM, xem vnDateOnly) -> nếu >0,
//      trả (src='treasury_today'). LUÔN được thử, bất kể rung 2 có chạy
//      hay không.
//   4. else (không tìm được file, HOẶC cả hai rung treasury đều không có
//      dòng khớp): {rate:0, src:'none', date:null}
//
//   getRate(currency, asOf) =
//     SELECT rate_vnd FROM tbl_exchange_rates
//     WHERE currency=? AND rate_date<=? ORDER BY rate_date DESC, id DESC
//     LIMIT 1 -> 0 nếu không có dòng nào.
//
// ⚠ Đo prod 23/09/2026: tbl_exchange_rates 0 DÒNG, usd_rate_closed NULL ở
// CẢ 14/14 cont — nhưng 1/14 cont ĐÃ CÓ closed_at, nên "rung 2 thất bại
// phải rơi xuống rung 3" không phải trường hợp biên lý thuyết, mà là hình
// dạng dữ liệu THẬT trên prod ngay lúc này (chỉ đang thiếu dòng tỷ giá để
// kích hoạt).
import { PrismaService } from '../../src/prisma/prisma.service';
import { DeclSourceService, vnDateOnly } from '../../src/customs/decl-source.service';
import { prisma } from '../helpers/db';
import { resetCustoms, seedExchangeRate } from '../helpers/customs-db';
import { resetWarehouse, seedTransportFile } from '../helpers/warehouse-db';

describe('DeclSourceService.usdRateForFile — #08 fix-round-1/2, thang tra tỷ giá cont', () => {
  const svc = new DeclSourceService(prisma as unknown as PrismaService);

  beforeEach(async () => {
    await resetWarehouse();
    await resetCustoms();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('không tìm thấy cont -> {rate:0, src:"none", date:null}', async () => {
    const r = await svc.usdRateForFile(999_999);
    expect(r).toEqual({ rate: 0, src: 'none', date: null });
  });

  it('⚠⚠ hạng 4 — bảng tỷ giá RỖNG hoàn toàn (đúng trạng thái prod 23/09/2026): không usd_rate_closed, không closed_at, không có dòng exchange_rates -> {rate:0, src:"none", date:null}', async () => {
    const file = await seedTransportFile();
    const r = await svc.usdRateForFile(file.id);
    expect(r).toEqual({ rate: 0, src: 'none', date: null });
  });

  it('hạng 1 — usd_rate_closed>0 THẮNG mọi nguồn treasury, kể cả khi treasury có dữ liệu', async () => {
    const file = await seedTransportFile({ usdRateClosed: 25_555, closedAt: new Date('2026-09-01') });
    // Cố tình seed một dòng treasury khác số, để chứng minh nó KHÔNG được dùng.
    await seedExchangeRate({ currency: 'USD', rateVnd: 24_000, rateDate: new Date('2026-09-01') });

    const r = await svc.usdRateForFile(file.id);
    expect(r).toEqual({ rate: 25_555, src: 'cont', date: null });
  });

  it('hạng 2 — closed_at CÓ giá trị VÀ treasury khớp ngày đó -> dùng luôn, KHÔNG rơi xuống rung 3', async () => {
    const file = await seedTransportFile({ closedAt: new Date('2026-09-10') });
    await seedExchangeRate({ currency: 'USD', rateVnd: 24_800, rateDate: new Date('2026-09-05') });
    // Dòng SAU ngày đóng cont — KHÔNG được chọn (rate_date<=closed_at).
    await seedExchangeRate({ currency: 'USD', rateVnd: 26_000, rateDate: new Date('2026-09-15') });

    const r = await svc.usdRateForFile(file.id);
    expect(r).toEqual({ rate: 24_800, src: 'treasury_closed', date: vnDateOnly(new Date('2026-09-10')) });
  });

  it('⚠⚠ rate_date<=? lấy dòng MỚI NHẤT KHÔNG SAU ngày tra, không phải dòng mới nhất tuyệt đối', async () => {
    const file = await seedTransportFile({ closedAt: new Date('2026-09-10') });
    await seedExchangeRate({ currency: 'USD', rateVnd: 24_000, rateDate: new Date('2026-08-01') }); // cũ hơn
    await seedExchangeRate({ currency: 'USD', rateVnd: 24_800, rateDate: new Date('2026-09-05') }); // mới nhất KHÔNG SAU 09-10 -> phải chọn dòng này
    await seedExchangeRate({ currency: 'USD', rateVnd: 26_000, rateDate: new Date('2026-09-20') }); // mới nhất TUYỆT ĐỐI nhưng SAU 09-10 -> bị loại

    const r = await svc.usdRateForFile(file.id);
    expect(r.rate).toBe(24_800);
    expect(r.src).toBe('treasury_closed');
  });

  it('hạng 3 — KHÔNG có closed_at -> tra treasury theo HÔM NAY (giờ VN, đồng hồ giả lập để không phụ thuộc lúc chạy test)', async () => {
    // Chỉ giả `Date` — KHÔNG giả setTimeout/setImmediate/nextTick, nếu không
// Prisma/pg (dùng timer thật cho I/O mạng) sẽ treo vô thời hạn.
jest
  .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  .setSystemTime(new Date('2026-09-23T04:00:00.000Z')); // 11:00 giờ VN, Sep 23
    const file = await seedTransportFile(); // closedAt để trống
    await seedExchangeRate({ currency: 'USD', rateVnd: 25_100, rateDate: new Date('2026-09-22') }); // hôm qua
    // Dòng NGÀY MAI — không được chọn (rate_date<=hôm nay).
    await seedExchangeRate({ currency: 'USD', rateVnd: 99_999, rateDate: new Date('2026-09-24') });

    const r = await svc.usdRateForFile(file.id);
    expect(r).toEqual({ rate: 25_100, src: 'treasury_today', date: vnDateOnly(new Date('2026-09-23T04:00:00.000Z')) });
  });

  it('⚠ chỉ tra đúng currency=USD — dòng CNY không được lẫn vào dù ngày khớp (cả rung 2 lẫn rung 3)', async () => {
    const file = await seedTransportFile({ closedAt: new Date('2026-09-10') });
    await seedExchangeRate({ currency: 'CNY', rateVnd: 3_500, rateDate: new Date('2026-09-05') });

    const r = await svc.usdRateForFile(file.id);
    expect(r).toEqual({ rate: 0, src: 'none', date: null }); // không có dòng USD nào khớp ở rung nào
  });

  // ⛔⛔⛔ CRITICAL (fix-round-2) — kịch bản THẬT reviewer đo được: 1/14 cont
  // trên prod ĐÃ CÓ closed_at (2026-01-01 trong ca này) trong khi dòng tỷ
  // giá treasury SỚM NHẤT được nạp lại là SAU ngày đó (2026-06-01) — hoàn
  // toàn có thể xảy ra thật (nạp tỷ giá trễ hơn ngày đóng cont). Bản
  // if/else CŨ dừng lại ở rung 2 thất bại và trả 'none' ngay — khiến
  // recalcItemTax ZERO SẠCH thuế của một dòng khai LẼ RA tính được. Bản ĐÃ
  // SỬA phải rơi tiếp xuống rung 3 và tìm thấy dòng 2026-06-01 (vì nó
  // <= hôm nay).
  it('⛔⛔⛔ CRITICAL — rung 2 THẤT BẠI (không dòng nào <= closed_at) PHẢI RƠI TIẾP xuống rung 3, không dừng lại ở "none"', async () => {
    // Chỉ giả `Date` — KHÔNG giả setTimeout/setImmediate/nextTick, nếu không
// Prisma/pg (dùng timer thật cho I/O mạng) sẽ treo vô thời hạn.
jest
  .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  .setSystemTime(new Date('2026-09-23T04:00:00.000Z'));
    const file = await seedTransportFile({ closedAt: new Date('2026-01-01') });
    // Dòng DUY NHẤT — SAU closed_at (rung 2 thất bại) nhưng TRƯỚC hôm nay
    // (rung 3 phải tìm thấy nó).
    await seedExchangeRate({ currency: 'USD', rateVnd: 25_000, rateDate: new Date('2026-06-01') });

    const r = await svc.usdRateForFile(file.id);
    expect(r.src).toBe('treasury_today'); // KHÔNG PHẢI 'none'
    expect(r.rate).toBe(25_000); // KHÔNG PHẢI 0
  });

  it('rung 2 VÀ rung 3 đều thất bại thật sự (không dòng USD nào <= closed_at LẪN <= hôm nay) -> {rate:0, src:"none"}', async () => {
    // Chỉ giả `Date` — KHÔNG giả setTimeout/setImmediate/nextTick, nếu không
// Prisma/pg (dùng timer thật cho I/O mạng) sẽ treo vô thời hạn.
jest
  .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  .setSystemTime(new Date('2026-09-23T04:00:00.000Z'));
    const file = await seedTransportFile({ closedAt: new Date('2026-01-01') });
    // Dòng DUY NHẤT — SAU CẢ closed_at LẪN hôm nay (tương lai xa) -> không
    // rung nào khớp được.
    await seedExchangeRate({ currency: 'USD', rateVnd: 30_000, rateDate: new Date('2099-01-01') });

    const r = await svc.usdRateForFile(file.id);
    expect(r).toEqual({ rate: 0, src: 'none', date: null });
  });

  // ⚠⚠ IMPORTANT 4 (fix-round-2) — "hôm nay" phải là ngày lịch theo GIỜ VIỆT
  // NAM (UTC+7 cố định, không dựa vào TZ hệ điều hành/process), khớp
  // `date('Y-m-d')` của PHP chạy trên máy chủ đặt giờ VN. Giả lập đồng hồ ở
  // một thời điểm UTC mà ngày UTC và ngày VN LỆCH NHAU (20:00 UTC = 03:00
  // giờ VN NGÀY HÔM SAU) — nếu code dùng ngày UTC trần (không cộng offset)
  // sẽ chọn NHẦM dòng của "hôm qua" (theo UTC) thay vì dòng thật của hôm
  // nay (theo VN).
  it('⚠⚠ "hôm nay" tính theo GIỜ VIỆT NAM (UTC+7), không phải ngày UTC trần — 20:00 UTC là đã sang NGÀY MỚI ở VN', async () => {
    // 2026-09-23T20:00:00Z = 2026-09-24 03:00 giờ VN -> "hôm nay" (VN) PHẢI
    // là 24/09, dù ngày UTC trần của thời điểm này vẫn còn là 23/09.
    // Chỉ giả `Date` — KHÔNG giả setTimeout/setImmediate/nextTick, nếu không
// Prisma/pg (dùng timer thật cho I/O mạng) sẽ treo vô thời hạn.
jest
  .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  .setSystemTime(new Date('2026-09-23T20:00:00.000Z'));
    const file = await seedTransportFile();
    // Dòng mà một cài đặt SAI (dùng ngày UTC trần = 23/09) sẽ chọn:
    await seedExchangeRate({ currency: 'USD', rateVnd: 24_000, rateDate: new Date('2026-09-23') });
    // Dòng ĐÚNG (ngày VN thật = 24/09) — phải được chọn thay vì dòng trên.
    await seedExchangeRate({ currency: 'USD', rateVnd: 24_900, rateDate: new Date('2026-09-24') });

    const r = await svc.usdRateForFile(file.id);
    expect(r.rate).toBe(24_900); // KHÔNG PHẢI 24_000 (dòng "hôm qua" theo UTC)
    expect(r.src).toBe('treasury_today');
    expect(r.date).toEqual(new Date(Date.UTC(2026, 8, 24))); // 24/09, không phải 23/09
  });
});

describe('vnDateOnly — quy đổi thời điểm sang NGÀY LỊCH giờ Việt Nam (UTC+7 cố định)', () => {
  it('ngay TRƯỚC mốc chuyển ngày VN (16:59:59.999 UTC) vẫn thuộc ngày UTC hiện tại', () => {
    const d = vnDateOnly(new Date('2026-09-23T16:59:59.999Z'));
    expect(d).toEqual(new Date(Date.UTC(2026, 8, 23)));
  });

  it('ĐÚNG mốc chuyển ngày VN (17:00:00.000 UTC = 00:00:00 giờ VN hôm sau) đã sang ngày MỚI', () => {
    const d = vnDateOnly(new Date('2026-09-23T17:00:00.000Z'));
    expect(d).toEqual(new Date(Date.UTC(2026, 8, 24)));
  });

  it('giữa trưa UTC (không gần mốc chuyển ngày nào) — cùng ngày với UTC', () => {
    const d = vnDateOnly(new Date('2026-09-23T05:00:00.000Z')); // 12:00 giờ VN
    expect(d).toEqual(new Date(Date.UTC(2026, 8, 23)));
  });
});
