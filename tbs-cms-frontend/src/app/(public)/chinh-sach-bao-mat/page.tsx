import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Eye, UserCheck, Cookie, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật',
  description: 'Chính sách bảo mật thông tin khách hàng của TBS Logistics. Tìm hiểu cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn.',
  robots: {
    index: false,
    follow: false,
  },
};

const lastUpdated = '2024-01-15';

const sections = [
  {
    icon: Eye,
    title: '1. Thông tin chúng tôi thu thập',
    content: [
      'Khi bạn sử dụng dịch vụ của TBS Logistics, chúng tôi có thể thu thập các loại thông tin sau:',
      {
        subtitle: 'Thông tin cá nhân:',
        items: [
          'Họ tên, số điện thoại, địa chỉ email',
          'Địa chỉ giao nhận hàng',
          'Thông tin công ty (nếu có)',
          'Số CMND/CCCD (khi cần thiết cho thủ tục hải quan)',
        ],
      },
      {
        subtitle: 'Thông tin giao dịch:',
        items: [
          'Thông tin đơn hàng và lịch sử vận chuyển',
          'Thông tin thanh toán',
          'Lịch sử giao tiếp với bộ phận chăm sóc khách hàng',
        ],
      },
      {
        subtitle: 'Thông tin kỹ thuật:',
        items: [
          'Địa chỉ IP, loại trình duyệt, hệ điều hành',
          'Cookie và dữ liệu theo dõi website',
          'Thông tin thiết bị truy cập',
        ],
      },
    ],
  },
  {
    icon: UserCheck,
    title: '2. Mục đích sử dụng thông tin',
    content: [
      'Chúng tôi sử dụng thông tin của bạn cho các mục đích sau:',
      {
        items: [
          'Cung cấp và quản lý dịch vụ vận chuyển, logistics',
          'Xử lý đơn hàng, thanh toán và hoàn thành giao dịch',
          'Liên hệ với bạn về tình trạng đơn hàng',
          'Giải quyết khiếu nại và hỗ trợ khách hàng',
          'Cải thiện chất lượng dịch vụ và trải nghiệm người dùng',
          'Gửi thông báo về dịch vụ mới, khuyến mãi (với sự đồng ý của bạn)',
          'Tuân thủ các yêu cầu pháp luật và quy định của cơ quan nhà nước',
          'Phòng chống gian lận và bảo vệ quyền lợi hợp pháp',
        ],
      },
    ],
  },
  {
    icon: Lock,
    title: '3. Bảo mật thông tin',
    content: [
      'TBS Logistics cam kết bảo vệ thông tin cá nhân của bạn bằng các biện pháp sau:',
      {
        items: [
          'Mã hóa dữ liệu nhạy cảm bằng SSL/TLS',
          'Lưu trữ thông tin trên máy chủ bảo mật với tường lửa',
          'Giới hạn quyền truy cập chỉ cho nhân viên được ủy quyền',
          'Thực hiện kiểm tra bảo mật định kỳ',
          'Sao lưu dữ liệu thường xuyên để phòng ngừa mất mát',
          'Tuân thủ các tiêu chuẩn bảo mật quốc tế',
        ],
      },
      'Tuy nhiên, không có phương thức truyền tải qua Internet hoặc lưu trữ điện tử nào là an toàn 100%. Chúng tôi nỗ lực hết sức để bảo vệ thông tin của bạn nhưng không thể đảm bảo tuyệt đối.',
    ],
  },
  {
    icon: Shield,
    title: '4. Chia sẻ thông tin với bên thứ ba',
    content: [
      'Chúng tôi không bán, trao đổi hoặc cho thuê thông tin cá nhân của bạn cho bên thứ ba. Thông tin chỉ được chia sẻ trong các trường hợp sau:',
      {
        items: [
          'Đối tác vận chuyển: Để thực hiện dịch vụ giao hàng',
          'Cơ quan hải quan: Để hoàn thành thủ tục nhập khẩu theo quy định pháp luật',
          'Nhà cung cấp dịch vụ thanh toán: Để xử lý giao dịch tài chính',
          'Cơ quan pháp luật: Khi có yêu cầu hợp pháp từ cơ quan có thẩm quyền',
        ],
      },
      'Tất cả các bên thứ ba này đều cam kết bảo mật thông tin và chỉ sử dụng cho mục đích đã thỏa thuận.',
    ],
  },
  {
    icon: UserCheck,
    title: '5. Quyền của người dùng',
    content: [
      'Bạn có các quyền sau đối với thông tin cá nhân của mình:',
      {
        items: [
          'Truy cập: Yêu cầu xem thông tin cá nhân mà chúng tôi đang lưu trữ',
          'Chỉnh sửa: Yêu cầu cập nhật hoặc sửa đổi thông tin không chính xác',
          'Xóa: Yêu cầu xóa thông tin cá nhân (trừ khi cần thiết cho mục đích pháp lý)',
          'Từ chối: Từ chối việc sử dụng thông tin cho mục đích marketing',
          'Rút lại đồng ý: Rút lại sự đồng ý đã cấp trước đó bất cứ lúc nào',
          'Khiếu nại: Khiếu nại với cơ quan bảo vệ dữ liệu có thẩm quyền',
        ],
      },
      'Để thực hiện các quyền trên, vui lòng liên hệ với chúng tôi qua email: privacy@tbs-erp.com hoặc hotline: +84 xxx xxx xxx.',
    ],
  },
  {
    icon: Cookie,
    title: '6. Chính sách Cookie',
    content: [
      'Website của chúng tôi sử dụng cookie để cải thiện trải nghiệm người dùng. Cookie là các tệp văn bản nhỏ được lưu trữ trên thiết bị của bạn.',
      {
        subtitle: 'Các loại cookie chúng tôi sử dụng:',
        items: [
          'Cookie cần thiết: Để website hoạt động bình thường',
          'Cookie phân tích: Để hiểu cách người dùng tương tác với website',
          'Cookie chức năng: Để ghi nhớ tùy chọn của bạn',
          'Cookie marketing: Để hiển thị quảng cáo phù hợp (nếu bạn đồng ý)',
        ],
      },
      'Bạn có thể quản lý hoặc xóa cookie thông qua cài đặt trình duyệt. Lưu ý rằng việc vô hiệu hóa cookie có thể ảnh hưởng đến một số tính năng của website.',
    ],
  },
  {
    icon: Shield,
    title: '7. Lưu trữ thông tin',
    content: [
      'Chúng tôi chỉ lưu trữ thông tin cá nhân của bạn trong thời gian cần thiết để:',
      {
        items: [
          'Cung cấp dịch vụ mà bạn đã yêu cầu',
          'Tuân thủ các nghĩa vụ pháp lý (ví dụ: lưu trữ hồ sơ thuế)',
          'Giải quyết tranh chấp và thực thi thỏa thuận',
        ],
      },
      'Sau khi hết thời gian lưu trữ, thông tin sẽ được xóa hoặc ẩn danh hóa một cách an toàn.',
    ],
  },
  {
    icon: Shield,
    title: '8. Bảo vệ trẻ em',
    content: [
      'Dịch vụ của chúng tôi không nhắm đến trẻ em dưới 16 tuổi. Chúng tôi không cố ý thu thập thông tin cá nhân từ trẻ em. Nếu bạn là phụ huynh và phát hiện con bạn đã cung cấp thông tin cá nhân cho chúng tôi, vui lòng liên hệ để chúng tôi xóa thông tin đó.',
    ],
  },
  {
    icon: Shield,
    title: '9. Thay đổi chính sách',
    content: [
      'Chúng tôi có thể cập nhật Chính sách Bảo mật này theo thời gian để phản ánh các thay đổi trong hoạt động kinh doanh hoặc yêu cầu pháp lý. Mọi thay đổi quan trọng sẽ được thông báo rõ ràng trên website.',
      'Chúng tôi khuyến khích bạn xem lại chính sách này định kỳ để cập nhật thông tin mới nhất.',
    ],
  },
  {
    icon: Mail,
    title: '10. Liên hệ',
    content: [
      'Nếu bạn có bất kỳ câu hỏi, thắc mắc nào về Chính sách Bảo mật này hoặc cách chúng tôi xử lý thông tin cá nhân của bạn, vui lòng liên hệ:',
      {
        items: [
          'Email: privacy@tbs-erp.com',
          'Điện thoại: +84 xxx xxx xxx',
          'Địa chỉ: Số XX, Đường ABC, Quận Hoàn Kiếm, Hà Nội, Việt Nam',
        ],
      },
      'Chúng tôi sẽ phản hồi yêu cầu của bạn trong thời gian sớm nhất, thường là trong vòng 7 ngày làm việc.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Chính sách bảo mật
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              TBS Logistics cam kết bảo vệ quyền riêng tư và thông tin cá nhân của khách hàng.
              Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn.
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
                  Khi sử dụng các dịch vụ của TBS Logistics, bạn tin tưởng giao cho chúng tôi thông tin
                  của mình. Chúng tôi hiểu rằng đây là trách nhiệm lớn và cam kết nỗ lực để bảo vệ
                  thông tin đó và giúp bạn kiểm soát được thông tin của mình.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Chính sách Bảo mật này nhằm giúp bạn hiểu những thông tin chúng tôi thu thập, tại sao
                  chúng tôi thu thập và bạn có thể làm gì để cập nhật, quản lý, xuất và xóa thông tin
                  của mình.
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

            {/* Footer Note */}
            <Card className="mt-8 bg-gray-50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong>Lưu ý:</strong> Chính sách Bảo mật này áp dụng cho tất cả các dịch vụ do TBS
                  Logistics cung cấp, bao gồm website, ứng dụng di động và các kênh giao tiếp khác.
                  Bằng cách sử dụng dịch vụ của chúng tôi, bạn đồng ý với các điều khoản trong chính
                  sách này.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
