/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Package, CreditCard, Scale, AlertTriangle, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description: 'Điều khoản và điều kiện sử dụng dịch vụ của TBS Logistics. Quy định về quyền và trách nhiệm của khách hàng khi sử dụng dịch vụ vận chuyển.',
  robots: {
    index: false,
    follow: false,
  },
};

const lastUpdated = '2024-01-15';

const sections = [
  {
    icon: FileText,
    title: '1. Giới thiệu và chấp nhận điều khoản',
    content: [
      'Chào mừng bạn đến với TBS Logistics. Các Điều khoản Sử dụng này ("Điều khoản") là thỏa thuận pháp lý giữa bạn ("Khách hàng", "bạn") và Công ty TNHH TBS Logistics ("TBS", "chúng tôi", "của chúng tôi").',
      'Bằng cách truy cập hoặc sử dụng các dịch vụ của TBS Logistics, bao gồm website, ứng dụng di động, và các dịch vụ liên quan, bạn xác nhận rằng:',
      {
        items: [
          'Bạn đã đọc, hiểu và đồng ý tuân thủ các Điều khoản này',
          'Bạn có đủ năng lực pháp lý để ký kết hợp đồng có tính ràng buộc',
          'Bạn ít nhất 18 tuổi hoặc có sự đồng ý của người giám hộ hợp pháp',
          'Thông tin bạn cung cấp là chính xác, đầy đủ và cập nhật',
        ],
      },
      'Nếu bạn không đồng ý với bất kỳ phần nào của Điều khoản này, vui lòng không sử dụng dịch vụ của chúng tôi.',
    ],
  },
  {
    icon: Package,
    title: '2. Mô tả dịch vụ',
    content: [
      'TBS Logistics cung cấp các dịch vụ vận chuyển và logistics quốc tế, chủ yếu từ Trung Quốc về Việt Nam, bao gồm nhưng không giới hạn:',
      {
        subtitle: 'Các dịch vụ chính:',
        items: [
          'Vận chuyển hàng hóa đường bộ, đường biển, đường hàng không',
          'Dịch vụ mua hàng hộ và đặt hàng từ Trung Quốc',
          'Ủy thác xuất nhập khẩu và khai báo hải quan',
          'Dịch vụ kho bãi, đóng gói và kiểm hàng',
          'Dịch vụ LCL (Less than Container Load) chính ngạch',
          'Tư vấn và hỗ trợ thương mại quốc tế',
        ],
      },
      'Chi tiết về từng dịch vụ, giá cả, thời gian và điều kiện áp dụng sẽ được thỏa thuận cụ thể khi bạn đặt hàng.',
    ],
  },
  {
    icon: FileText,
    title: '3. Trách nhiệm của khách hàng',
    content: [
      'Khi sử dụng dịch vụ của TBS Logistics, bạn cam kết và chịu trách nhiệm về:',
      {
        subtitle: 'Về thông tin và hàng hóa:',
        items: [
          'Cung cấp thông tin chính xác, đầy đủ về hàng hóa (tên, số lượng, giá trị, xuất xứ)',
          'Đảm bảo hàng hóa không thuộc danh mục cấm hoặc hạn chế xuất nhập khẩu',
          'Tuân thủ các quy định pháp luật về hải quan, thuế và xuất nhập khẩu',
          'Kê khai đúng giá trị hàng hóa để tránh vi phạm pháp luật',
          'Đóng gói hàng hóa đúng cách hoặc yêu cầu dịch vụ đóng gói của chúng tôi',
        ],
      },
      {
        subtitle: 'Về thanh toán và phí:',
        items: [
          'Thanh toán đầy đủ, đúng hạn các khoản phí theo thỏa thuận',
          'Chịu mọi chi phí phát sinh do kê khai sai, hàng hóa không đúng quy định',
          'Thanh toán các khoản thuế, phí hải quan theo quy định pháp luật',
        ],
      },
      {
        subtitle: 'Về sử dụng dịch vụ:',
        items: [
          'Không sử dụng dịch vụ cho mục đích bất hợp pháp',
          'Không gửi hàng cấm, hàng nguy hiểm, hàng vi phạm bản quyền',
          'Tuân thủ hướng dẫn và quy trình của TBS Logistics',
          'Phối hợp cung cấp thông tin và giấy tờ khi được yêu cầu',
        ],
      },
    ],
  },
  {
    icon: Package,
    title: '4. Trách nhiệm của TBS Logistics',
    content: [
      'TBS Logistics cam kết:',
      {
        items: [
          'Cung cấp dịch vụ vận chuyển an toàn, đúng hạn trong phạm vi khả năng',
          'Thông báo kịp thời về tình trạng hàng hóa trong quá trình vận chuyển',
          'Bảo mật thông tin khách hàng theo Chính sách Bảo mật',
          'Hỗ trợ giải quyết các vấn đề phát sinh trong quá trình sử dụng dịch vụ',
          'Tuân thủ các quy định pháp luật hiện hành',
        ],
      },
      'TBS Logistics sẽ nỗ lực tối đa để đảm bảo chất lượng dịch vụ. Tuy nhiên, chúng tôi không chịu trách nhiệm trong các trường hợp:',
      {
        items: [
          'Khách hàng cung cấp thông tin sai lệch, không đầy đủ',
          'Hàng hóa bị hải quan tạm giữ, tịch thu do vi phạm quy định',
          'Sự cố bất khả kháng (thiên tai, chiến tranh, dịch bệnh, chính sách nhà nước)',
          'Hư hỏng do bản chất hàng hóa hoặc đóng gói không phù hợp',
          'Chậm trễ do các bên thứ ba (hãng vận tải, hải quan)',
        ],
      },
    ],
  },
  {
    icon: AlertTriangle,
    title: '5. Hàng hóa cấm và hạn chế',
    content: [
      'TBS Logistics nghiêm cấm vận chuyển các loại hàng hóa sau:',
      {
        subtitle: 'Hàng cấm tuyệt đối:',
        items: [
          'Vũ khí, đạn dược, chất nổ',
          'Ma túy, chất gây nghiện, tiền chất',
          'Hàng giả, hàng nhái, hàng vi phạm bản quyền',
          'Động vật sống, xác động vật',
          'Hàng khiêu dâm, đồ phản động',
          'Chất độc hại, chất phóng xạ',
          'Tiền mặt, giấy tờ có giá trị',
        ],
      },
      {
        subtitle: 'Hàng hạn chế (cần giấy phép):',
        items: [
          'Thực phẩm chức năng, thuốc chữa bệnh',
          'Mỹ phẩm, hóa chất',
          'Thiết bị viễn thông, thiết bị có tần số',
          'Pin lithium, hàng có pin',
          'Đồ cổ, hiện vật có giá trị văn hóa',
        ],
      },
      'Khách hàng chịu hoàn toàn trách nhiệm pháp lý nếu gửi các loại hàng nêu trên. TBS Logistics có quyền từ chối vận chuyển mà không cần lý do.',
    ],
  },
  {
    icon: CreditCard,
    title: '6. Giá cả và thanh toán',
    content: [
      {
        subtitle: 'Giá cước vận chuyển:',
        items: [
          'Được tính dựa trên trọng lượng thực tế hoặc thể tích (lấy số lớn hơn)',
          'Có thể thay đổi theo tuyến đường, loại hàng và thời điểm',
          'Không bao gồm thuế hải quan, thuế VAT và các phí phát sinh',
          'Báo giá có hiệu lực trong thời gian nhất định',
        ],
      },
      {
        subtitle: 'Phương thức thanh toán:',
        items: [
          'Chuyển khoản ngân hàng',
          'Thanh toán qua ví điện tử',
          'Tiền mặt tại văn phòng (nếu có)',
        ],
      },
      {
        subtitle: 'Chính sách thanh toán:',
        items: [
          'Khách hàng mới: Thanh toán trước 100% hoặc theo thỏa thuận',
          'Khách hàng thường xuyên: Có thể được hưởng chính sách công nợ',
          'Hàng sẽ không được giao nếu chưa thanh toán đủ',
          'Phí chậm thanh toán có thể được áp dụng theo thỏa thuận',
        ],
      },
    ],
  },
  {
    icon: Package,
    title: '7. Thời gian vận chuyển và giao hàng',
    content: [
      'Thời gian vận chuyển được tính từ khi hàng về đến kho Trung Quốc của TBS đến khi giao hàng tại Việt Nam:',
      {
        items: [
          'Đường bộ: 7-12 ngày làm việc',
          'Đường biển: 15-25 ngày làm việc',
          'Đường hàng không: 3-7 ngày làm việc',
        ],
      },
      'Thời gian trên chỉ mang tính chất tham khảo. Thời gian thực tế có thể thay đổi do:',
      {
        items: [
          'Thời tiết, điều kiện giao thông',
          'Thủ tục hải quan',
          'Lễ, Tết và các ngày nghỉ',
          'Khối lượng hàng hóa và tuyến đường',
        ],
      },
      'TBS Logistics không chịu trách nhiệm về thiệt hại do chậm trễ trong các trường hợp bất khả kháng.',
    ],
  },
  {
    icon: AlertTriangle,
    title: '8. Bồi thường và trách nhiệm',
    content: [
      {
        subtitle: 'Bảo hiểm hàng hóa:',
        items: [
          'Khách hàng có thể mua bảo hiểm hàng hóa với phí thêm',
          'Không mua bảo hiểm: Bồi thường tối đa 3 lần cước phí vận chuyển',
          'Có mua bảo hiểm: Bồi thường theo giá trị hàng hóa đã kê khai',
        ],
      },
      {
        subtitle: 'Khiếu nại và bồi thường:',
        items: [
          'Khách hàng phải kiểm tra hàng và báo ngay khi nhận hàng',
          'Khiếu nại về hư hỏng phải được gửi trong vòng 3 ngày kể từ khi nhận hàng',
          'Cần có bằng chứng (hình ảnh, video) về tình trạng hàng hóa',
          'TBS sẽ xem xét và giải quyết trong vòng 15 ngày làm việc',
        ],
      },
      {
        subtitle: 'Trường hợp không được bồi thường:',
        items: [
          'Hư hỏng do bản chất hàng hóa, đóng gói không đúng cách',
          'Khách hàng kê khai sai thông tin',
          'Hàng bị hải quan tịch thu do vi phạm',
          'Sự kiện bất khả kháng',
          'Quá thời hạn khiếu nại',
        ],
      },
    ],
  },
  {
    icon: Scale,
    title: '9. Giải quyết tranh chấp',
    content: [
      'Mọi tranh chấp phát sinh từ hoặc liên quan đến việc sử dụng dịch vụ của TBS Logistics sẽ được giải quyết theo quy trình sau:',
      {
        items: [
          'Bước 1: Thương lượng trực tiếp giữa hai bên',
          'Bước 2: Hòa giải thông qua bên thứ ba (nếu cần)',
          'Bước 3: Giải quyết tại Trọng tài hoặc Tòa án',
        ],
      },
      'Các Điều khoản này và mọi tranh chấp liên quan sẽ được điều chỉnh bởi pháp luật Việt Nam. Tòa án có thẩm quyền tại Hà Nội hoặc Thành phố Hồ Chí Minh sẽ có thẩm quyền xét xử các tranh chấp không thể giải quyết thông qua thương lượng.',
    ],
  },
  {
    icon: FileText,
    title: '10. Sửa đổi điều khoản',
    content: [
      'TBS Logistics có quyền sửa đổi, bổ sung các Điều khoản Sử dụng này bất cứ lúc nào. Các thay đổi sẽ có hiệu lực ngay khi được đăng tải trên website.',
      'Chúng tôi khuyến khích bạn xem lại Điều khoản định kỳ. Việc bạn tiếp tục sử dụng dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.',
      'Đối với các thay đổi quan trọng, chúng tôi sẽ thông báo trước qua email hoặc thông báo trên website.',
    ],
  },
  {
    icon: FileText,
    title: '11. Chấm dứt dịch vụ',
    content: [
      'TBS Logistics có quyền tạm ngưng hoặc chấm dứt cung cấp dịch vụ cho bạn nếu:',
      {
        items: [
          'Bạn vi phạm bất kỳ điều khoản nào trong thỏa thuận này',
          'Bạn cung cấp thông tin gian dối, lừa đảo',
          'Bạn có hành vi gây thiệt hại cho TBS hoặc bên thứ ba',
          'Bạn sử dụng dịch vụ cho mục đích bất hợp pháp',
          'Có yêu cầu từ cơ quan pháp luật',
        ],
      },
      'Bạn có quyền chấm dứt sử dụng dịch vụ bất cứ lúc nào. Tuy nhiên, bạn vẫn phải hoàn thành các nghĩa vụ thanh toán và thỏa thuận đã ký kết trước đó.',
    ],
  },
  {
    icon: FileText,
    title: '12. Quyền sở hữu trí tuệ',
    content: [
      'Tất cả nội dung trên website và ứng dụng của TBS Logistics, bao gồm văn bản, hình ảnh, logo, thiết kế, mã nguồn, đều thuộc quyền sở hữu của TBS Logistics hoặc đối tác và được bảo vệ bởi luật sở hữu trí tuệ.',
      'Bạn không được sao chép, phân phối, sửa đổi, tái tạo, hoặc khai thác nội dung này cho mục đích thương mại mà không có sự đồng ý bằng văn bản của TBS Logistics.',
    ],
  },
  {
    icon: Mail,
    title: '13. Thông tin liên hệ',
    content: [
      'Nếu bạn có bất kỳ câu hỏi nào về Điều khoản Sử dụng này, vui lòng liên hệ với chúng tôi:',
      {
        items: [
          'Công ty: Công ty TNHH TBS Logistics',
          'Địa chỉ: Số XX, Đường ABC, Quận Hoàn Kiếm, Hà Nội, Việt Nam',
          'Email: legal@tbs-erp.com',
          'Điện thoại: +84 xxx xxx xxx',
          'Website: https://tbs-erp.com',
        ],
      },
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Scale className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Điều khoản sử dụng
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Các điều khoản và điều kiện điều chỉnh việc sử dụng dịch vụ của TBS Logistics.
              Vui lòng đọc kỹ trước khi sử dụng dịch vụ của chúng tôi.
            </p>
            <p className="text-sm text-muted-foreground">
              Cập nhật lần cuối: {new Date(lastUpdated).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Introduction */}
            <Card className="mb-8">
              <CardContent className="pt-6">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Xin chào và cảm ơn bạn đã quan tâm đến dịch vụ của TBS Logistics. Các Điều khoản Sử
                  dụng dưới đây thiết lập các quyền và nghĩa vụ pháp lý giữa bạn (Khách hàng) và TBS
                  Logistics khi sử dụng các dịch vụ vận chuyển và logistics của chúng tôi.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Điều khoản này có hiệu lực và tạo thành hợp đồng có tính ràng buộc pháp lý khi bạn sử
                  dụng dịch vụ của chúng tôi. Vui lòng đọc kỹ toàn bộ nội dung trước khi quyết định sử
                  dụng dịch vụ.
                </p>
              </CardContent>
            </Card>

            {/* Main Sections */}
            <div className="space-y-6">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="text-xl pt-2">{section.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {section.content.map((item, idx) => {
                          if (typeof item === 'string') {
                            return (
                              <p key={idx} className="text-muted-foreground leading-relaxed">
                                {item}
                              </p>
                            );
                          } else {
                            const objItem = item as { subtitle?: string; items: string[] };
                            return (
                              <div key={idx} className="space-y-2">
                                {objItem.subtitle && (
                                  <p className="font-semibold text-foreground">{objItem.subtitle}</p>
                                )}
                                <ul className="space-y-2 ml-6">
                                  {objItem.items?.map((listItem, listIdx) => (
                                    <li key={listIdx} className="text-muted-foreground leading-relaxed list-disc">
                                      {listItem}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Acceptance Box */}
            <Card className="mt-8 bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-3">Xác nhận chấp nhận điều khoản</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Bằng cách đánh dấu vào ô &quot;Tôi đồng ý với Điều khoản Sử dụng&quot; khi đăng ký hoặc sử dụng
                  dịch vụ, bạn xác nhận rằng:
                </p>
                <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                  <li className="list-disc">Bạn đã đọc và hiểu đầy đủ các Điều khoản Sử dụng này</li>
                  <li className="list-disc">Bạn đồng ý tuân thủ tất cả các điều khoản và điều kiện</li>
                  <li className="list-disc">Bạn có đủ năng lực pháp lý để ký kết hợp đồng này</li>
                  <li className="list-disc">Bạn chịu trách nhiệm pháp lý về việc sử dụng dịch vụ</li>
                </ul>
              </CardContent>
            </Card>

            {/* Footer Note */}
            <Card className="mt-8 bg-gray-50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong>Lưu ý quan trọng:</strong> Nếu bạn không đồng ý với bất kỳ điều khoản nào
                  trong tài liệu này, vui lòng không sử dụng dịch vụ của TBS Logistics. Việc tiếp tục
                  sử dụng dịch vụ đồng nghĩa với việc bạn chấp nhận các điều khoản này. Nếu có bất kỳ
                  thắc mắc nào, vui lòng liên hệ với chúng tôi trước khi sử dụng dịch vụ.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
