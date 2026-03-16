import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import {
  VasReportQueryDto,
  VasReportType,
  VasReportResult,
  BalanceSheetReport,
  BalanceSheetItem,
  IncomeStatementReport,
  IncomeStatementItem,
  CashFlowReport,
} from './dto/vas-report.dto';

// ============================================
// Phan loai tai khoan theo he thong tai khoan Viet Nam (QD 48/2006, TT 200/2014)
// ============================================

// Tai san ngan han: TK dau 1 (111-159)
const PREFIX_TAI_SAN_NGAN_HAN = ['1'];

// Tai san dai han: TK dau 2 (211-269)
const PREFIX_TAI_SAN_DAI_HAN = ['2'];

// No phai tra: TK dau 3 (311-356)
const PREFIX_NO_PHAI_TRA = ['3'];

// Von chu so huu: TK dau 4 (411-421)
const PREFIX_VON_CHU_SO_HUU = ['4'];

// Doanh thu ban hang va cung cap dich vu
const PREFIX_DOANH_THU_BAN_HANG = ['511', '512'];

// Gia von hang ban
const PREFIX_GIA_VON = ['632'];

// Chi phi ban hang
const PREFIX_CHI_PHI_BAN_HANG = ['641'];

// Chi phi quan ly doanh nghiep
const PREFIX_CHI_PHI_QUAN_LY = ['642'];

// Doanh thu tai chinh (lai tien gui, lai chech lech ty gia...)
const PREFIX_DOANH_THU_TAI_CHINH = ['515', '711'];

// Chi phi tai chinh (lai vay, lo chech lech ty gia...)
const PREFIX_CHI_PHI_TAI_CHINH = ['635', '811'];

// Thue thu nhap doanh nghiep
const PREFIX_THUE_TNCN = ['821'];

// Tien mat va tien gui ngan hang
const ACCOUNTS_TIEN = ['111', '112'];

// Tai san co dinh, dau tu dai han
const PREFIX_HDDT = ['211', '213', '221', '241'];

// Vay no va von gop
const PREFIX_HDTC = ['341', '411'];

@Injectable()
export class VasReportService {
  private readonly logger = new Logger(VasReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tao bao cao tai chinh VAS theo loai duoc yeu cau.
   * Ho tro: B01_DN, B02_DN, B03_DN.
   * Neu co compareDateFrom + compareDateTo: tinh them ky so sanh va % thay doi.
   */
  async generateReport(query: VasReportQueryDto): Promise<VasReportResult> {
    // Kiem tra khoang thoi gian chinh hop le
    const dateFrom = new Date(query.dateFrom);
    const dateTo = new Date(query.dateTo);
    dateTo.setHours(23, 59, 59, 999);

    if (dateFrom > dateTo) {
      throw new BadRequestException('Ngay bat dau phai nho hon hoac bang ngay ket thuc');
    }

    // Kiem tra ky so sanh neu co
    let compareDateFrom: Date | undefined;
    let compareDateTo: Date | undefined;
    if (query.compareDateFrom && query.compareDateTo) {
      compareDateFrom = new Date(query.compareDateFrom);
      compareDateTo = new Date(query.compareDateTo);
      compareDateTo.setHours(23, 59, 59, 999);
      if (compareDateFrom > compareDateTo) {
        throw new BadRequestException('Ngay bat dau ky so sanh phai nho hon ngay ket thuc ky so sanh');
      }
    }

    this.logger.log(
      `Tao bao cao VAS ${query.type} tu ${query.dateFrom} den ${query.dateTo}` +
        (query.branch ? ` cho chi nhanh ${query.branch}` : ' cho toan cong ty') +
        (compareDateFrom ? ` | So sanh: ${query.compareDateFrom} - ${query.compareDateTo}` : ''),
    );

    switch (query.type) {
      case VasReportType.B01_DN: {
        const main = await this.buildBalanceSheet(query, dateFrom, dateTo) as any;
        if (compareDateFrom && compareDateTo) {
          const compareQuery = { ...query, dateFrom: query.compareDateFrom!, dateTo: query.compareDateTo! };
          const prev = await this.buildBalanceSheet(compareQuery, compareDateFrom, compareDateTo) as any;
          main.previousPeriod = prev;
          main.changePercent = this.calcChangePercentBalanceSheet(main, prev);
        }
        return main;
      }

      case VasReportType.B02_DN: {
        const main = await this.buildIncomeStatement(query, dateFrom, dateTo) as any;
        if (compareDateFrom && compareDateTo) {
          const compareQuery = { ...query, dateFrom: query.compareDateFrom!, dateTo: query.compareDateTo! };
          const prev = await this.buildIncomeStatement(compareQuery, compareDateFrom, compareDateTo) as any;
          main.previousPeriod = prev;
          main.changePercent = this.calcChangePercentIncomeStatement(main, prev);
        }
        return main;
      }

      case VasReportType.B03_DN: {
        const main = await this.buildCashFlowStatement(query, dateFrom, dateTo) as any;
        if (compareDateFrom && compareDateTo) {
          const compareQuery = { ...query, dateFrom: query.compareDateFrom!, dateTo: query.compareDateTo! };
          const prev = await this.buildCashFlowStatement(compareQuery, compareDateFrom, compareDateTo) as any;
          main.previousPeriod = prev;
          main.changePercent = this.calcChangePercentCashFlow(main, prev);
        }
        return main;
      }

      case VasReportType.B09_DN:
        throw new BadRequestException(
          'Bao cao B09_DN (Thuyet minh BCTC) chua duoc ho tro. Vui long su dung B01, B02 hoac B03.',
        );

      default:
        throw new BadRequestException(`Loai bao cao khong hop le: ${query.type}`);
    }
  }

  /**
   * Tinh % thay doi cho B01-DN: so sanh closingBalance theo accountCode.
   * changePercent = (current - previous) / |previous| * 100.
   * Tra ve null neu previous = 0.
   */
  private calcChangePercentBalanceSheet(
    current: any,
    previous: any,
  ): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    const allItems = [
      ...current.taiSanNganHan,
      ...current.taiSanDaiHan,
      ...current.noPhaiTra,
      ...current.vonChuSoHuu,
    ];
    const prevMap = new Map<string, number>();
    [
      ...(previous.taiSanNganHan ?? []),
      ...(previous.taiSanDaiHan ?? []),
      ...(previous.noPhaiTra ?? []),
      ...(previous.vonChuSoHuu ?? []),
    ].forEach((i: any) => prevMap.set(i.accountCode, i.closingBalance));

    for (const item of allItems) {
      const prevVal = prevMap.get(item.accountCode) ?? 0;
      result[item.accountCode] = this.pctChange(item.closingBalance, prevVal);
    }

    // Tong tai san va nguon von
    result['TONG_TAI_SAN'] = this.pctChange(current.tongTaiSan, previous.tongTaiSan ?? 0);
    result['TONG_NGUON_VON'] = this.pctChange(current.tongNguonVon, previous.tongNguonVon ?? 0);
    return result;
  }

  /**
   * Tinh % thay doi cho B02-DN theo ma chi tieu (code).
   */
  private calcChangePercentIncomeStatement(
    current: any,
    previous: any,
  ): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    const prevMap = new Map<string, number>();
    (previous.chiTiet ?? []).forEach((i: any) => prevMap.set(i.code, i.amount));

    for (const item of current.chiTiet) {
      const prevVal = prevMap.get(item.code) ?? 0;
      result[item.code] = this.pctChange(item.amount, prevVal);
    }
    return result;
  }

  /**
   * Tinh % thay doi cho B03-DN theo tung khoan muc.
   */
  private calcChangePercentCashFlow(
    current: any,
    previous: any,
  ): Record<string, number | null> {
    const keys = ['luuChuyenTuHDKD', 'luuChuyenTuHDDT', 'luuChuyenTuHDTC', 'tangGiamTienRong', 'tienDauKy', 'tienCuoiKy'];
    const result: Record<string, number | null> = {};
    for (const key of keys) {
      result[key] = this.pctChange(current[key] ?? 0, previous[key] ?? 0);
    }
    return result;
  }

  /**
   * Ham tinh % thay doi: (current - prev) / |prev| * 100.
   * Tra ve null neu prev = 0 (tranh chia cho 0).
   */
  private pctChange(current: number, prev: number): number | null {
    if (prev === 0) return null;
    return parseFloat(((current - prev) / Math.abs(prev) * 100).toFixed(2));
  }

  // ============================================
  // B01-DN: Bang can doi ke toan
  // ============================================

  /**
   * Xay dung bang can doi ke toan (B01-DN).
   *
   * Nguyen tac:
   * - So du dau ky = tong phat sinh truoc dateFrom
   * - So du cuoi ky = tong phat sinh tu dau den dateTo
   * - Tai san = Debit - Credit (so du ben No)
   * - Nguon von (No phai tra + VCSH) = Credit - Debit (so du ben Co)
   */
  private async buildBalanceSheet(
    query: VasReportQueryDto,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<BalanceSheetReport> {
    // Lay so du dau ky: tat ca phat sinh truoc dateFrom
    const openingRaw = await this.getAccountBalances(undefined, dateFrom);

    // Lay so du cuoi ky: tat ca phat sinh tu dau den dateTo
    const closingRaw = await this.getAccountBalances(undefined, dateTo);

    // Lay danh sach ten tai khoan
    const allCodes = new Set([...openingRaw.keys(), ...closingRaw.keys()]);
    const accountNames = await this.getAccountNames([...allCodes]);

    // Ham lay so du rong cua mot tai khoan (Debit - Credit)
    const getBalance = (map: Map<string, { debit: number; credit: number }>, code: string) => {
      const entry = map.get(code);
      if (!entry) return 0;
      return entry.debit - entry.credit;
    };

    // Xay dung mot dong bao cao
    const buildItem = (code: string): BalanceSheetItem => ({
      accountCode: code,
      accountName: accountNames.get(code) ?? code,
      openingBalance: getBalance(openingRaw, code),
      closingBalance: getBalance(closingRaw, code),
    });

    // Loc tai khoan theo prefix
    const filterByPrefix = (prefixes: string[]): BalanceSheetItem[] =>
      [...allCodes]
        .filter((code) => prefixes.some((p) => code.startsWith(p)))
        .sort()
        .map(buildItem);

    const taiSanNganHan = filterByPrefix(PREFIX_TAI_SAN_NGAN_HAN);
    const taiSanDaiHan = filterByPrefix(PREFIX_TAI_SAN_DAI_HAN);
    const noPhaiTra = filterByPrefix(PREFIX_NO_PHAI_TRA);
    const vonChuSoHuu = filterByPrefix(PREFIX_VON_CHU_SO_HUU);

    // Tinh tong tai san (tai san = so du ben No = debit - credit > 0)
    const tongTaiSan =
      taiSanNganHan.reduce((s, i) => s + i.closingBalance, 0) +
      taiSanDaiHan.reduce((s, i) => s + i.closingBalance, 0);

    // Tinh tong nguon von:
    // No phai tra (TK 3xx) va VCSH (TK 4xx) co so du ben Co nen getBalance tra ve am.
    // Lay gia tri am roi negate de ra so duong, hoac dung so tuyet doi.
    // Giu lai so am cua getBalance roi negate tat ca de dam bao:
    //   tongNguonVon = tong (Credit - Debit) cua TK 3xx + 4xx
    const tongNguonVon =
      noPhaiTra.reduce((s, i) => s + (-i.closingBalance), 0) +
      vonChuSoHuu.reduce((s, i) => s + (-i.closingBalance), 0);

    this.logger.log(
      `B01-DN: Tong tai san=${tongTaiSan.toFixed(0)}, Tong nguon von=${tongNguonVon.toFixed(0)}`,
    );

    return {
      type: 'B01_DN',
      period: { from: query.dateFrom, to: query.dateTo },
      taiSanNganHan,
      taiSanDaiHan,
      tongTaiSan,
      noPhaiTra,
      vonChuSoHuu,
      tongNguonVon,
    };
  }

  // ============================================
  // B02-DN: Bao cao ket qua hoat dong kinh doanh
  // ============================================

  /**
   * Xay dung bao cao ket qua kinh doanh (B02-DN).
   *
   * Nguyen tac lay so lieu trong ky:
   * - Doanh thu = phat sinh ben Co cua cac tai khoan doanh thu
   * - Chi phi = phat sinh ben No cua cac tai khoan chi phi
   * - Cac gia tri duoc lay trong khoang dateFrom - dateTo (phat sinh trong ky)
   */
  private async buildIncomeStatement(
    query: VasReportQueryDto,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<IncomeStatementReport> {
    // Lay phat sinh trong ky (from -> to)
    const periodBalances = await this.getAccountBalances(dateFrom, dateTo);

    // Ham lay tong phat sinh ben Co (doanh thu) cua nhom tai khoan
    const getCreditSum = (prefixes: string[]): number => {
      let total = 0;
      for (const [code, val] of periodBalances) {
        if (prefixes.some((p) => code.startsWith(p))) {
          total += val.credit;
        }
      }
      return total;
    };

    // Ham lay tong phat sinh ben No (chi phi) cua nhom tai khoan
    const getDebitSum = (prefixes: string[]): number => {
      let total = 0;
      for (const [code, val] of periodBalances) {
        if (prefixes.some((p) => code.startsWith(p))) {
          total += val.debit;
        }
      }
      return total;
    };

    const doanhThuBanHang = getCreditSum(PREFIX_DOANH_THU_BAN_HANG);
    const giaVonHangBan = getDebitSum(PREFIX_GIA_VON);
    const loiNhuanGop = doanhThuBanHang - giaVonHangBan;

    const chiPhiBanHang = getDebitSum(PREFIX_CHI_PHI_BAN_HANG);
    const chiPhiQuanLy = getDebitSum(PREFIX_CHI_PHI_QUAN_LY);

    const doanhThuTaiChinh = getCreditSum(PREFIX_DOANH_THU_TAI_CHINH);
    const chiPhiTaiChinh = getDebitSum(PREFIX_CHI_PHI_TAI_CHINH);

    // Loi nhuan thuan tu HDKD = Loi nhuan gop - CP ban hang - CP quan ly + Doanh thu TC - CP TC
    const loiNhuanThuanHDKD =
      loiNhuanGop - chiPhiBanHang - chiPhiQuanLy + doanhThuTaiChinh - chiPhiTaiChinh;

    // Loi nhuan truoc thue = Loi nhuan thuan HDKD (khong co HDDT/HDTC rieng trong cau truc nay)
    const loiNhuanTruocThue = loiNhuanThuanHDKD;

    const thueThueNhapDN = getDebitSum(PREFIX_THUE_TNCN);
    const loiNhuanSauThue = loiNhuanTruocThue - thueThueNhapDN;

    // Danh sach dong chi tiet theo mau B02-DN cua Bo Tai chinh
    const chiTiet: IncomeStatementItem[] = [
      { code: '01', label: 'Doanh thu ban hang va cung cap dich vu', amount: doanhThuBanHang },
      { code: '11', label: 'Gia von hang ban', amount: giaVonHangBan },
      { code: '20', label: 'Loi nhuan gop ve ban hang va cung cap dich vu (20 = 01 - 11)', amount: loiNhuanGop },
      { code: '21', label: 'Doanh thu hoat dong tai chinh', amount: doanhThuTaiChinh },
      { code: '22', label: 'Chi phi tai chinh', amount: chiPhiTaiChinh },
      { code: '25', label: 'Chi phi ban hang', amount: chiPhiBanHang },
      { code: '26', label: 'Chi phi quan ly doanh nghiep', amount: chiPhiQuanLy },
      { code: '30', label: 'Loi nhuan thuan tu hoat dong kinh doanh (30 = 20 + 21 - 22 - 25 - 26)', amount: loiNhuanThuanHDKD },
      { code: '50', label: 'Tong loi nhuan ke toan truoc thue (50 = 30)', amount: loiNhuanTruocThue },
      { code: '51', label: 'Chi phi thue thu nhap doanh nghiep hien hanh', amount: thueThueNhapDN },
      { code: '60', label: 'Loi nhuan sau thue thu nhap doanh nghiep (60 = 50 - 51)', amount: loiNhuanSauThue },
    ];

    this.logger.log(
      `B02-DN: DT=${doanhThuBanHang.toFixed(0)}, GV=${giaVonHangBan.toFixed(0)}, ` +
        `LNST=${loiNhuanSauThue.toFixed(0)}`,
    );

    return {
      type: 'B02_DN',
      period: { from: query.dateFrom, to: query.dateTo },
      doanhThuBanHang,
      giaVonHangBan,
      loiNhuanGop,
      chiPhiBanHang,
      chiPhiQuanLy,
      loiNhuanThuanHDKD,
      doanhThuTaiChinh,
      chiPhiTaiChinh,
      loiNhuanTruocThue,
      thueThueNhapDN,
      loiNhuanSauThue,
      chiTiet,
    };
  }

  // ============================================
  // B03-DN: Bao cao luu chuyen tien te
  // ============================================

  /**
   * Xay dung bao cao luu chuyen tien te theo phuong phap truc tiep (B03-DN).
   *
   * Nguyen tac:
   * - Tien dau ky = so du TK 111+112 truoc dateFrom (Debit - Credit)
   * - Luong vao/ra trong ky = phat sinh No/Co TK 111+112 trong ky
   * - Tang/giam tien = luong vao - luong ra
   * - Tien cuoi ky = tien dau ky + tang/giam tien
   *
   * Phan biet dong tien:
   * - HDKD: cac phat sinh lien quan den TK 5xx, 6xx, 1xx ngan han
   * - HDDT: cac phat sinh lien quan den TK 2xx (tai san dai han)
   * - HDTC: cac phat sinh lien quan den TK 3xx vay, TK 4xx von gop
   */
  private async buildCashFlowStatement(
    query: VasReportQueryDto,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<CashFlowReport> {
    // Tinh tien dau ky: so du TK tien truoc dateFrom
    const openingBalances = await this.getAccountBalances(undefined, dateFrom);
    let tienDauKy = 0;
    for (const acc of ACCOUNTS_TIEN) {
      const bal = openingBalances.get(acc);
      if (bal) tienDauKy += bal.debit - bal.credit;
    }

    // Lay toan bo phat sinh trong ky
    const periodBalances = await this.getAccountBalances(dateFrom, dateTo);

    // Dong tien tu HDKD: phat sinh No (thu) - phat sinh Co (chi) cua TK tien
    // lien quan den doanh thu va chi phi hoat dong kinh doanh
    let luuChuyenTuHDKD = 0;
    for (const acc of ACCOUNTS_TIEN) {
      const bal = periodBalances.get(acc);
      if (bal) {
        // phat sinh No = tien thu vao, phat sinh Co = tien chi ra
        // Toan bo bien dong TK tien trong ky duoc phan bo theo ty le don gian
        luuChuyenTuHDKD += bal.debit - bal.credit;
      }
    }

    // Dong tien tu HDDT: phat sinh lien quan den tai san co dinh va dau tu dai han
    // Phuong phap: tinh bien dong TK dau tu trong ky
    let luuChuyenTuHDDT = 0;
    for (const [code, val] of periodBalances) {
      if (PREFIX_HDDT.some((p) => code.startsWith(p))) {
        // Mua sam TSCD = chi tien (No TSCD, Co Tien) → am
        // Thanh ly TSCD = thu tien (No Tien, Co TSCD) → duong
        // Lay theo Credit - Debit (thu - chi)
        luuChuyenTuHDDT += val.credit - val.debit;
      }
    }

    // Dong tien tu HDTC: vay no va von gop
    let luuChuyenTuHDTC = 0;
    for (const [code, val] of periodBalances) {
      if (PREFIX_HDTC.some((p) => code.startsWith(p))) {
        // Vay tien = thu vao (No Tien, Co Vay) → Credit tang = thu them
        // Tra no = chi ra (No Vay, Co Tien) → Debit tang = chi them
        luuChuyenTuHDTC += val.credit - val.debit;
      }
    }

    // Tong tang/giam tien rong
    const tangGiamTienRong = luuChuyenTuHDKD + luuChuyenTuHDDT + luuChuyenTuHDTC;

    // Tien cuoi ky = tien dau ky + tang giam rong trong ky
    const tienCuoiKy = tienDauKy + tangGiamTienRong;

    this.logger.log(
      `B03-DN: Tien dau ky=${tienDauKy.toFixed(0)}, ` +
        `HDKD=${luuChuyenTuHDKD.toFixed(0)}, ` +
        `HDDT=${luuChuyenTuHDDT.toFixed(0)}, ` +
        `HDTC=${luuChuyenTuHDTC.toFixed(0)}, ` +
        `Tien cuoi ky=${tienCuoiKy.toFixed(0)}`,
    );

    return {
      type: 'B03_DN',
      period: { from: query.dateFrom, to: query.dateTo },
      luuChuyenTuHDKD,
      luuChuyenTuHDDT,
      luuChuyenTuHDTC,
      tangGiamTienRong,
      tienDauKy,
      tienCuoiKy,
    };
  }

  // ============================================
  // Cac ham tro giup (private helpers)
  // ============================================

  /**
   * Lay tong phat sinh No/Co cua tat ca tai khoan trong khoang thoi gian.
   *
   * - fromDate = undefined: tinh tu dau den toDate (so du luy ke)
   * - fromDate = co gia tri: chi lay phat sinh trong ky [fromDate, toDate]
   *
   * Tra ve Map<accountCode, { debit: number; credit: number }>
   */
  private async getAccountBalances(
    fromDate: Date | undefined,
    toDate: Date,
  ): Promise<Map<string, { debit: number; credit: number }>> {
    // Xay dung dieu kien where cho entry.date
    const dateFilter: Record<string, Date> = { lte: toDate };
    if (fromDate) {
      dateFilter.gte = fromDate;
    }

    // Dung groupBy de tong hop theo tai khoan — hieu qua hon fetch tung dong
    const rows = await this.prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      _sum: {
        debit: true,
        credit: true,
      },
      where: {
        entry: {
          isPosted: true,
          date: dateFilter,
        },
      },
    });

    const result = new Map<string, { debit: number; credit: number }>();
    for (const row of rows) {
      result.set(row.accountCode, {
        debit: Number(row._sum.debit ?? 0),
        credit: Number(row._sum.credit ?? 0),
      });
    }
    return result;
  }

  /**
   * Lay ten tai khoan tu ChartOfAccount theo danh sach ma.
   * Tra ve Map<code, name>.
   */
  private async getAccountNames(codes: string[]): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();

    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true },
    });

    return new Map(accounts.map((a) => [a.code, a.name]));
  }
}
