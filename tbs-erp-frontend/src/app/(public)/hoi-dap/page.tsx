'use client';

import Link from 'next/link';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

// Icon mapping for FAQ categories
const categoryIcons: Record<string, string> = {
  'Dịch vụ vận chuyển': '🚚',
  'Mua hàng và đặt hàng': '🛍️',
  'Hải quan và thủ tục': '📋',
  'Bảo hiểm và bồi thường': '🛡️',
  'Theo dõi và giao nhận': '📦',
};

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  viewCount: number;
}

interface FaqCategory {
  title: string;
  icon: string;
  faqs: { question: string; answer: string }[];
}

// Fallback hardcoded data
const fallbackFaqCategories: FaqCategory[] = [
  {
    title: 'Dịch vụ vận chuyển',
    icon: '🚚',
    faqs: [
      {
        question: 'TBS Logistics cung cấp những dịch vụ vận chuyển nào?',
        answer:
          'Chúng tôi cung cấp đầy đủ các dịch vụ: Vận chuyển thuần (VCT), Mua hàng hộ (MHH), Ủy thác xuất nhập khẩu (UTXNK), và LCL chính ngạch. Bạn có thể chọn dịch vụ phù hợp với nhu cầu và ngân sách của mình.',
      },
      {
        question: 'Thời gian vận chuyển từ Trung Quốc về Việt Nam mất bao lâu?',
        answer:
          'Thời gian vận chuyển phụ thuộc vào phương thức: Đường hàng không 3-5 ngày, đường bộ 5-7 ngày, đường biển 15-25 ngày. Thời gian có thể thay đổi tùy theo mùa vụ và địa điểm cụ thể.',
      },
      {
        question: 'Chi phí vận chuyển được tính như thế nào?',
        answer:
          'Chi phí bao gồm: Phí vận chuyển (tính theo kg hoặc CBM), phí dịch vụ, phí hải quan (nếu có). Chúng tôi tính theo trọng lượng lớn hơn giữa trọng lượng thực tế và trọng lượng quy đổi. Bạn có thể dùng công cụ tính phí trên website để ước tính.',
      },
      {
        question: 'Có giới hạn về trọng lượng hay kích thước hàng hóa không?',
        answer:
          'Đường biển không giới hạn kích thước. Đường bộ và hàng không có giới hạn tùy từng loại xe/máy bay. Vui lòng liên hệ để được tư vấn cụ thể cho lô hàng của bạn.',
      },
      {
        question: 'TBS có vận chuyển hàng nguy hiểm, dễ vỡ không?',
        answer:
          'Chúng tôi vận chuyển hàng dễ vỡ với dịch vụ đóng gói đặc biệt. Với hàng nguy hiểm, cần kiểm tra giấy phép và tuân thủ quy định vận chuyển. Vui lòng thông báo trước loại hàng để được tư vấn.',
      },
    ],
  },
  {
    title: 'Mua hàng và đặt hàng',
    icon: '🛍️',
    faqs: [
      {
        question: 'Làm thế nào để order hàng từ Trung Quốc?',
        answer:
          'Bạn có thể: 1) Gửi link sản phẩm cho chúng tôi, 2) Đăng ký tài khoản trên hệ thống, 3) Chúng tôi sẽ kiểm tra, báo giá và đặt hàng giúp bạn. Dịch vụ bao gồm kiểm tra hàng, chụp ảnh xác nhận trước khi gửi.',
      },
      {
        question: 'TBS có hỗ trợ tìm nguồn hàng và đàm phán giá không?',
        answer:
          'Có, chúng tôi có đội ngũ sourcing tại Trung Quốc giúp tìm nhà cung cấp uy tín, so sánh giá, và đàm phán để bạn có được giá tốt nhất. Dịch vụ này đặc biệt hữu ích cho khách hàng mua số lượng lớn.',
      },
      {
        question: 'Tôi có thể mua hàng từ Taobao, 1688, Alibaba được không?',
        answer:
          'Có, chúng tôi hỗ trợ order từ tất cả các sàn thương mại điện tử Trung Quốc: Taobao, Tmall, 1688, Alibaba, JD.com, Pinduoduo, v.v. Bạn chỉ cần gửi link sản phẩm.',
      },
      {
        question: 'Phí mua hàng hộ là bao nhiêu?',
        answer:
          'Phí mua hàng hộ thường từ 3-5% giá trị đơn hàng, tùy thuộc vào độ phức tạp và giá trị đơn hàng. Đơn hàng lớn sẽ được giảm phí. Liên hệ để được báo giá chính xác.',
      },
      {
        question: 'Tôi cần thanh toán như thế nào?',
        answer:
          'Chúng tôi chấp nhận: Chuyển khoản ngân hàng (Vietcombank, Techcombank, VPBank...), ví điện tử (Momo, ZaloPay), hoặc thanh toán tại văn phòng. Đơn hàng lớn có thể chia làm nhiều đợt thanh toán.',
      },
    ],
  },
  {
    title: 'Hải quan và thủ tục',
    icon: '📋',
    faqs: [
      {
        question: 'Hàng hóa có cần khai báo hải quan không?',
        answer:
          'Tùy vào giá trị và loại hàng. Hàng cá nhân dưới 1 triệu VNĐ thường không cần khai báo. Hàng thương mại cần khai báo đầy đủ. Chúng tôi có dịch vụ ủy thác khai báo hải quan cho khách hàng.',
      },
      {
        question: 'Thuế nhập khẩu được tính như thế nào?',
        answer:
          'Thuế nhập khẩu = (Giá trị hàng + Phí vận chuyển + Bảo hiểm) × Thuế suất. Thuế suất phụ thuộc loại hàng (thường 0-50%). Chúng tôi sẽ tư vấn chi tiết và hỗ trợ tính toán trước.',
      },
      {
        question: 'Tôi cần chuẩn bị giấy tờ gì để khai báo hải quan?',
        answer:
          'Giấy tờ cơ bản: CMND/CCCD, hóa đơn mua hàng, packing list, giấy ủy quyền (nếu ủy thác). Hàng đặc biệt cần giấy phép riêng. Chúng tôi sẽ hướng dẫn chi tiết từng loại hàng.',
      },
      {
        question: 'Nếu hàng bị hải quan giữ lại thì sao?',
        answer:
          'Chúng tôi sẽ liên hệ hải quan để xử lý. Thường do thiếu giấy tờ hoặc cần bổ sung thông tin. Chúng tôi có kinh nghiệm xử lý và sẽ hỗ trợ bạn hoàn tất thủ tục để nhận hàng.',
      },
      {
        question: 'Có những loại hàng nào không được phép nhập khẩu?',
        answer:
          'Hàng cấm: Vũ khí, ma túy, hàng nhái, hàng gây hại môi trường, một số loại thực phẩm, mỹ phẩm không rõ nguồn gốc. Trước khi order, vui lòng hỏi chúng tôi để tránh rủi ro.',
      },
    ],
  },
  {
    title: 'Bảo hiểm và bồi thường',
    icon: '🛡️',
    faqs: [
      {
        question: 'Hàng hóa có được bảo hiểm không?',
        answer:
          'Có, chúng tôi có bảo hiểm cơ bản cho tất cả lô hàng. Khách hàng có thể mua thêm bảo hiểm toàn diện cho hàng giá trị cao. Phí bảo hiểm thường 0.3-1% giá trị hàng.',
      },
      {
        question: 'Nếu hàng bị thất lạc hoặc hư hỏng thì sao?',
        answer:
          'Chúng tôi sẽ điều tra và xử lý theo quy trình. Nếu có bảo hiểm, bạn sẽ được bồi thường theo giá trị hàng. Chúng tôi cam kết xử lý nhanh chóng và có trách nhiệm.',
      },
      {
        question: 'Thời gian xử lý khiếu nại mất bao lâu?',
        answer:
          'Khiếu nại đơn giản được xử lý trong 3-5 ngày làm việc. Trường hợp phức tạp cần điều tra kỹ có thể mất 7-15 ngày. Chúng tôi sẽ cập nhật tiến độ thường xuyên.',
      },
      {
        question: 'Tôi có thể kiểm tra hàng trước khi nhận không?',
        answer:
          'Có, bạn có thể yêu cầu kiểm tra hàng tại kho của chúng tôi trước khi giao. Chúng tôi cũng có dịch vụ chụp ảnh, quay video xác nhận hàng trước khi đóng gói.',
      },
    ],
  },
  {
    title: 'Theo dõi và giao nhận',
    icon: '📦',
    faqs: [
      {
        question: 'Làm sao để theo dõi đơn hàng?',
        answer:
          'Bạn có thể theo dõi trên website bằng mã đơn hàng, hoặc qua app di động, hoặc liên hệ hotline. Hệ thống cập nhật realtime tình trạng từ khi lấy hàng đến khi giao.',
      },
      {
        question: 'Tôi có thể thay đổi địa chỉ giao hàng không?',
        answer:
          'Có, nhưng cần thông báo sớm. Nếu hàng chưa xuất kho TQ, miễn phí đổi địa chỉ. Nếu hàng đang vận chuyển, có thể phát sinh phí điều chỉnh. Liên hệ ngay để được hỗ trợ.',
      },
      {
        question: 'TBS có giao hàng tận nơi không?',
        answer:
          'Có, chúng tôi giao hàng tận nơi trên toàn quốc. Phí giao hàng tính theo địa điểm và khối lượng. Nội thành các thành phố lớn thường miễn phí với đơn hàng trên 5kg.',
      },
      {
        question: 'Nếu không có người nhận hàng thì sao?',
        answer:
          'Shipper sẽ liên hệ trước khi giao. Nếu không liên lạc được, hàng sẽ chuyển về kho và giữ miễn phí 3 ngày. Sau đó tính phí lưu kho. Vui lòng cập nhật thông tin liên lạc chính xác.',
      },
    ],
  },
];

function groupFaqsByCategory(items: FaqItem[]): FaqCategory[] {
  const grouped: Record<string, { question: string; answer: string }[]> = {};

  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push({
      question: item.question,
      answer: item.answer,
    });
  }

  return Object.entries(grouped).map(([category, faqs]) => ({
    title: category,
    icon: categoryIcons[category] || '❓',
    faqs,
  }));
}

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [faqCategories, setFaqCategories] = useState<FaqCategory[]>(fallbackFaqCategories);
  const [isLoading, setIsLoading] = useState(true);
  const breadcrumbItems = [{ label: 'Hỏi đáp' }];

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

    fetch(`${apiUrl}/public/cms/faqs`)
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data: FaqItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setFaqCategories(groupFaqsByCategory(data));
        }
        // If empty array, keep fallback data
      })
      .catch(() => {
        // Keep fallback data on error
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Filter FAQs based on search query
  const filteredCategories = searchQuery
    ? faqCategories
        .map((category) => ({
          ...category,
          faqs: category.faqs.filter(
            (faq) =>
              faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((category) => category.faqs.length > 0)
    : faqCategories;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Câu hỏi thường gặp
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Tìm câu trả lời cho các thắc mắc phổ biến về dịch vụ vận chuyển của
                chúng tôi
              </p>

              {/* Search Box */}
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Tìm kiếm câu hỏi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-6 text-base"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Đang tải câu hỏi...</p>
              </div>
            ) : filteredCategories.length > 0 ? (
              <div className="space-y-8">
                {filteredCategories.map((category, categoryIndex) => (
                  <Card key={categoryIndex}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <span className="text-3xl">{category.icon}</span>
                        {category.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {category.faqs.map((faq, faqIndex) => (
                          <AccordionItem
                            key={faqIndex}
                            value={`item-${categoryIndex}-${faqIndex}`}
                          >
                            <AccordionTrigger className="text-left">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">
                  Không tìm thấy câu hỏi nào phù hợp với &quot;{searchQuery}&quot;
                </p>
                <Button
                  variant="link"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  Xóa tìm kiếm
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="py-8">
                <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-3">
                  Không tìm thấy câu trả lời?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng giải đáp mọi thắc mắc
                  của bạn
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild>
                    <Link href="/lien-he">Liên hệ tư vấn</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link
                      href={`https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_ID || '0123456789'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Chat qua Zalo
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
