import { toCustomerDto, CUSTOMER_DTO_KEYS } from '../../src/common/dto/customer.dto';
import { toUserDto, USER_DTO_KEYS } from '../../src/common/dto/user.dto';

// Nhắc lại luật: Customer.password (hash cổng khách) và User.password/gsecret
// KHÔNG BAO GIỜ được rời khỏi service qua HTTP. DTO phải là ALLOW-LIST (liệt kê
// đúng trường được ra) — không phải deny-list (`delete obj.password`), để cột
// mới thêm vào model mặc định bị GIỮ LẠI thay vì mặc định bị RÒ.
describe('DTO layer — không bao giờ rò hash mật khẩu', () => {
  describe('toCustomerDto', () => {
    // Dữ liệu dùng chung cho 2 ca dưới — tách RIÊNG hai assertion thành hai
    // `it()` độc lập (không phải hai `expect` nối tiếp trong cùng 1 ca) để cả
    // hai đều THẬT SỰ tự đỏ khi đổi allow-list thành `{ ...row }`: nếu gộp
    // chung, `expect().toEqual()` (bộ khoá) đỏ trước sẽ chặn Jest chạy tới
    // `expect().not.toMatch()` (bcrypt) — trông như "chỉ 1 assertion đỏ" dù
    // cả hai đều đúng ra phải đỏ độc lập.
    const rowWithSecret = {
      id: 1,
      code: 'TBS4125',
      name: 'A',
      companyNameVn: null,
      taxCode: null,
      groupCode: null,
      phone: null,
      email: null,
      address: null,
      bankName: null,
      bankAccount: null,
      username: 'TBS4125',
      password: '$2b$10$abcdefghijklmnopqrstuv',
      saler: 'huytq',
      salerOther: null,
      source: 0,
      isNew: 1,
      creditLimit: 5_000_000n,
      creditDays: 0,
      creditAt: null,
      creditBy: null,
      type: 1,
      author: 'huytq',
      editBy: null,
      cdate: 1700000000,
      mdate: 1700000000,
      isactive: 1,
      secretNew: 'x', // mô phỏng cột tương lai chưa từng thấy
    } as any;

    // Ca canh tổng quát (task-3-brief.md Step 1) — kể cả khi model thêm cột mới,
    // DTO vẫn chỉ trả đúng allow-list, khớp TUYỆT ĐỐI (không phải toContain).
    it('khớp TUYỆT ĐỐI bộ khoá cho phép, không lọt password/cột lạ', () => {
      const dto = toCustomerDto(rowWithSecret);
      expect(Object.keys(dto as object)).toEqual(CUSTOMER_DTO_KEYS);
      expect((dto as any).secretNew).toBeUndefined();
      expect((dto as any).password).toBeUndefined();
    });

    it('không còn dấu vết hash bcrypt trong JSON trả ra', () => {
      const dto = toCustomerDto(rowWithSecret);
      expect(JSON.stringify(dto)).not.toMatch(/\$2[aby]\$/);
    });

    it('null/undefined vào thì null ra, không ném lỗi', () => {
      expect(toCustomerDto(null as any)).toBeNull();
      expect(toCustomerDto(undefined as any)).toBeNull();
    });

    // creditLimit là VND BigInt — JSON.stringify() NÉM TypeError trên BigInt thô,
    // và Number(bigint_lon) làm tròn mất độ chính xác một cách âm thầm (bug tiền).
    // DTO phải .toString() để giữ ĐÚNG từng chữ số.
    it('creditLimit (VND BigInt) ra STRING giữ nguyên độ chính xác, không phải Number', () => {
      const bigVnd = 9_007_199_254_740_993n; // > Number.MAX_SAFE_INTEGER, lệch nếu ép Number()
      const row = {
        id: 2, code: 'TBS9999', name: 'B',
        companyNameVn: null, taxCode: null, groupCode: null, phone: null,
        email: null, address: null, bankName: null, bankAccount: null,
        username: null, password: '$2a$10$xxxxxxxxxxxxxxxxxxxxxx',
        saler: null, salerOther: null, source: 0, isNew: 1,
        creditLimit: bigVnd, creditDays: 0, creditAt: null, creditBy: null,
        type: 1, author: null, editBy: null, cdate: 1, mdate: 1, isactive: 1,
      } as any;

      const dto = toCustomerDto(row)!;
      expect(typeof dto.creditLimit).toBe('string');
      expect(dto.creditLimit).toBe('9007199254740993'); // đủ chữ số, không bị làm tròn
      expect(() => JSON.stringify(dto)).not.toThrow(); // BigInt thô sẽ ném TypeError ở đây
    });
  });

  describe('toUserDto', () => {
    it('không để lọt password/gsecret/cột lạ, khớp TUYỆT ĐỐI bộ khoá cho phép', () => {
      const row = {
        id: 10,
        username: 'huytq',
        password: '$2y$10$abcdefghijklmnopqrstuv',
        firstname: 'Huy',
        lastname: 'Trần',
        email: 'huytq8995@gmail.com',
        gid: 1,
        phongbanId: 2,
        leaderId: null,
        jobTitleId: 3,
        isSuperAdmin: false,
        isActive: true,
        lastLogin: null,
        gsecret: 'JBSWY3DPEHPK3PXP',
        secretNew: 'y', // mô phỏng cột tương lai chưa từng thấy
      } as any;

      const dto = toUserDto(row);

      expect(Object.keys(dto as object)).toEqual(USER_DTO_KEYS);
      expect(JSON.stringify(dto)).not.toMatch(/\$2[aby]\$/);
      expect((dto as any).gsecret).toBeUndefined();
      expect((dto as any).secretNew).toBeUndefined();
      expect((dto as any).password).toBeUndefined();
    });

    it('null/undefined vào thì null ra, không ném lỗi', () => {
      expect(toUserDto(null as any)).toBeNull();
      expect(toUserDto(undefined as any)).toBeNull();
    });
  });
});
