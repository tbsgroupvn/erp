// #09d L11, Task 1 — HÀM THUẦN của đường ĐỌC sổ quỹ (`src/treasury/report-rules.ts`).
// Đặc tả: docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §2.1 (tbs_sk_loc/tbs_sk_so), §2.2 (nhãn,
//         số dư chạy), §3.1 (dieuKienHoFx :1159-1164 nguyên văn), §7.3 (clusterSuspectDuplicates),
//         §9 (danh sách hàm).
//
// ⛔ Không có dòng tiền prod nào ở đây — mọi số là số tự chọn để phủ từng nhánh.
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db';
import {
  chieuDong,
  clusterSuspectDuplicates,
  dieuKienHoFxSql,
  laHoFx,
  noiDungDong,
  nhanNguon,
  soDuChay,
  tbsSkLoc,
  tbsSkLocPhu,
  tbsSkSo,
  trangThai,
  vnEpoch,
} from '../../src/treasury/report-rules';

const D = (v: string | number) => new Prisma.Decimal(v);
const s = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed());

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// dieuKienHoFxSql / laHoFx — :1159-1164 nguyên văn
// ─────────────────────────────────────────────────────────────────────────────
describe('dieuKienHoFxSql — nguyên văn :1159-1164', () => {
  it('văn bản SQL: IN 6 mã, LIKE thoát `_` bằng `\\_`, loại daoxoa_fx_fee', () => {
    const sql = dieuKienHoFxSql('h');
    expect(sql.sql).toBe(
      "(h.source_module IN ('transfer','fx_transfer','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh')"
        + " OR h.source_module LIKE 'fx\\_huy%'"
        + " OR (h.source_module LIKE 'daoxoa\\_fx\\_%' AND h.source_module NOT LIKE 'daoxoa\\_fx\\_fee%'))",
    );
    expect(sql.values).toEqual([]);
  });

  it('alias được làm sạch như preg_replace(/[^a-z0-9_]/i) — không tiêm được SQL', () => {
    expect(dieuKienHoFxSql('h; DROP TABLE x--').sql.startsWith('(hDROPTABLEx.source_module IN')).toBe(true);
    expect(dieuKienHoFxSql().sql.startsWith('(h.source_module IN')).toBe(true); // mặc định 'h'
    expect(dieuKienHoFxSql('acc_2').sql).toContain('acc_2.source_module LIKE');
  });

  // Chạy THẬT trên Postgres (SELECT trên VALUES — không đụng bảng nào): `_` trong LIKE phải là ký tự
  // thường nhờ `\_`; nếu thoát hỏng thì `fxXhuy`/`daoxoaXfxX…` lọt vào họ FX.
  const MAU: [string, boolean][] = [
    ['transfer', true], ['fx_transfer', true], ['fx_quydoi', true], ['fx_transfer_dao', true],
    ['fx_transfer_lai', true], ['fx_dieuchinh', true],
    ['fx_huy', true], ['fx_huy_phi', true], ['fx_huy_nhan', true],
    ['daoxoa_fx_transfer', true], ['daoxoa_fx_quydoi', true], ['daoxoa_fx_dieuchinh', true],
    ['daoxoa_fx_fee', false], ['daoxoa_fx_fee_x', false],
    ['fx_fee', false], ['', false], ['manual', false], ['payment', false], ['bank_tx', false],
    ['thu_chi_tbs', false], ['daoxoa_thu_chi_tbs', false], ['phi_nh', false],
    ['fxXhuy', false], ['fxAhuyB', false], ['daoxoaXfxXtransfer', false], ['daoxoa_fxXtransfer', false],
    ['tranfer', false], ['FX_TRANSFER', false],
  ];

  it('Postgres thực thi đúng: `_` là ký tự thường, không phải ký tự đại diện', async () => {
    const values = Prisma.join(MAU.map(([m]) => Prisma.sql`(${m}::text)`));
    const rows = await prisma.$queryRaw<{ source_module: string }[]>(
      Prisma.sql`SELECT h.source_module FROM (VALUES ${values}) AS h(source_module) WHERE ${dieuKienHoFxSql('h')} ORDER BY 1`,
    );
    const got = rows.map((r) => r.source_module).sort();
    const want = MAU.filter(([, b]) => b).map(([m]) => m).sort();
    expect(got).toEqual(want);
  });

  it.each(MAU)('laHoFx(%j) = %s — cùng luật trong bộ nhớ', (m, b) => {
    expect(laHoFx(m)).toBe(b);
  });

  it('laHoFx(null/undefined) = false', () => {
    expect(laHoFx(null)).toBe(false);
    expect(laHoFx(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nhanNguon — bảng 24 mã :59-89
// ─────────────────────────────────────────────────────────────────────────────
describe('nhanNguon — bảng 24 mã (:59-89)', () => {
  const BANG: [string, string, string][] = [
    ['', 'SỔ QUỸ', '#64748b'],
    ['manual', 'SỔ QUỸ', '#64748b'],
    ['payment', 'PHIẾU CHI', '#b3441f'],
    ['chiphi', 'CHI PHÍ', '#8a6414'],
    ['bank_tx', 'BANK', '#177a4e'],
    ['bank', 'BANK', '#177a4e'],
    ['thu_chi_tbs', 'THU/CHI TBS', '#0f766e'],
    ['transfer', 'LUÂN CHUYỂN', '#1e40af'],
    ['fx_transfer', 'LC NGOẠI TỆ', '#1e40af'],
    ['fx_transfer_dao', 'ĐẢO LC NGOẠI TỆ', '#7c3aed'],
    ['fx_transfer_lai', 'LÃI LC NGOẠI TỆ', '#1e40af'],
    ['fx_dieuchinh', 'ĐIỀU CHỈNH LC', '#b45309'],
    ['daoxoa_fx_dieuchinh', 'ĐẢO ĐIỀU CHỈNH LC', '#7c3aed'],
    ['fx_fee', 'PHÍ LUÂN CHUYỂN', '#8a6414'],
    ['fx_quydoi', 'QUY ĐỔI AGENT', '#b45309'],
    ['daoxoa_fx_quydoi', 'ĐẢO QUY ĐỔI AGENT', '#7c3aed'],
    ['phi_nh', 'PHÍ NGÂN HÀNG', '#8a6414'],
    ['daoxoa_phi_nh', 'ĐẢO PHÍ NH', '#7c3aed'],
    ['fx_huy', 'HUỶ LUÂN CHUYỂN', '#7c3aed'],
    ['fx_huy_phi', 'HUỶ PHÍ LC', '#7c3aed'],
    ['fx_huy_nhan', 'HUỶ NHẬN LC', '#7c3aed'],
    ['daoxoa_fx_transfer', 'ĐẢO/XOÁ LC', '#7c3aed'],
    ['daoxoa_thu_chi_tbs', 'ĐẢO/XOÁ THU CHI', '#7c3aed'],
    ['daoxoa_fx_fee', 'ĐẢO/XOÁ PHÍ LC', '#7c3aed'],
  ];
  it('bảng có ĐÚNG 24 mã', () => {
    expect(BANG.length).toBe(24);
    expect(new Set(BANG.map((b) => b[0])).size).toBe(24);
  });
  it.each(BANG)('nhanNguon(%j) = [%s, %s]', (ma, nhan, mau) => {
    expect(nhanNguon(ma)).toEqual([nhan, mau]);
  });
  it('mã có khoảng trắng hai đầu được trim trước khi tra (`trim((string)$ma)`)', () => {
    expect(nhanNguon('  payment ')).toEqual(['PHIẾU CHI', '#b3441f']);
    expect(nhanNguon(null)).toEqual(['SỔ QUỸ', '#64748b']);
  });
  it('mã LẠ ⇒ mb_strtoupper(mã) + màu xám #64748b', () => {
    expect(nhanNguon('abc_xyz')).toEqual(['ABC_XYZ', '#64748b']);
    expect(nhanNguon(' hoàn_tiền ')).toEqual(['HOÀN_TIỀN', '#64748b']);
    // Tra bảng phân biệt hoa/thường như isset($B[$k]) ⇒ 'PAYMENT' là mã lạ.
    expect(nhanNguon('PAYMENT')).toEqual(['PAYMENT', '#64748b']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// chieuDong / trangThai — :75-82
// ─────────────────────────────────────────────────────────────────────────────
describe('chieuDong (:75-78)', () => {
  it('type tranfer ⇒ "Chuyển đi" bất kể dấu', () => {
    expect(chieuDong('tranfer', D('500'))).toBe('Chuyển đi');
    expect(chieuDong('tranfer', D('-500'))).toBe('Chuyển đi');
  });
  it('còn lại theo dấu: money ≥ 0 ⇒ Tiền vào (kể cả 0 và null), < 0 ⇒ Tiền ra', () => {
    expect(chieuDong('in', D('1'))).toBe('Tiền vào');
    expect(chieuDong('out', D('0'))).toBe('Tiền vào');
    expect(chieuDong('out', null)).toBe('Tiền vào');
    expect(chieuDong('in', D('-0.00001'))).toBe('Tiền ra');
    expect(chieuDong(null, '-3')).toBe('Tiền ra');
    expect(chieuDong('transfer', D('-1'))).toBe('Tiền ra'); // chỉ 'tranfer' (sic) mới là "Chuyển đi"
  });
});

describe('trangThai (:79-82)', () => {
  it.each([
    [1, 'Đã ghi sổ'], [0, 'Chờ ghi sổ'], [9, 'Đã huỷ'], [2, 'Trạng thái 2'], [-1, 'Trạng thái -1'],
    [null, 'Chờ ghi sổ'], // intval(null) = 0
    ['1', 'Đã ghi sổ'],
  ])('trangThai(%j) = %s', (st, want) => {
    expect(trangThai(st as any)).toBe(want);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// soDuChay — :65-72
// ─────────────────────────────────────────────────────────────────────────────
describe('soDuChay (:65-72) — cộng dồn Decimal, dòng status≠1 có soDu=null và KHÔNG đổi số dư', () => {
  it('cộng dồn theo thứ tự đầu vào; 0/9/null không vào số dư', () => {
    const rows = [
      { id: 1, status: 1, money: D('100.5') },
      { id: 2, status: 0, money: D('999') },
      { id: 3, status: 1, money: D('-40.25') },
      { id: 4, status: 9, money: D('-888') },
      { id: 5, status: null, money: D('7') },
      { id: 6, status: 1, money: null },
      { id: 7, status: 1, money: D('0.1') },
      { id: 8, status: 1, money: D('0.2') },
    ];
    const out = soDuChay(D('-1000'), rows);
    expect(out.map((r) => [r.id, s(r.soDu)])).toEqual([
      [1, '-899.5'], [2, null], [3, '-939.75'], [4, null], [5, null], [6, '-939.75'], [7, '-939.65'], [8, '-939.45'],
    ]);
    // Decimal — không có sai số float kiểu 0.1+0.2 (prod lệch tối đa 1,9e-6, §0.1).
    expect(out[7].soDu!.toFixed()).toBe('-939.45');
  });
  it('không đụng mảng đầu vào; mảng rỗng ⇒ rỗng', () => {
    const rows = [{ status: 1, money: D('1') }];
    const out = soDuChay(D('0'), rows);
    expect((rows[0] as any).soDu).toBeUndefined();
    expect(out[0].soDu!.toFixed()).toBe('1');
    expect(soDuChay(D('5'), [])).toEqual([]);
  });
  it('status dạng chuỗi "1" vẫn tính (intval)', () => {
    expect(soDuChay(D('0'), [{ status: '1' as any, money: '2.5' }])[0].soDu!.toFixed()).toBe('2.5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tbsSkSo — :21-27
// ─────────────────────────────────────────────────────────────────────────────
describe('tbsSkSo (:21-27)', () => {
  it.each([
    ['', null],
    ['   ', null],
    [undefined, null],
    [null, null],
    ['1.234,5', '1234.5'],      // có ',' ⇒ bỏ '.' rồi ',' → '.'
    ['1,5', '1.5'],
    ['1.234.567', '1234567'],   // nhiều '.' ⇒ bỏ '.'
    ['1234.5', '1234.5'],       // một '.' ⇒ giữ (số thuần)
    ['  42 ', '42'],
    ['-12,75', '-12.75'],
    ['+5', '5'],
    ['1e3', '1000'],            // is_numeric nhận số mũ
    ['.5', '0.5'],
    ['5.', '5'],
    ['abc', null],
    ['12abc', null],
    ['1,234,5', null],          // str_replace mọi ',' ⇒ '1.234.5' không phải số
    ['0x1A', null],
    ['1 000', null],
    ['.', null],
    ['-', null],
  ])('tbsSkSo(%j) = %j', (inp, want) => {
    expect(s(tbsSkSo(inp as any))).toBe(want);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tbsSkLoc — :30-56 (mặc định ngày theo giờ VN)
// ─────────────────────────────────────────────────────────────────────────────
describe('tbsSkLoc (:30-56)', () => {
  // 2026-09-30 18:30 UTC = 2026-10-01 01:30 giờ VN ⇒ mặc định phải là THÁNG 10, không phải tháng 9.
  const NOW = new Date('2026-09-30T18:30:00Z');

  it('mặc định: ngày theo giờ VN (UTC+7), không theo UTC của máy', () => {
    const L = tbsSkLoc({}, NOW);
    expect(L).toEqual({
      tk: '', fdate: '2026-10-01', tdate: '2026-10-01', chieu: '', nguon: '__all', tt: '1', q: '',
      min: null, max: null, loai: '', bank: '', sort: 'desc', trang: 1, moiTrang: 200,
    });
    // 16:59 UTC = 23:59 VN cùng ngày 30/09.
    expect(tbsSkLoc({}, new Date('2026-09-30T16:59:00Z')).fdate).toBe('2026-09-01');
    expect(tbsSkLoc({}, new Date('2026-09-30T16:59:00Z')).tdate).toBe('2026-09-30');
  });

  it('mặc định dùng giờ hệ thống khi không truyền now', () => {
    const L = tbsSkLoc({});
    const vn = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    expect(L.tdate).toBe(vn);
    expect(L.fdate).toBe(vn.slice(0, 8) + '01');
  });

  it('tk: bỏ mọi ký tự ngoài [A-Za-z0-9_-]', () => {
    expect(tbsSkLoc({ tk: "TK01'; --" }, NOW).tk).toBe('TK01--');
    expect(tbsSkLoc({ tk: 'TK_0-1 ' }, NOW).tk).toBe('TK_0-1');
  });

  it('ngày: sai định dạng ⇒ mặc định; tdate < fdate ⇒ tdate = fdate', () => {
    expect(tbsSkLoc({ fdate: '2026-9-01', tdate: '01/09/2026' }, NOW)).toMatchObject({ fdate: '2026-10-01', tdate: '2026-10-01' });
    expect(tbsSkLoc({ fdate: ' 2026-08-05 ', tdate: '2026-08-20' }, NOW)).toMatchObject({ fdate: '2026-08-05', tdate: '2026-08-20' });
    expect(tbsSkLoc({ fdate: '2026-08-20', tdate: '2026-08-05' }, NOW)).toMatchObject({ fdate: '2026-08-20', tdate: '2026-08-20' });
    // chỉ có fdate trong tương lai ⇒ tdate mặc định (hôm nay) < fdate ⇒ kéo lên fdate.
    expect(tbsSkLoc({ fdate: '2026-12-01' }, NOW)).toMatchObject({ fdate: '2026-12-01', tdate: '2026-12-01' });
    // regex-hợp-lệ nhưng không phải lịch (tháng 13) vẫn được GIỮ nguyên như prod — service mới chặn.
    expect(tbsSkLoc({ fdate: '2026-13-01', tdate: '2026-13-05' }, NOW)).toMatchObject({ fdate: '2026-13-01', tdate: '2026-13-05' });
  });

  it('chieu: chỉ ""|vao|ra|chuyen; link cũ type=in/out/tranfer ánh xạ khi chieu rỗng', () => {
    expect(tbsSkLoc({ chieu: 'vao' }, NOW).chieu).toBe('vao');
    expect(tbsSkLoc({ chieu: 'chuyen' }, NOW).chieu).toBe('chuyen');
    expect(tbsSkLoc({ chieu: 'xyz' }, NOW).chieu).toBe('');
    expect(tbsSkLoc({ type: 'in' }, NOW).chieu).toBe('vao');
    expect(tbsSkLoc({ type: 'out' }, NOW).chieu).toBe('ra');
    expect(tbsSkLoc({ type: 'tranfer' }, NOW).chieu).toBe('chuyen');
    expect(tbsSkLoc({ type: 'transfer' }, NOW).chieu).toBe('');
    expect(tbsSkLoc({ chieu: 'ra', type: 'in' }, NOW).chieu).toBe('ra'); // chieu thắng
    expect(tbsSkLoc({ chieu: 'xyz', type: 'in' }, NOW).chieu).toBe(''); // chieu khác rỗng ⇒ không ánh xạ, rồi bị loại
  });

  it('nguon: mặc định __all; chuỗi rỗng TƯỜNG MINH là lọc nguồn "" (dòng sổ tay) — giữ nguyên văn', () => {
    expect(tbsSkLoc({ nguon: 'payment' }, NOW).nguon).toBe('payment');
    expect(tbsSkLoc({ nguon: '' }, NOW).nguon).toBe('');
    expect(tbsSkLoc({ nguon: null }, NOW).nguon).toBe('__all');
  });

  it('tt: 1|0|9|all, sai ⇒ 1', () => {
    for (const t of ['1', '0', '9', 'all']) expect(tbsSkLoc({ tt: t }, NOW).tt).toBe(t);
    expect(tbsSkLoc({ tt: '2' }, NOW).tt).toBe('1');
    expect(tbsSkLoc({ tt: 'ALL' }, NOW).tt).toBe('1');
  });

  it('q trim; min/max qua tbsSkSo; loai TM|CK (khớp chặt); bank trim; sort asc|desc', () => {
    const L = tbsSkLoc({ q: '  abc ', min: '1.000,5', max: 'x', loai: 'CK', bank: ' VCB ', sort: 'asc' }, NOW);
    expect(L.q).toBe('abc');
    expect(s(L.min)).toBe('1000.5');
    expect(L.max).toBeNull();
    expect(L.loai).toBe('CK');
    expect(L.bank).toBe('VCB');
    expect(L.sort).toBe('asc');
    expect(tbsSkLoc({ loai: 'tm' }, NOW).loai).toBe('');
    expect(tbsSkLoc({ sort: 'ASC' }, NOW).sort).toBe('desc');
  });

  it('trang = max(1, intval); moi_trang ∈ {100,200,500,1000} không thì 200', () => {
    expect(tbsSkLoc({ trang: '3' }, NOW).trang).toBe(3);
    expect(tbsSkLoc({ trang: '0' }, NOW).trang).toBe(1);
    expect(tbsSkLoc({ trang: '-4' }, NOW).trang).toBe(1);
    expect(tbsSkLoc({ trang: 'abc' }, NOW).trang).toBe(1);
    expect(tbsSkLoc({ trang: '2.9' }, NOW).trang).toBe(2);
    expect(tbsSkLoc({ trang: ' 7x' }, NOW).trang).toBe(7);
    expect(tbsSkLoc({ trang: '1e2' }, NOW).trang).toBe(100);
    for (const m of [100, 200, 500, 1000]) expect(tbsSkLoc({ moi_trang: String(m) }, NOW).moiTrang).toBe(m);
    expect(tbsSkLoc({ moi_trang: '50' }, NOW).moiTrang).toBe(200);
    expect(tbsSkLoc({ moi_trang: 'abc' }, NOW).moiTrang).toBe(200);
  });
});

describe('tbsSkLocPhu (:59-62) — bộ lọc phụ tắt số dư chạy', () => {
  const NOW = new Date('2026-09-20T03:00:00Z');
  it('mặc định ⇒ false; bất kỳ lọc phụ nào ⇒ true; ngày/sort/trang KHÔNG tính', () => {
    expect(tbsSkLocPhu(tbsSkLoc({}, NOW))).toBe(false);
    expect(tbsSkLocPhu(tbsSkLoc({ fdate: '2026-01-01', sort: 'asc', trang: '2', moi_trang: '100' }, NOW))).toBe(false);
    for (const g of [{ chieu: 'vao' }, { nguon: 'payment' }, { nguon: '' }, { tt: 'all' }, { tt: '0' }, { q: 'x' },
      { min: '0' }, { max: '5' }, { loai: 'TM' }, { bank: 'VCB' }]) {
      expect(tbsSkLocPhu(tbsSkLoc(g, NOW))).toBe(true);
    }
  });
});

describe('vnEpoch — strtotime("Y-m-d H:i:s") theo giờ VN', () => {
  it('00:00:00 và 23:59:59 giờ VN', () => {
    expect(vnEpoch('2026-09-01', '00:00:00')).toBe(Date.UTC(2026, 7, 31, 17, 0, 0) / 1000);
    expect(vnEpoch('2026-09-25', '23:59:59')).toBe(Date.UTC(2026, 8, 25, 16, 59, 59) / 1000);
  });
  it('tràn ngày như PHP 8 strtotime: 02-31 ⇒ 03-03; ngày 00 ⇒ cuối tháng trước; tháng 00 ⇒ tháng 12 năm trước', () => {
    expect(vnEpoch('2026-02-31', '00:00:00')).toBe(vnEpoch('2026-03-03', '00:00:00'));
    expect(vnEpoch('2026-09-00', '00:00:00')).toBe(vnEpoch('2026-08-31', '00:00:00'));
    expect(vnEpoch('2026-00-10', '00:00:00')).toBe(vnEpoch('2025-12-10', '00:00:00'));
  });
  it('tháng > 12 hoặc ngày > 31 ⇒ null (PHP strtotime trả false)', () => {
    expect(vnEpoch('2026-13-01', '00:00:00')).toBeNull();
    expect(vnEpoch('2026-09-32', '00:00:00')).toBeNull();
    expect(vnEpoch('abc', '00:00:00')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clusterSuspectDuplicates — :444-469
// ─────────────────────────────────────────────────────────────────────────────
describe('clusterSuspectDuplicates (:444-469)', () => {
  const T0 = 1_790_000_000;
  const r = (id: number, tkCode: string | null, money: string, cdate: number) => ({ id, tkCode, money: D(money), cdate });
  const ids = (cs: { id: number }[][]) => cs.map((c) => c.map((x) => x.id));

  it('gom BẮC CẦU khi khoảng cách tới dòng TRƯỚC ≤ cửa sổ (biên = đúng 30 phút vẫn gom)', () => {
    const rows = [
      r(1, 'TK01', '-100', T0),
      r(2, 'TK01', '-100', T0 + 30 * 60),         // đúng biên
      r(3, 'TK01', '-100', T0 + 60 * 60),         // cách dòng 2 đúng 30' ⇒ bắc cầu (cách dòng 1 60')
      r(4, 'TK01', '-100', T0 + 90 * 60 + 1),     // cách dòng 3 30'01" ⇒ tách
      r(5, 'TK01', '-100', T0 + 100 * 60),        // cặp với 4
    ];
    expect(ids(clusterSuspectDuplicates(rows))).toEqual([[1, 2, 3], [4, 5]]);
  });

  it('cụm 1 dòng bị bỏ; money=0 (sau round 2) bị bỏ; dấu KHÁC nhau là khoá khác nhau', () => {
    const rows = [
      r(1, 'TK01', '-100', T0),
      r(2, 'TK01', '100', T0 + 60),     // khác dấu
      r(3, 'TK01', '0.004', T0 + 60),   // round ⇒ 0 ⇒ bỏ
      r(4, 'TK01', '-0.004', T0 + 61),  // round ⇒ -0 ⇒ bỏ
      r(5, 'TK01', '0', T0 + 62),
    ];
    expect(clusterSuspectDuplicates(rows)).toEqual([]);
  });

  it('khoá = (tk, round(money,2) ROUND_HALF_UP): 1,005 và 1,01 cùng khoá; khác ví thì không gom', () => {
    const rows = [
      r(1, 'TK01', '1.005', T0),
      r(2, 'TK01', '1.01', T0 + 10),
      r(3, 'TK02', '1.01', T0 + 20),
      r(4, 'TK01', '-2.345', T0 + 30),
      r(5, 'TK01', '-2.35', T0 + 40),
      r(6, 'TK01', '-2.344', T0 + 50), // ⇒ -2.34, khoá khác
    ];
    expect(ids(clusterSuspectDuplicates(rows))).toEqual([[1, 2], [4, 5]]);
  });

  it('sắp theo cdate trong từng khoá (ổn định), thứ tự cụm theo lần đầu gặp khoá', () => {
    const rows = [
      r(1, 'TK02', '-5', T0 + 100),
      r(2, 'TK01', '-7', T0 + 50),
      r(3, 'TK02', '-5', T0),
      r(4, 'TK01', '-7', T0 + 50), // cùng cdate với 2 ⇒ giữ thứ tự đầu vào
      r(5, 'TK02', '-5', T0 + 100),
    ];
    expect(ids(clusterSuspectDuplicates(rows))).toEqual([[3, 1, 5], [2, 4]]);
  });

  it('windowMinutes: tuỳ chỉnh; ≤ 0 hoặc không phải số ⇒ tối thiểu 1 phút (max(1, intval))', () => {
    const rows = [r(1, 'TK01', '-9', T0), r(2, 'TK01', '-9', T0 + 60), r(3, 'TK01', '-9', T0 + 125)];
    expect(ids(clusterSuspectDuplicates(rows, 5))).toEqual([[1, 2, 3]]);
    expect(ids(clusterSuspectDuplicates(rows, 1))).toEqual([[1, 2]]);
    expect(ids(clusterSuspectDuplicates(rows, 0))).toEqual([[1, 2]]);
    expect(ids(clusterSuspectDuplicates(rows, -3))).toEqual([[1, 2]]);
    expect(ids(clusterSuspectDuplicates(rows, 1.9))).toEqual([[1, 2]]); // intval(1.9)=1 ⇒ 60s ⇒ 3 tách (cách 65s)
  });

  it('tkCode null được coi như "" (nối chuỗi PHP); trả dòng GỐC nguyên vẹn', () => {
    const a = { ...r(1, null, '-3', T0), note: 'x' };
    const b = { ...r(2, null, '-3', T0 + 1), note: 'y' };
    const out = clusterSuspectDuplicates([a, b]);
    expect(out).toEqual([[a, b]]);
    expect(out[0][0]).toBe(a);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// noiDungDong — tbs_account_history_content (§2.2 bước 5)
// ─────────────────────────────────────────────────────────────────────────────
describe('noiDungDong — tbs_account_history_content', () => {
  it('thu_chi_tbs + ly_do ⇒ "Phiếu chi TBS — <lý do> — phiếu duyệt #<id>"', () => {
    expect(noiDungDong({ note: 'Chi phí khác', sourceModule: 'thu_chi_tbs', sourceId: 42, approvalFormData: '{"ly_do":"  Mua VPP ","nd_thanh_toan":"x"}' }))
      .toBe('Phiếu chi TBS — Mua VPP — phiếu duyệt #42');
  });
  it('ly_do rỗng ⇒ nd_thanh_toan; id 0 ⇒ không có đuôi phiếu duyệt', () => {
    expect(noiDungDong({ note: 'n', sourceModule: 'thu_chi_tbs', sourceId: 0, approvalFormData: '{"ly_do":"  ","nd_thanh_toan":"TT NCC"}' }))
      .toBe('Phiếu chi TBS — TT NCC');
  });
  it('không có nội dung / JSON hỏng / không phải object / nguồn khác ⇒ trim(note)', () => {
    expect(noiDungDong({ note: ' ghi chú ', sourceModule: 'thu_chi_tbs', sourceId: 1, approvalFormData: '{"ly_do":""}' })).toBe('ghi chú');
    expect(noiDungDong({ note: 'a', sourceModule: 'thu_chi_tbs', sourceId: 1, approvalFormData: '{hỏng' })).toBe('a');
    expect(noiDungDong({ note: 'a', sourceModule: 'thu_chi_tbs', sourceId: 1, approvalFormData: '"chuoi"' })).toBe('a');
    expect(noiDungDong({ note: 'a', sourceModule: 'thu_chi_tbs', sourceId: 1, approvalFormData: null })).toBe('a');
    expect(noiDungDong({ note: 'a', sourceModule: 'payment', sourceId: 1, approvalFormData: '{"ly_do":"x"}' })).toBe('a');
    expect(noiDungDong({ note: null, sourceModule: null })).toBe('');
  });
});
