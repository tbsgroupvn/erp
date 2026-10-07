import { Customer } from '@prisma/client';

// ⚠ Customer.password (hash bcrypt cổng khách, `tbl_customer.password`) và bất
// kỳ cột nào chưa liệt kê ở đây KHÔNG BAO GIỜ được đi ra ngoài. Đây là
// ALLOW-LIST: chỉ những trường được NÊU TÊN dưới đây mới ra HTTP response —
// không dùng `delete row.password` hay spread (`{ ...row }`) rồi xoá, vì cột
// mới thêm vào model qua migration sẽ bị RÒ MẶC ĐỊNH thay vì bị GIỮ MẶC ĐỊNH.
//
// CUSTOMER_DTO_KEYS xuất riêng để test canh khớp TUYỆT ĐỐI (`toEqual`, không
// phải `toContain`) — đổi allow-list thành deny-list/spread phải làm test đỏ.
export const CUSTOMER_DTO_KEYS = [
  'id', 'code', 'name', 'companyNameVn', 'taxCode', 'groupCode', 'phone',
  'email', 'address', 'bankName', 'bankAccount', 'username', 'saler',
  'salerOther', 'source', 'isNew', 'creditLimit', 'creditDays', 'creditAt',
  'creditBy', 'type', 'author', 'editBy', 'cdate', 'mdate', 'isactive',
] as const;

export interface CustomerDto {
  id: number;
  code: string;
  name: string;
  companyNameVn: string | null;
  taxCode: string | null;
  groupCode: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
  username: string | null;
  saler: string | null;
  salerOther: string | null;
  source: number;
  isNew: number;
  // VND — Customer.creditLimit là BigInt (`tbl_customer.credit_limit`).
  // JSON.stringify() NÉM TypeError trên BigInt thô; Number(bigint_lon) làm
  // tròn mất độ chính xác âm thầm trên số lớn (bug tiền). Luôn .toString().
  creditLimit: string;
  creditDays: number;
  creditAt: number | null;
  creditBy: string | null;
  type: number;
  author: string | null;
  editBy: string | null;
  cdate: number;
  mdate: number;
  isactive: number;
}

export function toCustomerDto(row: Customer | null | undefined): CustomerDto | null {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    companyNameVn: row.companyNameVn,
    taxCode: row.taxCode,
    groupCode: row.groupCode,
    phone: row.phone,
    email: row.email,
    address: row.address,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    username: row.username,
    saler: row.saler,
    salerOther: row.salerOther,
    source: row.source,
    isNew: row.isNew,
    creditLimit: row.creditLimit.toString(),
    creditDays: row.creditDays,
    creditAt: row.creditAt,
    creditBy: row.creditBy,
    type: row.type,
    author: row.author,
    editBy: row.editBy,
    cdate: row.cdate,
    mdate: row.mdate,
    isactive: row.isactive,
  };
}
