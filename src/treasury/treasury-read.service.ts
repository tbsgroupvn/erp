// 09b đợt 1, Task 3 — ĐỌC sổ quỹ công ty (không ghi). Đặc tả docs/rewrite-spec/09b-so-quy-treasury.md
// §3.3 (số dư = opening + Σstatus=1 — Q1/T1), §4 (`account.view`), §6, và `cls.treasury.php::getOverview`
// (:351-391): chỉ ví `is_active=1`, thứ tự `display_order, id`, tách `acc_group='store'` (hàng tồn,
// KHÔNG cộng vào tiền — §12.11). Không quy đổi VND: bảng tỷ giá prod rỗng (§12.6 — không bịa số).
//
// DTO là ALLOW-LIST: không bao giờ trả `stk` (khoá ánh xạ SePay), `ownerUid`, hay bất kỳ khái niệm
// mật khẩu API cũ nào (cột `password` không được mang sang v2 — Q15).
import { Injectable, NotFoundException } from '@nestjs/common';
import { FundAccount, Prisma, TreasuryEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermService } from '../iam/perm.service';
import { TreasuryService } from '../money/treasury.service';
import { TreasuryEntriesQuery } from './treasury.query';

const Decimal = Prisma.Decimal;
const CURRENCIES = ['VND', 'CNY', 'USD'] as const; // prod `currencies()` (:89)
const PERM = 'account.view';

/** Decimal ⇒ chuỗi ký pháp thường (không số mũ, không đuôi 0 thừa). */
const s = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : new Decimal(d).toFixed());

function toAccountDto(a: FundAccount, balance: Prisma.Decimal) {
  return {
    code: a.code,
    name: a.name,
    subname: a.subname,
    currency: a.currency,
    accGroup: a.accGroup,
    displayOrder: a.displayOrder,
    glAccount: a.glAccount,
    openingBalance: s(a.openingBalance),
    balance: s(balance),
  };
}

function toEntryDto(e: TreasuryEntry) {
  return {
    id: e.id,
    tkCode: e.tkCode,
    type: e.type,
    money: s(e.money),
    rate: s(e.rate),
    status: e.status,
    note: e.note,
    gout: e.gout,
    cusId: e.cusId,
    cdate: e.cdate,
    cuser: e.cuser,
    approveUser: e.approveUser,
    approveDate: e.approveDate,
    sourceModule: e.sourceModule,
    sourceId: e.sourceId,
    reversalOf: e.reversalOf,
    reversalCode: e.reversalCode,
    reversalReason: e.reversalReason,
    refRequestId: e.refRequestId,
    poId: e.poId,
    containerId: e.containerId,
    orderCode: e.orderCode,
  };
}

type Tong = Record<(typeof CURRENCIES)[number], { total: string; count: number }>;

@Injectable()
export class TreasuryReadService {
  constructor(private prisma: PrismaService, private perm: PermService, private treasury: TreasuryService) {}

  /**
   * Sổ quỹ không có chủ sở hữu ⇒ chỉ phạm vi `all` mới đọc được (fail-closed — cùng luật ScopeGuard
   * entity `fundAccount`). Phạm vi hẹp hơn hoặc không có mã (super admin không vai) ⇒ như rỗng.
   */
  private async toanCongTy(uid: number): Promise<boolean> {
    return (await this.perm.scopeOf(PERM, uid)) === 'all';
  }

  /** `GET /treasury/accounts` — `getOverview()` rút gọn: số dư từng ví, tách bank/store, tổng theo tệ. */
  async overview(uid: number) {
    const tong = (): Tong => ({ VND: { total: '0', count: 0 }, CNY: { total: '0', count: 0 }, USD: { total: '0', count: 0 } });
    const out = { bank: [] as ReturnType<typeof toAccountDto>[], store: [] as ReturnType<typeof toAccountDto>[], byCurrency: tong(), storeByCurrency: tong() };
    if (!(await this.toanCongTy(uid))) return out;

    const accs = await this.prisma.fundAccount.findMany({ where: { isActive: 1 }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
    // getBalances() còn trả khoá cho tk_code KHÔNG có trong danh mục (CHI-TBS…) — chép prod; ở đây
    // chỉ duyệt theo danh mục nên các khoá đó tự rơi, không bao giờ ra HTTP.
    const balances = await this.treasury.getBalances();
    const sums = { bank: new Map<string, Prisma.Decimal>(), store: new Map<string, Prisma.Decimal>() };
    for (const a of accs) {
      const bal = balances.get(a.code) ?? new Decimal(a.openingBalance);
      const grp = a.accGroup === 'store' ? 'store' : 'bank';
      out[grp].push(toAccountDto(a, bal));
      const cur = (CURRENCIES as readonly string[]).includes(a.currency) ? a.currency : 'VND';
      const byCur = grp === 'store' ? out.storeByCurrency : out.byCurrency;
      byCur[cur as keyof Tong].count++;
      sums[grp].set(cur, (sums[grp].get(cur) ?? new Decimal(0)).plus(bal));
    }
    for (const cur of CURRENCIES) {
      out.byCurrency[cur].total = s(sums.bank.get(cur) ?? new Decimal(0))!;
      out.storeByCurrency[cur].total = s(sums.store.get(cur) ?? new Decimal(0))!;
    }
    return out;
  }

  /** `GET /treasury/accounts/:code/entries` — sổ một ví, mới nhất trước. Ví không có trong danh mục ⇒ 404. */
  async entries(uid: number, code: string, q: TreasuryEntriesQuery = {}) {
    // ScopeGuard đã chặn trước; lặp lại ở đây phòng khi service được gọi từ nơi khác.
    if (!(await this.toanCongTy(uid))) throw new NotFoundException('Không tìm thấy');
    const a = await this.prisma.fundAccount.findUnique({ where: { code } });
    if (!a) throw new NotFoundException('Không tìm thấy');

    const page = q.page ?? 1;
    const perPage = q.perPage ?? 50;
    const where: Prisma.TreasuryEntryWhereInput = { tkCode: a.code, ...(q.status !== undefined ? { status: q.status } : {}) };
    const [total, rows, balance] = await Promise.all([
      this.prisma.treasuryEntry.count({ where }),
      this.prisma.treasuryEntry.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
      this.treasury.getBalance(a.code),
    ]);
    return {
      account: { code: a.code, name: a.name, currency: a.currency, accGroup: a.accGroup },
      balance: s(balance),
      total,
      page,
      perPage,
      items: rows.map(toEntryDto),
    };
  }
}
