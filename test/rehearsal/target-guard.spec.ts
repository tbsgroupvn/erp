import { assertRehearsalTarget, extractDatabaseName } from '../../src/rehearsal/target-guard';

describe('target-guard: assertRehearsalTarget', () => {
  const testUrls = [
    'postgresql://postgres:postgres@localhost:5433/tbs_test',
    'postgresql://postgres:postgres@localhost:5433/tbs_test?schema=public',
  ];

  it('từ chối CSDL test dùng chung (tbs_test)', () => {
    expect(() =>
      assertRehearsalTarget('postgresql://postgres:postgres@localhost:5433/tbs_test', testUrls),
    ).toThrow(/tbs_test|test database|CSDL test/i);
  });

  it('từ chối tên CSDL khác không kết thúc bằng _rehearsal', () => {
    expect(() =>
      assertRehearsalTarget('postgresql://postgres:postgres@localhost:5433/some_other_db', testUrls),
    ).toThrow(/_rehearsal/);
  });

  it('từ chối tên CSDL "production" dù không trùng test', () => {
    expect(() =>
      assertRehearsalTarget('postgresql://postgres:postgres@103.142.27.124:5432/erp_prod', testUrls),
    ).toThrow(/_rehearsal/);
  });

  it('từ chối URL sai định dạng', () => {
    expect(() => assertRehearsalTarget('not a url', testUrls)).toThrow();
    expect(() => assertRehearsalTarget('', testUrls)).toThrow();
    expect(() => assertRehearsalTarget('mysql://foo', testUrls)).toThrow();
  });

  it('chấp nhận CSDL tên kết thúc bằng _rehearsal và khác CSDL test', () => {
    expect(() =>
      assertRehearsalTarget('postgresql://postgres:postgres@localhost:5433/tbs_rehearsal', testUrls),
    ).not.toThrow();
  });

  it('từ chối nếu tên CSDL _rehearsal TRÙNG với một trong các CSDL test (biên)', () => {
    const trickyTestUrls = [
      'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal',
    ];
    expect(() =>
      assertRehearsalTarget(
        'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal',
        trickyTestUrls,
      ),
    ).toThrow();
  });

  it('không phải postgres:// hay postgresql:// thì từ chối dù tên đúng hậu tố', () => {
    expect(() =>
      assertRehearsalTarget('mysql://root@localhost:3306/tbs_rehearsal', testUrls),
    ).toThrow();
  });
});

describe('target-guard: extractDatabaseName (helper thuần)', () => {
  it('lấy đúng tên CSDL từ URL có query string', () => {
    expect(
      extractDatabaseName('postgresql://u:p@host:5433/tbs_rehearsal?schema=public'),
    ).toBe('tbs_rehearsal');
  });

  it('lấy đúng tên CSDL từ URL không có query string', () => {
    expect(extractDatabaseName('postgresql://u:p@host:5433/tbs_test')).toBe('tbs_test');
  });

  it('trả về null khi URL sai định dạng', () => {
    expect(extractDatabaseName('not a url')).toBeNull();
  });

  it('trả về null khi không có tên CSDL (path rỗng)', () => {
    expect(extractDatabaseName('postgresql://u:p@host:5433/')).toBeNull();
  });
});
