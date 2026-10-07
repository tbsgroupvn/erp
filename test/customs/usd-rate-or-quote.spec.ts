// test/customs/usd-rate-or-quote.spec.ts — #08 Task 5, đóng nợ đã biết
//
// DeclSourceService.usdRateOrQuoteForFile() — tái hiện NGUYÊN VĂN
// `tbs_decl_usd_rate_or_quote($file_id, $quote_item_id)` (libs/decl_source.php:657,
// đọc trực tiếp trên prod erp.nhaphangchinhngach.vn 23/09/2026):
//
//   function tbs_decl_usd_rate_or_quote($file_id, $quote_item_id) {
//       $rr = tbs_decl_usd_rate((int)$file_id);
//       $rr['tam'] = false;
//       if (floatval($rr['rate']) > 0) return $rr;
//       $qid = (int)$quote_item_id;
//       if ($qid <= 0) return $rr;                       // không nối báo giá -> chịu, giữ 0
//       ... SELECT q.rate_usd_vnd FROM tbl_quote_items qi
//           JOIN tbl_quotes q ON q.id = qi.quote_id WHERE qi.id = $qid LIMIT 1
//       $rate = $r ? floatval($r['rate_usd_vnd']) : 0.0;
//       if ($rate <= 0) return $rr;
//       return array('rate'=>$rate,'src'=>'quote_tam','date'=>'','tam'=>true);
//   }
//
// ⚠ Hàm này KHÔNG được recalcItemTax() gọi — prod cũng vậy (_tygiaForFile trong
// cls.container.php:726 gọi THẲNG tbs_decl_usd_rate, không phải bản _or_quote).
// Bản _or_quote phục vụ tbs_decl_price_for_quote_item (định giá USD LẦN ĐẦU cho
// dòng khai mới), đường đó NGOÀI phạm vi #08 đợt 1. Test ở đây chỉ chứng minh
// bản thân hàm đúng NGUYÊN VĂN, không đụng recalcItemTax.
import { PrismaService } from '../../src/prisma/prisma.service';
import { DeclSourceService } from '../../src/customs/decl-source.service';
import { prisma } from '../helpers/db';
import { resetCustoms, seedExchangeRate } from '../helpers/customs-db';
import { resetWarehouse, seedTransportFile } from '../helpers/warehouse-db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';

describe('DeclSourceService.usdRateOrQuoteForFile — #08 Task 5, tbs_decl_usd_rate_or_quote', () => {
  const svc = new DeclSourceService(prisma as unknown as PrismaService);

  beforeEach(async () => {
    await resetWarehouse();
    await resetQuote();
    await resetCustoms();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('nấc 1 — thang gốc (usdRateForFile) đã ra rate>0 (cont thủ công) -> trả NGUYÊN, tam=false, KHÔNG đụng quoteItemId dù truyền gì', async () => {
    const file = await seedTransportFile({ usdRateClosed: 25000 });
    const quote = await seedQuote('ZZ-USDQ-1');
    const qItem = await seedItem(quote.id, { }); // quote.rateUsdVnd mặc định 25400 — PHẢI bị bỏ qua

    const r = await svc.usdRateOrQuoteForFile(file.id, qItem.id);
    expect(r).toEqual({ rate: 25000, src: 'cont', date: null, tam: false });
  });

  it('nấc 2 — thang gốc ra rate=0 (none) và quoteItemId<=0 -> giữ nguyên {rate:0,src:none}, tam=false', async () => {
    const file = await seedTransportFile(); // không usdRateClosed, không closedAt, không exchange rate nào
    const r = await svc.usdRateOrQuoteForFile(file.id, 0);
    expect(r).toEqual({ rate: 0, src: 'none', date: null, tam: false });
  });

  it('nấc 3 — thang gốc ra rate=0, quoteItemId>0 trỏ tới báo giá có rate_usd_vnd>0 -> LÙI VỀ báo giá, src=quote_tam, tam=true', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-USDQ-3', { rateUsdVnd: 25400 });
    const qItem = await seedItem(quote.id, {});

    const r = await svc.usdRateOrQuoteForFile(file.id, qItem.id);
    expect(r).toEqual({ rate: 25400, src: 'quote_tam', date: null, tam: true });
  });

  it('nấc 3b — quoteItemId trỏ tới báo giá có rate_usd_vnd<=0 -> KHÔNG lùi được, giữ nguyên rate=0/src=none, tam=false', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-USDQ-3B', { rateUsdVnd: 0 });
    const qItem = await seedItem(quote.id, {});

    const r = await svc.usdRateOrQuoteForFile(file.id, qItem.id);
    expect(r).toEqual({ rate: 0, src: 'none', date: null, tam: false });
  });

  it('nấc 3c — quoteItemId không tồn tại -> KHÔNG lùi được, giữ nguyên rate=0/src=none, tam=false', async () => {
    const file = await seedTransportFile();
    const r = await svc.usdRateOrQuoteForFile(file.id, 999999);
    expect(r).toEqual({ rate: 0, src: 'none', date: null, tam: false });
  });

  it('nấc 3d — fileId THẬM CHÍ không tồn tại nhưng quoteItemId hợp lệ -> vẫn lùi về báo giá được (hai điều kiện ĐỘC LẬP nhau, đúng prod)', async () => {
    const quote = await seedQuote('ZZ-USDQ-3D', { rateUsdVnd: 26000 });
    const qItem = await seedItem(quote.id, {});

    const r = await svc.usdRateOrQuoteForFile(999999, qItem.id);
    expect(r).toEqual({ rate: 26000, src: 'quote_tam', date: null, tam: true });
  });

  it('nấc 1b — thang gốc ra rate>0 qua treasury_today (không phải cont) -> vẫn trả nguyên nấc đó, tam=false', async () => {
    const file = await seedTransportFile();
    await seedExchangeRate({ rateVnd: 24800, rateDate: new Date('2020-01-01') }); // <= hôm nay chắc chắn
    const quote = await seedQuote('ZZ-USDQ-1B', { rateUsdVnd: 99999 }); // PHẢI bị bỏ qua vì nấc gốc đã thành công
    const qItem = await seedItem(quote.id, {});

    const r = await svc.usdRateOrQuoteForFile(file.id, qItem.id);
    expect(r.rate).toBe(24800);
    expect(r.src).toBe('treasury_today');
    expect(r.tam).toBe(false);
  });
});
