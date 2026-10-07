import { VatService } from '../../src/quote/vat.service';

describe('VatService (#05 báo giá — tách VAT ngược)', () => {
  const vat = new VatService();

  it('tách ngược, base+vat === total', () => {
    const r = vat.split(1134097, 0.08);
    expect(r.base).toBe(1050090); // round(1134097/1.08)
    expect(r.vat).toBe(84007);
    expect(r.base + r.vat).toBe(r.total); // BẤT BIẾN: không mất đồng nào
  });

  it('nhận cả 8 lẫn 0.08 (guard rate>1)', () => {
    expect(vat.split(1134097, 8)).toEqual(vat.split(1134097, 0.08));
  });

  it('rate <= 0 -> vat 0, base = total', () => {
    expect(vat.split(1000, 0)).toMatchObject({ base: 1000, vat: 0, rate: 0 });
  });

  it('làm tròn total về đồng chẵn TRƯỚC khi tách', () => {
    expect(vat.split(1000.4, 0.08).total).toBe(1000);
  });

  it('groupByRate gom theo mức, bỏ dòng rate<=0', () => {
    const lines = [
      { totalIncl: 1134097, rate: 0.08 }, // 8%: base 1050090, vat 84007
      { totalIncl: 1080000, rate: 0.08 }, // 8%: round(1080000/1.08)=1000000, vat=80000
      { totalIncl: 1050000, rate: 0.05 }, // 5%: round(1050000/1.05)=1000000, vat=50000
      { totalIncl: 500000, rate: 0 }, // bỏ qua — rate<=0
    ];
    const g = vat.groupByRate(lines);
    expect(g).toHaveLength(2);

    const g8 = g.find((x) => x.rate === 0.08)!;
    expect(g8.base).toBe(1050090 + 1000000);
    expect(g8.vat).toBe(84007 + 80000);
    expect(g8.total).toBe(g8.base + g8.vat);

    const g5 = g.find((x) => x.rate === 0.05)!;
    expect(g5.base).toBe(1000000);
    expect(g5.vat).toBe(50000);
    expect(g5.total).toBe(1050000);
  });
});
