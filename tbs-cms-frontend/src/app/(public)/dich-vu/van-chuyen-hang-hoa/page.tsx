import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Package, Shield, Clock, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';
import { RelatedServices } from '@/app/(public)/components/related-services';

export const metadata: Metadata = {
  title: 'Vận chuyển hàng hóa Trung Quốc - Việt Nam',
  description: 'Vận chuyển hàng Trung - Việt 5-7 ngày, giá từ 15k/kg. Bảo hiểm toàn bộ, giao tận nơi. Cam kết an toàn, đúng hạn. Báo giá miễn phí 24/7!',
  keywords: [
    'vận chuyển hàng hóa',
    'vận chuyển Trung Quốc Việt Nam',
    'giao hàng từ Trung Quốc',
    'logistics',
  ],
  alternates: {
    canonical: '/dich-vu/van-chuyen-hang-hoa'
  }
};

const features = [
  {
    icon: Shield,
    title: 'An toàn & Bảo hiểm',
    description: 'Hàng hóa được bảo hiểm toàn bộ, đền bù 100% nếu có rủi ro',
  },
  {
    icon: Clock,
    title: 'Nhanh chóng',
    description: 'Thời gian vận chuyển 5-7 ngày, cam kết đúng hạn',
  },
  {
    icon: Package,
    title: 'Đóng gói cẩn thận',
    description: 'Đóng gói chuyên nghiệp, kiểm tra kỹ trước khi giao',
  },
  {
    icon: DollarSign,
    title: 'Chi phí hợp lý',
    description: 'Giá cạnh tranh nhất thị trường, không phát sinh',
  },
];

const processSteps = [
  {
    step: 1,
    title: 'Liên hệ & Báo giá',
    description: 'Cung cấp thông tin hàng hóa để nhận báo giá chi tiết',
  },
  {
    step: 2,
    title: 'Nhận hàng tại kho TQ',
    description: 'Gửi hàng đến kho của chúng tôi tại Trung Quốc',
  },
  {
    step: 3,
    title: 'Kiểm tra & Đóng gói',
    description: 'Kiểm tra chất lượng, đóng gói cẩn thận và xuất kho',
  },
  {
    step: 4,
    title: 'Vận chuyển & Hải quan',
    description: 'Vận chuyển về VN và làm thủ tục hải quan',
  },
  {
    step: 5,
    title: 'Giao hàng tận nơi',
    description: 'Giao hàng đến địa chỉ của bạn tại Việt Nam',
  },
];

const faqs = [
  {
    question: 'Thời gian vận chuyển mất bao lâu?',
    answer: 'Thời gian vận chuyển thông thường là 5-7 ngày làm việc kể từ khi hàng về đến kho TQ của chúng tôi. Thời gian có thể lâu hơn trong dịp lễ hoặc cao điểm.',
  },
  {
    question: 'Chi phí vận chuyển được tính như thế nào?',
    answer: 'Chi phí được tính dựa trên cân nặng thực tế hoặc cân nặng quy đổi (tùy theo loại lớn hơn). Công thức: Dài x Rộng x Cao (cm) / 6000. Chúng tôi sẽ báo giá chi tiết trước khi vận chuyển.',
  },
  {
    question: 'Hàng hóa có được bảo hiểm không?',
    answer: 'Có, tất cả hàng hóa đều được bảo hiểm. Trong trường hợp hư hỏng hoặc mất mát, chúng tôi sẽ đền bù 100% giá trị hàng hóa.',
  },
  {
    question: 'Tôi có thể gửi hàng cồng kềnh không?',
    answer: 'Có, chúng tôi nhận vận chuyển hàng cồng kềnh, hàng nặng. Vui lòng liên hệ để được tư vấn phương án vận chuyển tối ưu.',
  },
];

const breadcrumbItems = [
  { label: 'Dịch vụ', href: '/dich-vu' },
  { label: 'Vận chuyển hàng hóa' }
];

const pricingTiers = [
  {
    weight: '0-10 kg',
    price: '25,000 - 30,000đ/kg',
    note: 'Áp dụng cho hàng nhỏ lẻ',
  },
  {
    weight: '10-50 kg',
    price: '20,000 - 25,000đ/kg',
    note: 'Giá ưu đãi cho khối lượng vừa',
  },
  {
    weight: '50-100 kg',
    price: '15,000 - 20,000đ/kg',
    note: 'Giá sỉ cho số lượng lớn',
  },
  {
    weight: 'Trên 100 kg',
    price: 'Liên hệ',
    note: 'Báo giá đặc biệt cho container',
  },
];

export default function ShippingServicePage() {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Dịch vụ vận chuyển hàng hóa Trung Quốc - Việt Nam',
    description: 'Dịch vụ vận chuyển hàng hóa chuyên nghiệp từ Trung Quốc về Việt Nam với thời gian 5-7 ngày, cam kết an toàn và giá cả hợp lý.',
    provider: {
      '@type': 'Organization',
      name: 'TBS Logistics'
    },
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam'
    },
    serviceType: 'Freight Transportation'
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
      <section className="bg-gradient-to-br from-blue-50 via-blue-25 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Vận chuyển hàng hóa Trung Quốc - Việt Nam
            </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Dịch vụ vận chuyển hàng hóa chuyên nghiệp, nhanh chóng và an toàn.
                Cam kết giá tốt nhất thị trường với chất lượng dịch vụ hàng đầu.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/lien-he">
                  <Button size="lg">
                    Nhận báo giá ngay
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
                      <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-7 h-7 text-blue-600" aria-hidden="true" />
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
              Quy trình vận chuyển
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

      {/* Pricing */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              Bảng giá tham khảo
            </h2>
            <p className="text-center text-muted-foreground mb-12">
              Giá có thể thay đổi tùy theo loại hàng hóa và thời điểm. Liên hệ để nhận báo giá chính xác.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pricingTiers.map((tier, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{tier.weight}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary mb-2">
                      {tier.price}
                    </p>
                    <p className="text-sm text-muted-foreground">{tier.note}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
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

      {/* Related Services */}
      <RelatedServices
        services={[
          {
            title: 'Mua hàng hộ Trung Quốc',
            description: 'Dịch vụ order hàng Taobao, 1688, Tmall với giá tốt nhất. Hỗ trợ tìm nguồn và kiểm hàng kỹ lưỡng.',
            href: '/dich-vu/mua-hang-ho',
          },
          {
            title: 'Ủy thác xuất nhập khẩu',
            description: 'Xử lý thủ tục hải quan chính ngạch, đầy đủ giấy tờ pháp lý cho doanh nghiệp.',
            href: '/dich-vu/uy-thac-xuat-nhap-khau',
          },
          {
            title: 'LCL chính ngạch',
            description: 'Vận chuyển hàng lẻ bằng container LCL, phù hợp với khối lượng trung bình.',
            href: '/dich-vu/lcl-chinh-ngach',
          },
        ]}
      />

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Bắt đầu vận chuyển ngay hôm nay
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Liên hệ với chúng tôi để nhận tư vấn và báo giá miễn phí
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
