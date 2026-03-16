import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { numberToVietnameseWords } from '@common/utils/number-to-words-vi.util';

@Injectable()
export class ContractExportService {
  private readonly logger = new Logger(ContractExportService.name);

  private readonly companyFullName: string;
  private readonly companyAddress: string;
  private readonly supportPhone: string;
  private readonly taxCode: string;
  private readonly appTitle: string;
  private readonly companyName: string;

  private fontsLoaded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.companyFullName =
      this.configService.get<string>('branding.companyFullName') || 'Công ty TNHH TBS Group';
    this.companyName =
      this.configService.get<string>('branding.companyName') || 'TBS Group';
    this.companyAddress =
      this.configService.get<string>('branding.companyAddress') || '';
    this.supportPhone =
      this.configService.get<string>('branding.supportPhone') || '';
    this.taxCode =
      this.configService.get<string>('branding.taxCode') || '';
    this.appTitle =
      this.configService.get<string>('branding.appTitle') || 'ERP System';
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '_______________';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  private formatCurrency(value: number | any): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(value ?? 0));
  }

  /** Trả về ngày, tháng, năm tách riêng để điền vào câu "ngày __ tháng __ năm __" */
  private splitDate(date: Date | string | null | undefined): { day: string; month: string; year: string } {
    if (!date) {
      return { day: '___', month: '___', year: '______' };
    }
    const d = new Date(date);
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      year: String(d.getFullYear()),
    };
  }

  private ensurePdfFonts(): void {
    if (this.fontsLoaded) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfmake = require('pdfmake');
    const fontsDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'node_modules',
      'pdfmake',
      'fonts',
      'Roboto',
    );

    pdfmake.virtualfs.writeFileSync(
      'Roboto-Regular.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf')),
    );
    pdfmake.virtualfs.writeFileSync(
      'Roboto-Medium.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-Medium.ttf')),
    );
    pdfmake.virtualfs.writeFileSync(
      'Roboto-Italic.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-Italic.ttf')),
    );
    pdfmake.virtualfs.writeFileSync(
      'Roboto-MediumItalic.ttf',
      fs.readFileSync(path.join(fontsDir, 'Roboto-MediumItalic.ttf')),
    );

    pdfmake.setFonts({
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    });

    this.fontsLoaded = true;
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  private async getContractData(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
            email: true,
            taxCode: true,
            address: true,
            tier: true,
          },
        },
        sale: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng`);
    }

    return contract;
  }

  // -------------------------------------------------------------------------
  // PDF generation
  // -------------------------------------------------------------------------

  /**
   * Tạo file PDF hợp đồng ủy thác nhập khẩu theo mẫu chuẩn tiếng Việt.
   */
  async generatePdf(contractId: string): Promise<Buffer> {
    const contract = await this.getContractData(contractId);

    this.ensurePdfFonts();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfmake = require('pdfmake');

    const BLUE = '#1A56DB';
    const DARK_BLUE = '#1E3A5F';
    const GRAY = '#555555';
    const LIGHT_GRAY = '#888888';
    const BORDER_GRAY = '#CCCCCC';

    const customer = contract.customer;
    const sale = contract.sale;

    const totalValueNum = Number(contract.totalValue ?? 0);
    const depositRequiredNum = Number(contract.depositRequired ?? 0);

    const totalValueWords = numberToVietnameseWords(totalValueNum);
    const depositWords = numberToVietnameseWords(depositRequiredNum);

    const effectiveDateParts = this.splitDate(contract.effectiveDate);
    const expiryDateParts = this.splitDate(contract.expiryDate);

    // Địa điểm ký kết: Hà Nội (hoặc tùy chỉnh từ address nếu có)
    const signingPlace = 'Hà Nội';

    // Thông tin Bên A (Công ty)
    const partyAName = this.companyFullName;
    const partyAAddress = this.companyAddress || '_______________';
    const partyAPhone = this.supportPhone || '_______________';
    const partyATaxCode = this.taxCode || '_______________';
    const partyARepresentative = sale?.fullName || '_______________';

    // Thông tin Bên B (Khách hàng)
    const partyBName = customer?.companyName || customer?.fullName || '_______________';
    const partyBAddress = (customer as any)?.address || '_______________';
    const partyBPhone = customer?.phone || '_______________';
    const partyBTaxCode = (customer as any)?.taxCode || '_______________';
    const partyBRepresentative = customer?.fullName || '_______________';

    // Helper: tạo hàng thông tin hai cột (nhãn | giá trị)
    const infoRow = (label: string, value: string): any[] => [
      { text: label, style: 'fieldLabel', border: [false, false, false, false] },
      { text: value || '_______________', style: 'fieldValue', border: [false, false, false, false] },
    ];

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [55, 50, 55, 60],
      info: {
        title: `Hợp đồng ${contract.code}`,
        author: this.appTitle,
        subject: 'Hợp đồng ủy thác nhập khẩu',
        creator: this.appTitle,
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        lineHeight: 1.4,
      },
      styles: {
        // Tiêu đề nhà nước
        stateTitle: {
          fontSize: 11,
          bold: true,
          alignment: 'center',
          color: DARK_BLUE,
        },
        stateSub: {
          fontSize: 10,
          italics: true,
          alignment: 'center',
          color: DARK_BLUE,
          margin: [0, 2, 0, 0] as [number, number, number, number],
        },
        // Tiêu đề hợp đồng
        contractTitle: {
          fontSize: 16,
          bold: true,
          alignment: 'center',
          margin: [0, 12, 0, 4] as [number, number, number, number],
        },
        contractCode: {
          fontSize: 11,
          italics: true,
          alignment: 'center',
          color: GRAY,
        },
        // Tiêu đề điều khoản
        articleTitle: {
          fontSize: 11,
          bold: true,
          margin: [0, 14, 0, 6] as [number, number, number, number],
        },
        // Nhãn bên
        partyHeader: {
          fontSize: 10,
          bold: true,
          color: BLUE,
          margin: [0, 6, 0, 4] as [number, number, number, number],
        },
        // Nhãn trường thông tin
        fieldLabel: {
          fontSize: 9,
          bold: true,
          color: GRAY,
        },
        // Giá trị trường thông tin
        fieldValue: {
          fontSize: 9,
        },
        // Nội dung điều khoản
        clauseText: {
          fontSize: 10,
          margin: [0, 3, 0, 0] as [number, number, number, number],
        },
        // Bullet item
        bulletItem: {
          fontSize: 10,
          margin: [12, 2, 0, 0] as [number, number, number, number],
        },
        // Chữ ký
        sigTitle: {
          fontSize: 11,
          bold: true,
          alignment: 'center',
        },
        sigSub: {
          fontSize: 9,
          italics: true,
          color: LIGHT_GRAY,
          alignment: 'center',
          margin: [0, 2, 0, 0] as [number, number, number, number],
        },
        // Số tiền nổi bật
        amountHighlight: {
          fontSize: 10,
          bold: true,
          color: DARK_BLUE,
        },
        amountWords: {
          fontSize: 9,
          italics: true,
          color: GRAY,
        },
      },

      content: [
        // ==============================================================
        // PHẦN ĐẦU: TIÊU ĐỀ NHÀ NƯỚC
        // ==============================================================
        { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', style: 'stateTitle' },
        { text: 'Độc lập - Tự do - Hạnh phúc', style: 'stateSub' },
        {
          text: '───────────────────────',
          alignment: 'center',
          color: BORDER_GRAY,
          fontSize: 9,
          margin: [0, 4, 0, 0] as [number, number, number, number],
        },

        // Địa điểm, ngày ký
        {
          text: [
            { text: `${signingPlace}, ngày `, fontSize: 9, italics: true, color: GRAY },
            { text: effectiveDateParts.day, fontSize: 9, italics: true, bold: true, color: GRAY },
            { text: ' tháng ', fontSize: 9, italics: true, color: GRAY },
            { text: effectiveDateParts.month, fontSize: 9, italics: true, bold: true, color: GRAY },
            { text: ' năm ', fontSize: 9, italics: true, color: GRAY },
            { text: effectiveDateParts.year, fontSize: 9, italics: true, bold: true, color: GRAY },
          ],
          alignment: 'right',
          margin: [0, 6, 0, 0] as [number, number, number, number],
        },

        // ==============================================================
        // TIÊU ĐỀ HỢP ĐỒNG
        // ==============================================================
        { text: 'HỢP ĐỒNG ỦY THÁC NHẬP KHẨU', style: 'contractTitle' },
        {
          text: `Số: ${contract.code}`,
          style: 'contractCode',
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },

        // Đường kẻ phân cách
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 485,
              y2: 0,
              lineWidth: 1.5,
              lineColor: BLUE,
            },
          ],
          margin: [0, 0, 0, 12] as [number, number, number, number],
        },

        // ==============================================================
        // CĂN CỨ PHÁP LÝ
        // ==============================================================
        {
          text: 'Căn cứ:',
          fontSize: 10,
          bold: true,
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
        {
          text: '- Bộ Luật Dân sự nước Cộng hòa Xã hội Chủ nghĩa Việt Nam năm 2015;',
          style: 'bulletItem',
        },
        {
          text: '- Luật Thương mại Việt Nam số 36/2005/QH11 ngày 14/06/2005;',
          style: 'bulletItem',
        },
        {
          text: '- Luật Hải quan số 54/2014/QH13 ngày 23/06/2014 và các văn bản hướng dẫn thi hành;',
          style: 'bulletItem',
        },
        {
          text: '- Nghị định số 08/2015/NĐ-CP ngày 21/01/2015 của Chính phủ quy định chi tiết và biện pháp thi hành Luật Hải quan;',
          style: 'bulletItem',
        },
        {
          text: '- Năng lực, nhu cầu và thỏa thuận của hai bên;',
          style: 'bulletItem',
          margin: [12, 2, 0, 10] as [number, number, number, number],
        },

        {
          text: [
            { text: 'Hôm nay, ngày ' },
            { text: effectiveDateParts.day, bold: true },
            { text: ' tháng ' },
            { text: effectiveDateParts.month, bold: true },
            { text: ' năm ' },
            { text: effectiveDateParts.year, bold: true },
            {
              text: ', tại văn phòng Bên A, chúng tôi gồm có:',
            },
          ],
          fontSize: 10,
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },

        // ==============================================================
        // ĐIỀU 1: THÔNG TIN CÁC BÊN
        // ==============================================================
        { text: 'ĐIỀU 1: THÔNG TIN CÁC BÊN', style: 'articleTitle' },

        // Bên A
        { text: 'BÊN ỦY THÁC (BÊN A):', style: 'partyHeader' },
        {
          table: {
            widths: [120, '*'],
            body: [
              infoRow('Tên công ty:', partyAName),
              infoRow('Địa chỉ:', partyAAddress),
              infoRow('Điện thoại:', partyAPhone),
              infoRow('Mã số thuế:', partyATaxCode),
              infoRow('Đại diện:', partyARepresentative),
              infoRow('Chức vụ:', '_______________'),
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 8] as [number, number, number, number],
        },

        // Bên B
        { text: 'BÊN NHẬN ỦY THÁC (BÊN B):', style: 'partyHeader' },
        {
          table: {
            widths: [120, '*'],
            body: [
              infoRow('Tên khách hàng/Công ty:', partyBName),
              infoRow('Địa chỉ:', partyBAddress),
              infoRow('Điện thoại:', partyBPhone),
              infoRow('Mã số thuế:', partyBTaxCode),
              infoRow('Đại diện:', partyBRepresentative),
              infoRow('Chức vụ:', '_______________'),
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },

        {
          text: 'Hai bên thống nhất ký kết Hợp đồng Ủy thác Nhập khẩu với các điều khoản và điều kiện sau đây:',
          style: 'clauseText',
          margin: [0, 6, 0, 4] as [number, number, number, number],
        },

        // ==============================================================
        // ĐIỀU 2: NỘI DUNG ỦY THÁC
        // ==============================================================
        { text: 'ĐIỀU 2: NỘI DUNG ỦY THÁC', style: 'articleTitle' },

        {
          text: '2.1. Bên A ủy thác cho Bên B thực hiện toàn bộ thủ tục nhập khẩu hàng hóa theo quy định của pháp luật Việt Nam, bao gồm nhưng không giới hạn:',
          style: 'clauseText',
        },
        {
          text: '- Khai báo hải quan và làm thủ tục thông quan hàng hóa nhập khẩu;',
          style: 'bulletItem',
        },
        {
          text: '- Nộp các loại thuế, phí hải quan theo quy định của pháp luật;',
          style: 'bulletItem',
        },
        {
          text: '- Kiểm tra, giám sát hàng hóa tại cửa khẩu;',
          style: 'bulletItem',
        },
        {
          text: '- Vận chuyển hàng hóa từ cửa khẩu về kho của Bên A hoặc địa điểm do Bên A chỉ định;',
          style: 'bulletItem',
        },
        {
          text: '- Thực hiện các thủ tục hành chính liên quan khác theo yêu cầu của Bên A.',
          style: 'bulletItem',
        },
        {
          text: '2.2. Bên B cam kết thực hiện đúng các nội dung ủy thác, bảo vệ quyền và lợi ích hợp pháp của Bên A.',
          style: 'clauseText',
          margin: [0, 6, 0, 0] as [number, number, number, number],
        },
        {
          text: '2.3. Thời hạn thực hiện ủy thác: Kể từ ngày ký hợp đồng đến hết ngày ' +
            (contract.expiryDate
              ? `${expiryDateParts.day}/${expiryDateParts.month}/${expiryDateParts.year}`
              : '_______________') + '.',
          style: 'clauseText',
        },

        // ==============================================================
        // ĐIỀU 3: GIÁ TRỊ HỢP ĐỒNG & THANH TOÁN
        // ==============================================================
        { text: 'ĐIỀU 3: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN', style: 'articleTitle' },

        {
          text: '3.1. Giá trị hợp đồng:',
          style: 'clauseText',
          bold: true,
        },
        {
          columns: [
            { width: 20, text: '' },
            {
              width: '*',
              stack: [
                {
                  text: [
                    { text: 'Tổng giá trị: ' },
                    { text: this.formatCurrency(totalValueNum), style: 'amountHighlight' },
                  ],
                  fontSize: 10,
                  margin: [0, 4, 0, 2] as [number, number, number, number],
                },
                {
                  text: `(Bằng chữ: ${totalValueWords})`,
                  style: 'amountWords',
                  margin: [0, 0, 0, 4] as [number, number, number, number],
                },
              ],
            },
          ],
        },

        {
          text: '3.2. Tạm ứng/Đặt cọc:',
          style: 'clauseText',
          bold: true,
        },
        {
          columns: [
            { width: 20, text: '' },
            {
              width: '*',
              stack: [
                {
                  text: [
                    { text: 'Số tiền đặt cọc: ' },
                    { text: this.formatCurrency(depositRequiredNum), style: 'amountHighlight' },
                  ],
                  fontSize: 10,
                  margin: [0, 4, 0, 2] as [number, number, number, number],
                },
                {
                  text: `(Bằng chữ: ${depositWords})`,
                  style: 'amountWords',
                  margin: [0, 0, 0, 4] as [number, number, number, number],
                },
              ],
            },
          ],
        },

        {
          text: '3.3. Phương thức thanh toán:',
          style: 'clauseText',
          bold: true,
        },
        {
          text: '- Bên A thanh toán cho Bên B bằng chuyển khoản ngân hàng hoặc theo thỏa thuận của hai bên;',
          style: 'bulletItem',
        },
        {
          text: '- Tiền đặt cọc được thanh toán trong vòng 03 ngày làm việc kể từ ngày ký hợp đồng;',
          style: 'bulletItem',
        },
        {
          text: '- Số tiền còn lại được thanh toán theo tiến độ thực hiện hợp đồng hoặc khi hàng hóa được thông quan và bàn giao;',
          style: 'bulletItem',
        },
        {
          text: '- Mọi chi phí phát sinh ngoài hợp đồng (thuế, phí lưu kho, phạt chậm thông quan...) do hai bên thỏa thuận bổ sung bằng văn bản.',
          style: 'bulletItem',
        },

        // ==============================================================
        // ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ BÊN A
        // ==============================================================
        { text: 'ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ BÊN A', style: 'articleTitle' },

        {
          text: '4.1. Quyền của Bên A:',
          style: 'clauseText',
          bold: true,
        },
        {
          text: '- Yêu cầu Bên B cung cấp thông tin, báo cáo tiến độ thực hiện ủy thác;',
          style: 'bulletItem',
        },
        {
          text: '- Kiểm tra, giám sát toàn bộ quá trình thực hiện ủy thác của Bên B;',
          style: 'bulletItem',
        },
        {
          text: '- Yêu cầu Bên B bồi thường thiệt hại nếu vi phạm hợp đồng.',
          style: 'bulletItem',
        },
        {
          text: '4.2. Nghĩa vụ của Bên A:',
          style: 'clauseText',
          bold: true,
          margin: [0, 6, 0, 0] as [number, number, number, number],
        },
        {
          text: '- Cung cấp đầy đủ, chính xác hồ sơ, chứng từ cần thiết cho Bên B để thực hiện ủy thác;',
          style: 'bulletItem',
        },
        {
          text: '- Thanh toán đầy đủ, đúng hạn theo thỏa thuận;',
          style: 'bulletItem',
        },
        {
          text: '- Chịu trách nhiệm về tính hợp pháp của hàng hóa nhập khẩu.',
          style: 'bulletItem',
        },

        // ==============================================================
        // ĐIỀU 5: QUYỀN VÀ NGHĨA VỤ BÊN B
        // ==============================================================
        { text: 'ĐIỀU 5: QUYỀN VÀ NGHĨA VỤ BÊN B', style: 'articleTitle' },

        {
          text: '5.1. Quyền của Bên B:',
          style: 'clauseText',
          bold: true,
        },
        {
          text: '- Nhận đầy đủ tài liệu, thông tin từ Bên A để thực hiện ủy thác;',
          style: 'bulletItem',
        },
        {
          text: '- Yêu cầu Bên A thanh toán đúng hạn theo hợp đồng;',
          style: 'bulletItem',
        },
        {
          text: '- Thu thêm chi phí phát sinh được hai bên xác nhận bằng văn bản.',
          style: 'bulletItem',
        },
        {
          text: '5.2. Nghĩa vụ của Bên B:',
          style: 'clauseText',
          bold: true,
          margin: [0, 6, 0, 0] as [number, number, number, number],
        },
        {
          text: '- Thực hiện đúng, đủ các nội dung ủy thác theo Điều 2 của hợp đồng này;',
          style: 'bulletItem',
        },
        {
          text: '- Bảo mật thông tin về hàng hóa và hoạt động kinh doanh của Bên A;',
          style: 'bulletItem',
        },
        {
          text: '- Thông báo kịp thời cho Bên A về các vướng mắc, rủi ro phát sinh trong quá trình thực hiện ủy thác;',
          style: 'bulletItem',
        },
        {
          text: '- Bồi thường thiệt hại cho Bên A nếu vi phạm hợp đồng.',
          style: 'bulletItem',
        },

        // ==============================================================
        // ĐIỀU 6: ĐIỀU KHOẢN CHUNG
        // ==============================================================
        { text: 'ĐIỀU 6: ĐIỀU KHOẢN CHUNG', style: 'articleTitle' },

        {
          text: '6.1. Hợp đồng này có hiệu lực kể từ ngày ký và kết thúc khi hoàn thành nghĩa vụ hoặc theo thỏa thuận của hai bên.',
          style: 'clauseText',
        },
        {
          text: '6.2. Mọi sửa đổi, bổ sung hợp đồng phải được thực hiện bằng văn bản và có chữ ký xác nhận của cả hai bên.',
          style: 'clauseText',
        },
        {
          text: '6.3. Trong trường hợp phát sinh tranh chấp, hai bên ưu tiên giải quyết thông qua thương lượng, hòa giải. Nếu không đạt được thỏa thuận, tranh chấp được đưa ra Tòa án nhân dân có thẩm quyền để giải quyết.',
          style: 'clauseText',
        },
        {
          text: '6.4. Hợp đồng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.',
          style: 'clauseText',
        },

        // Ghi chú hợp đồng (nếu có)
        ...(contract.note
          ? [
              {
                text: [
                  { text: 'Ghi chú: ', bold: true, fontSize: 9 },
                  { text: contract.note, italics: true, fontSize: 9 },
                ],
                margin: [0, 10, 0, 0] as [number, number, number, number],
                color: GRAY,
              },
            ]
          : []),

        // ==============================================================
        // CHỮ KÝ
        // ==============================================================
        {
          margin: [0, 32, 0, 0] as [number, number, number, number],
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'ĐẠI DIỆN BÊN A', style: 'sigTitle' },
                { text: '(Ký, ghi rõ họ tên, đóng dấu)', style: 'sigSub' },
                { text: '\n\n\n\n', fontSize: 9 },
                {
                  text: partyARepresentative !== '_______________' ? partyARepresentative : '',
                  bold: true,
                  fontSize: 10,
                  alignment: 'center',
                },
                {
                  text: partyAName,
                  fontSize: 8,
                  color: GRAY,
                  alignment: 'center',
                },
              ],
            },
            {
              width: '50%',
              stack: [
                { text: 'ĐẠI DIỆN BÊN B', style: 'sigTitle' },
                { text: '(Ký, ghi rõ họ tên, đóng dấu)', style: 'sigSub' },
                { text: '\n\n\n\n', fontSize: 9 },
                {
                  text: partyBRepresentative !== '_______________' ? partyBRepresentative : '',
                  bold: true,
                  fontSize: 10,
                  alignment: 'center',
                },
                {
                  text: partyBName !== '_______________' ? partyBName : '',
                  fontSize: 8,
                  color: GRAY,
                  alignment: 'center',
                },
              ],
            },
          ],
        },
      ],

      footer: (_currentPage: number, _pageCount: number) => ({
        columns: [
          {
            text: `Hợp đồng số: ${contract.code}  |  Tạo bởi ${this.appTitle} ngày ${this.formatDate(new Date())}`,
            alignment: 'center',
            fontSize: 7,
            color: LIGHT_GRAY,
            margin: [50, 10, 50, 0],
          },
        ],
      }),
    };

    const doc = pdfmake.createPdf(docDefinition);
    const buffer: Buffer = await doc.getBuffer();
    this.logger.log(`PDF export generated for contract ${contract.code}`);
    return buffer;
  }
}
