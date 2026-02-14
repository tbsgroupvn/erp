import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Container, Shield, FileCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';

export const metadata: Metadata = {
  title: 'LCL chính ngạch',
  description: 'LCL chính ngạch Trung - Việt, đầy đủ hóa đơn CO CQ. Hải quan nhanh chóng, giá cước hợp lý. Phù hợp hàng lẻ, trung bình. Tư vấn ngay!',
  keywords: [
    'LCL chính ngạch',
    'vận chuyển LCL',
    'container chính ngạch',
    'hải quan chính ngạch',
    'xuất nhập khẩu hợp pháp',
  ],
  alternates: {
    canonical: '/dich-vu/lcl-chinh-ngach'
  }
};

const features = [
  {
    icon: Shield,
    title: 'Chính ngạch 100%',
    description: 'Hàng hóa được khai báo đầy đủ, minh bạch với hải quan',
  },
  {
    icon: FileCheck,
    title: 'Pháp lý đầy đủ',
    description: 'Hồ sơ hải quan hoàn chỉnh, có thể xuất VAT',
  },
  {
    icon: Clock,
    title: 'Thời gian ổn định',
    description: 'Lịch vận chuyển cố định, dễ dàng dự trù kế hoạch',
  },
  {
    icon: Container,
    title: 'Tiết kiệm chi phí',
    description: 'Chia sẻ container, giảm chi phí cho lô hàng nhỏ',
  },
];

const processSteps = [
  {
    step: 1,
    title: 'Tư vấn & Báo giá',
    description: 'Cung cấp thông tin hàng hóa để nhận báo giá LCL chính ngạch',
  },
  {
    step: 2,
    title: 'Chuẩn bị hồ sơ',
    description: 'Thu thập chứng từ: Invoice, Packing List, CO, giấy phép (nếu có)',
  },
  {
    step: 3,
    title: 'Nhận hàng & Đóng cont',
    description: 'Nhận hàng tại kho TQ, đóng công container với hàng khác',
  },
  {
    step: 4,
    title: 'Vận chuyển & Khai báo',
    description: 'Vận chuyển về VN, làm thủ tục khai báo hải quan chính ngạch',
  },
  {
    step: 5,
    title: 'Thông quan & Giao hàng',
    description: 'Thông quan hải quan, giao hàng tận nơi và bàn giao chứng từ',
  },
];

const faqs = [
  {
    question: 'LCL chính ngạch khác gì với hàng xách tay?',
    answer: 'LCL chính ngạch là hình thức xuất nhập khẩu hợp pháp, có đầy đủ hồ sơ hải quan, có thể xuất hóa đơn VAT. Hàng xách tay thường không có hồ sơ đầy đủ, rủi ro pháp lý cao và không xuất được VAT.',
  },
  {
    question: 'Thời gian vận chuyển LCL chính ngạch là bao lâu?',
    answer: 'Thời gian vận chuyển thường 12-15 ngày từ khi đóng container tại TQ. Bao gồm thời gian vận chuyển đường biển (7-9 ngày) và thủ tục hải quan (3-5 ngày).',
  },
  {
    question: 'Chi phí LCL chính ngạch có đắt hơn hàng xách tay không?',
    answer: 'Chi phí có thể cao hơn một chút do phải làm đầy đủ thủ tục, nhưng lại hợp pháp, an toàn và có thể khấu trừ VAT. Đặc biệt phù hợp cho doanh nghiệp cần hồ sơ chính thức.',
  },
  {
    question: 'Tôi có thể gửi hàng gì bằng LCL chính ngạch?',
    answer: 'Hầu hết các loại hàng hóa thông thường đều có thể gửi. Một số mặt hàng cần giấy phép đặc biệt. Vui lòng liên hệ để được tư vấn cụ thể.',
  },
];

const advantages = [
  {
    title: 'Minh bạch về thuế',
    description: 'Khai báo đầy đủ giá trị hàng hóa, nộp thuế đúng quy định, tránh rủi ro pháp lý',
  },
  {
    title: 'Xuất hóa đơn VAT',
    description: 'Có thể xuất hóa đơn VAT cho khách hàng, tạo lợi thế cạnh tranh cho doanh nghiệp',
  },
  {
    title: 'Bảo vệ quyền lợi',
    description: 'Được bảo vệ bởi pháp luật, có thể khiếu nại nếu có vấn đề phát sinh',
  },
  {
    title: 'Xây dựng uy tín',
    description: 'Chứng minh doanh nghiệp hoạt động hợp pháp, tăng độ tin cậy với đối tác',
  },
];

const comparisonData = [
  {
    aspect: 'Pháp lý',
    official: 'Hợp pháp 100%',
    unofficial: 'Rủi ro cao',
  },
  {
    aspect: 'Hóa đơn VAT',
    official: 'Có thể xuất',
    unofficial: 'Không có',
  },
  {
    aspect: 'Thời gian',
    official: '12-15 ngày',
    unofficial: '5-7 ngày',
  },
  {
    aspect: 'Chi phí',
    official: 'Cao hơn ~20%',
    unofficial: 'Thấp hơn',
  },
  {
    aspect: 'Độ an toàn',
    official: 'Rất cao',
    unofficial: 'Thấp',
  },
];

const breadcrumbItems = [
  { label: 'Dịch vụ', href: '/dich-vu' },
  { label: 'LCL chính ngạch' }
];

export default function LCLServicePage() {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Dịch vụ LCL chính ngạch Trung Quốc - Việt Nam',
    description: 'Dịch vụ vận chuyển container LCL chính ngạch với thủ tục hải quan minh bạch, có thể xuất hóa đơn VAT, thời gian 12-15 ngày.',
    provider: {
      '@type': 'Organization',
      name: 'TBS Logistics'
    },
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam'
    },
    serviceType: 'LCL Freight Transportation'
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 via-purple-25 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Dịch vụ LCL chính ngạch
            </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Vận chuyển hàng hóa từ Trung Quốc về Việt Nam bằng container LCL chính ngạch.
                Thủ tục minh bạch, đảm bảo pháp lý, có thể xuất hóa đơn VAT cho doanh nghiệp.
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

      {/* What is LCL */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">LCL chính ngạch là gì?</h2>
            <p className="text-lg text-muted-foreground mb-6">
              LCL (Less than Container Load) là hình thức vận chuyển hàng lẻ, không đủ 1 container.
              Hàng của nhiều khách được đóng chung vào 1 container để tiết kiệm chi phí.
            </p>
            <p className="text-lg text-muted-foreground">
              <strong>Chính ngạch</strong> có nghĩa là hàng hóa được khai báo đầy đủ với hải quan,
              có đầy đủ chứng từ pháp lý, tuân thủ đúng quy định xuất nhập khẩu của Việt Nam.
            </p>
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
                      <div className="w-14 h-14 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-7 h-7 text-purple-600" aria-hidden="true" />
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

      {/* Comparison Table */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              So sánh LCL chính ngạch vs Hàng xách tay
            </h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-4 text-left font-semibold">Tiêu chí</th>
                        <th className="p-4 text-left font-semibold text-purple-700">Chính ngạch</th>
                        <th className="p-4 text-left font-semibold text-gray-600">Xách tay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {comparisonData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-4 font-medium">{row.aspect}</td>
                          <td className="p-4 text-purple-700">{row.official}</td>
                          <td className="p-4 text-gray-600">{row.unofficial}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Lợi ích khi chọn LCL chính ngạch
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {advantages.map((advantage, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      {advantage.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground ml-8">{advantage.description}</p>
                  </CardContent>
                </Card>
              ))}
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
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Cần vận chuyển LCL chính ngạch?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Liên hệ với chúng tôi để được tư vấn và nhận báo giá chi tiết
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
