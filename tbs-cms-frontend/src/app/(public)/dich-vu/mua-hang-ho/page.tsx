import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Search, ShoppingCart, Package, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';

export const metadata: Metadata = {
  title: 'Mua hàng hộ Trung Quốc',
  description: 'Order hàng Taobao, 1688, Tmall giá tốt nhất. Kiểm hàng kỹ, ship về VN 7-10 ngày. Hỗ trợ tìm nguồn, đàm phán. Đặt hàng ngay hôm nay!',
  keywords: [
    'mua hàng hộ',
    'order hàng Trung Quốc',
    'Taobao',
    '1688',
    'Tmall',
    'mua hàng Trung Quốc',
  ],
  alternates: {
    canonical: '/dich-vu/mua-hang-ho'
  }
};

const features = [
  {
    icon: Search,
    title: 'Tìm nguồn hàng',
    description: 'Hỗ trợ tìm kiếm và so sánh giá từ nhiều nguồn',
  },
  {
    icon: ShoppingCart,
    title: 'Đặt hàng dễ dàng',
    description: 'Chỉ cần gửi link sản phẩm, chúng tôi lo phần còn lại',
  },
  {
    icon: BadgeCheck,
    title: 'Kiểm tra chất lượng',
    description: 'QC kỹ lưỡng trước khi gửi về Việt Nam',
  },
  {
    icon: Package,
    title: 'Vận chuyển nhanh',
    description: 'Giao hàng tận nơi trong 7-10 ngày',
  },
];

const processSteps = [
  {
    step: 1,
    title: 'Gửi link sản phẩm',
    description: 'Gửi link sản phẩm từ Taobao, Tmall, 1688 hoặc yêu cầu tìm hàng',
  },
  {
    step: 2,
    title: 'Báo giá & Xác nhận',
    description: 'Nhận báo giá chi tiết và xác nhận đơn hàng',
  },
  {
    step: 3,
    title: 'Đặt hàng & Thanh toán',
    description: 'Chúng tôi đặt hàng và bạn thanh toán cọc 100%',
  },
  {
    step: 4,
    title: 'Nhận hàng & QC',
    description: 'Nhận hàng tại kho TQ, QC và chụp ảnh gửi bạn',
  },
  {
    step: 5,
    title: 'Vận chuyển về VN',
    description: 'Vận chuyển về kho VN và giao hàng tận nơi',
  },
];

const faqs = [
  {
    question: 'Tôi có thể mua hàng từ những sàn nào?',
    answer: 'Chúng tôi hỗ trợ mua hàng từ tất cả các sàn TMĐT Trung Quốc: Taobao, Tmall, 1688, JD.com, Pinduoduo và các trang web khác.',
  },
  {
    question: 'Phí dịch vụ mua hàng hộ là bao nhiêu?',
    answer: 'Phí dịch vụ là 5-8% giá trị đơn hàng, tùy theo mức độ phức tạp. Đối với đơn hàng lớn, chúng tôi có mức phí ưu đãi.',
  },
  {
    question: 'Nếu hàng bị lỗi thì xử lý như thế nào?',
    answer: 'Chúng tôi sẽ QC kỹ trước khi gửi. Nếu phát hiện lỗi, bạn có thể yêu cầu đổi trả với shop. Nếu hàng về VN mới phát hiện lỗi do shop, chúng tôi hỗ trợ xử lý khiếu nại.',
  },
  {
    question: 'Tôi có thể yêu cầu tìm nguồn hàng không?',
    answer: 'Có, chúng tôi hỗ trợ tìm nguồn hàng theo yêu cầu của bạn. Vui lòng cung cấp mô tả, hình ảnh hoặc thông tin sản phẩm bạn cần.',
  },
];

const platforms = [
  { name: 'Taobao', color: 'bg-orange-100 text-orange-700' },
  { name: 'Tmall', color: 'bg-red-100 text-red-700' },
  { name: '1688', color: 'bg-yellow-100 text-yellow-700' },
  { name: 'JD.com', color: 'bg-red-100 text-red-700' },
  { name: 'Pinduoduo', color: 'bg-green-100 text-green-700' },
  { name: 'Các sàn khác', color: 'bg-blue-100 text-blue-700' },
];

const breadcrumbItems = [
  { label: 'Dịch vụ', href: '/dich-vu' },
  { label: 'Mua hàng hộ' }
];

export default function PurchasingServicePage() {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Dịch vụ mua hàng hộ Trung Quốc',
    description: 'Dịch vụ mua hàng hộ chuyên nghiệp từ Taobao, Tmall, 1688 và các sàn TMĐT Trung Quốc. Hỗ trợ tìm nguồn hàng, QC chất lượng và vận chuyển về Việt Nam.',
    provider: {
      '@type': 'Organization',
      name: 'TBS Logistics'
    },
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam'
    },
    serviceType: 'Shopping Service'
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema items={breadcrumbItems} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 via-green-25 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Dịch vụ mua hàng hộ Trung Quốc
            </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Mua sắm dễ dàng từ Taobao, Tmall, 1688 và các sàn thương mại điện tử Trung Quốc.
                Chúng tôi giúp bạn order hàng, QC chất lượng và vận chuyển về tận tay.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/lien-he">
                  <Button size="lg">
                    Bắt đầu mua hàng
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="lg" variant="outline">
                    Đăng ký tài khoản
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Các sàn thương mại điện tử được hỗ trợ
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {platforms.map((platform, index) => (
                <div
                  key={index}
                  className={`px-6 py-3 rounded-full font-semibold ${platform.color}`}
                >
                  {platform.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Ưu điểm của dịch vụ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="text-center">
                    <CardHeader>
                      <div className="w-14 h-14 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-7 h-7 text-green-600" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Quy trình mua hàng
            </h2>
            <div className="space-y-6">
              {processSteps.map((step, index) => (
                <div key={index} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Example */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              Ví dụ tính phí
            </h2>
            <p className="text-center text-muted-foreground mb-12">
              Minh họa cách tính phí dịch vụ mua hàng hộ
            </p>
            <Card className="bg-gradient-to-br from-green-50 to-background">
              <CardContent className="p-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Giá sản phẩm</span>
                    <span className="font-semibold">500 CNY</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Phí dịch vụ (5%)</span>
                    <span className="font-semibold">25 CNY</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Phí ship nội địa TQ</span>
                    <span className="font-semibold">15 CNY</span>
                  </div>
                  <div className="border-t pt-4 flex justify-between items-center text-lg">
                    <span className="font-bold">Tổng thanh toán</span>
                    <span className="font-bold text-primary">540 CNY</span>
                  </div>
                  <p className="text-sm text-muted-foreground pt-2">
                    * Chưa bao gồm phí vận chuyển quốc tế về VN
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Câu hỏi thường gặp
            </h2>
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground ml-8">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Bắt đầu mua sắm ngay hôm nay
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Gửi link sản phẩm cho chúng tôi để nhận báo giá ngay
            </p>
            <Link href="/lien-he">
              <Button size="lg" variant="secondary">
                Liên hệ ngay
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
