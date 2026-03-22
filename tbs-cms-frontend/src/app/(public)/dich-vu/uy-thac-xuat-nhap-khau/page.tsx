import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, ArrowRight, FileText, Shield, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';

export const metadata: Metadata = {
  title: 'Ủy thác xuất nhập khẩu',
  description: 'Ủy thác XNK chính ngạch, đầy đủ giấy tờ. Xử lý hải quan nhanh chóng, chi phí hợp lý. Đội ngũ chuyên nghiệp 10+ năm kinh nghiệm. Tư vấn miễn phí!',
  keywords: [
    'ủy thác xuất nhập khẩu',
    'ủy thác XNK',
    'hải quan',
    'thủ tục hải quan',
    'xuất nhập khẩu',
  ],
  alternates: {
    canonical: '/dich-vu/uy-thac-xuat-nhap-khau'
  }
};

const features = [
  {
    icon: FileText,
    title: 'Thủ tục đơn giản',
    description: 'Xử lý toàn bộ giấy tờ, chứng từ xuất nhập khẩu',
  },
  {
    icon: Shield,
    title: 'Đảm bảo pháp lý',
    description: 'Tuân thủ đúng quy định của pháp luật Việt Nam',
  },
  {
    icon: Users,
    title: 'Đội ngũ chuyên nghiệp',
    description: 'Nhân viên giàu kinh nghiệm trong lĩnh vực hải quan',
  },
  {
    icon: TrendingUp,
    title: 'Tối ưu chi phí',
    description: 'Tư vấn phương án tiết kiệm nhất cho doanh nghiệp',
  },
];

const processSteps = [
  {
    step: 1,
    title: 'Tư vấn & Ký hợp đồng',
    description: 'Tư vấn phương án phù hợp và ký hợp đồng ủy thác',
  },
  {
    step: 2,
    title: 'Chuẩn bị hồ sơ',
    description: 'Thu thập và chuẩn bị đầy đủ chứng từ cần thiết',
  },
  {
    step: 3,
    title: 'Khai báo hải quan',
    description: 'Làm thủ tục khai báo hải quan tại cửa khẩu',
  },
  {
    step: 4,
    title: 'Kiểm tra & Thông quan',
    description: 'Phối hợp với hải quan kiểm tra và thông quan',
  },
  {
    step: 5,
    title: 'Bàn giao hồ sơ',
    description: 'Bàn giao đầy đủ chứng từ và hồ sơ hoàn tất',
  },
];

const faqs = [
  {
    question: 'Ủy thác xuất nhập khẩu là gì?',
    answer: 'Ủy thác xuất nhập khẩu là hình thức doanh nghiệp chưa có quyền xuất nhập khẩu trực tiếp ủy thác cho công ty có quyền (như TBS Logistics) thực hiện thủ tục xuất nhập khẩu thay mặt.',
  },
  {
    question: 'Doanh nghiệp nào cần dịch vụ này?',
    answer: 'Các doanh nghiệp chưa có mã số xuất nhập khẩu, hộ kinh doanh, cá nhân hoặc doanh nghiệp muốn tiết kiệm chi phí và thời gian xử lý thủ tục hải quan.',
  },
  {
    question: 'Phí dịch vụ ủy thác là bao nhiêu?',
    answer: 'Phí dịch vụ phụ thuộc vào giá trị lô hàng, loại hàng hóa và mức độ phức tạp của thủ tục. Thông thường từ 2-5 triệu/lô hàng. Liên hệ để được báo giá chi tiết.',
  },
  {
    question: 'Có rủi ro pháp lý không?',
    answer: 'Không, dịch vụ ủy thác xuất nhập khẩu được pháp luật cho phép và quy định rõ tại Luật Thương mại. Chúng tôi đảm bảo tuân thủ đầy đủ các quy định của pháp luật.',
  },
];

const benefits = [
  {
    title: 'Tiết kiệm thời gian',
    description: 'Không cần tự mình nghiên cứu và xử lý các thủ tục phức tạp',
    icon: '⏱️',
  },
  {
    title: 'Giảm chi phí',
    description: 'Không cần thành lập bộ phận xuất nhập khẩu riêng',
    icon: '💰',
  },
  {
    title: 'Giảm rủi ro',
    description: 'Tránh các sai sót trong thủ tục dẫn đến phạt hoặc tịch thu hàng',
    icon: '🛡️',
  },
  {
    title: 'Chuyên nghiệp',
    description: 'Được tư vấn và xử lý bởi đội ngũ có kinh nghiệm lâu năm',
    icon: '👨‍💼',
  },
];

const requiredDocs = [
  'Hợp đồng mua bán hàng hóa',
  'Hóa đơn thương mại (Invoice)',
  'Giấy phép nhập khẩu (nếu có)',
  'Chứng từ nguồn gốc xuất xứ',
  'Giấy tờ pháp nhân doanh nghiệp',
  'Danh sách đóng gói (Packing List)',
];

const breadcrumbItems = [
  { label: 'Dịch vụ', href: '/dich-vu' },
  { label: 'Ủy thác xuất nhập khẩu' }
];

export default function ImportExportServicePage() {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Dịch vụ ủy thác xuất nhập khẩu',
    description: 'Dịch vụ ủy thác xuất nhập khẩu chuyên nghiệp, xử lý toàn bộ thủ tục hải quan phức tạp cho doanh nghiệp chưa có quyền XNK.',
    provider: {
      '@type': 'Organization',
      name: 'TBS Logistics'
    },
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam'
    },
    serviceType: 'Import Export Service'
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
      <section className="bg-gradient-to-br from-orange-50 via-orange-25 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Dịch vụ ủy thác xuất nhập khẩu
            </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Giải pháp toàn diện cho doanh nghiệp chưa có quyền xuất nhập khẩu.
                Chúng tôi xử lý mọi thủ tục hải quan phức tạp, giúp bạn tập trung vào kinh doanh.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/lien-he">
                  <Button size="lg">
                    Nhận tư vấn ngay
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

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Ưu điểm vượt trội
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="text-center">
                    <CardHeader>
                      <div className="w-14 h-14 rounded-lg bg-orange-50 flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-7 h-7 text-orange-600" aria-hidden="true" />
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

      {/* Benefits */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Lợi ích khi sử dụng dịch vụ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="text-4xl flex-shrink-0">{benefit.icon}</div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                        <p className="text-muted-foreground text-sm">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Quy trình ủy thác
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

      {/* Required Documents */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              Chứng từ cần chuẩn bị
            </h2>
            <p className="text-center text-muted-foreground mb-12">
              Các giấy tờ cơ bản cần có khi sử dụng dịch vụ ủy thác xuất nhập khẩu
            </p>
            <Card>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requiredDocs.map((doc, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-6 text-center">
                  * Tùy loại hàng hóa có thể cần thêm giấy tờ khác. Chúng tôi sẽ tư vấn chi tiết.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
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
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Cần tư vấn về ủy thác xuất nhập khẩu?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Liên hệ với chúng tôi để được tư vấn miễn phí và nhận báo giá chi tiết
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
