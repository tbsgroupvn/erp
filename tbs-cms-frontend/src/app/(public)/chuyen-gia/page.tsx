import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle2,
  Quote,
  ArrowRight,
  Building2,
  Package
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Case Studies - Câu chuyện thành công',
  description: 'Khám phá những câu chuyện thành công của khách hàng khi sử dụng dịch vụ TBS Logistics. Tìm hiểu cách chúng tôi giúp doanh nghiệp phát triển.',
  keywords: [
    'case study logistics',
    'câu chuyện thành công',
    'khách hàng TBS',
    'giải pháp vận chuyển',
  ],
  alternates: {
    canonical: '/chuyen-gia'
  }
};

const breadcrumbItems = [
  { label: 'Chuyên gia' }
];

const caseStudies = [
  {
    id: 1,
    title: 'Công ty A - Nhập khẩu thiết bị điện tử',
    industry: 'Điện tử & Công nghệ',
    company: 'Công ty TNHH Thương Mại A',
    location: 'Hà Nội',
    challenge: {
      icon: Package,
      title: 'Thách thức',
      description: 'Công ty A gặp khó khăn trong việc nhập khẩu linh kiện điện tử từ Trung Quốc với số lượng lớn. Chi phí vận chuyển cao, thời gian giao hàng không ổn định, thủ tục hải quan phức tạp khiến doanh nghiệp chậm trễ đơn hàng và mất khách.',
    },
    solution: {
      icon: CheckCircle2,
      title: 'Giải pháp TBS',
      description: 'TBS Logistics đã thiết kế giải pháp vận chuyển tối ưu: sử dụng đường vận chuyển kết hợp đường bộ + đường biển, tập trung hàng để giảm chi phí, hỗ trợ khai báo hải quan nhanh chóng. Đội ngũ chuyên viên tư vấn riêng để xử lý các vấn đề phát sinh.',
    },
    results: [
      { metric: 'Giảm chi phí', value: '35%', icon: DollarSign },
      { metric: 'Rút ngắn thời gian', value: '40%', icon: Clock },
      { metric: 'Tăng số đơn', value: '60%', icon: TrendingUp },
    ],
    testimonial: {
      text: 'Từ khi hợp tác với TBS, chi phí vận chuyển giảm đáng kể và thời gian giao hàng được cải thiện rõ rệt. Đội ngũ TBS rất chuyên nghiệp, luôn hỗ trợ kịp thời. Chúng tôi hoàn toàn hài lòng với dịch vụ.',
      author: 'Giám đốc Công ty A',
    },
  },
  {
    id: 2,
    title: 'Doanh nghiệp B - Nhập khẩu hàng thời trang',
    industry: 'Thời trang & Phụ kiện',
    company: 'Công ty CP Thời Trang B',
    location: 'TP. Hồ Chí Minh',
    challenge: {
      icon: Package,
      title: 'Thách thức',
      description: 'Doanh nghiệp B kinh doanh thời trang online, cần nhập lô hàng nhỏ nhưng thường xuyên từ nhiều nhà cung cấp khác nhau tại Trung Quốc. Việc quản lý nhiều đơn hàng, theo dõi hàng về và kiểm soát chất lượng rất khó khăn.',
    },
    solution: {
      icon: CheckCircle2,
      title: 'Giải pháp TBS',
      description: 'TBS cung cấp dịch vụ mua hàng hộ và quản lý đơn hàng tập trung. Hệ thống ERP cho phép khách hàng theo dõi tất cả đơn hàng theo thời gian thực. Dịch vụ kiểm tra hàng tại kho Trung Quốc trước khi vận chuyển về Việt Nam.',
    },
    results: [
      { metric: 'Tiết kiệm thời gian', value: '50%', icon: Clock },
      { metric: 'Tăng hiệu suất', value: '70%', icon: TrendingUp },
      { metric: 'Giảm lỗi đơn hàng', value: '80%', icon: CheckCircle2 },
    ],
    testimonial: {
      text: 'Hệ thống quản lý của TBS giúp chúng tôi theo dõi hàng trăm đơn hàng một cách dễ dàng. Dịch vụ kiểm hàng giúp giảm thiểu rủi ro về chất lượng. Đây là đối tác tin cậy của chúng tôi.',
      author: 'Trưởng phòng Kinh doanh - Công ty B',
    },
  },
  {
    id: 3,
    title: 'Doanh nghiệp C - Nhập khẩu máy móc công nghiệp',
    industry: 'Máy móc & Thiết bị',
    company: 'Công ty TNHH Công Nghiệp C',
    location: 'Bình Dương',
    challenge: {
      icon: Package,
      title: 'Thách thức',
      description: 'Công ty C cần nhập khẩu máy móc công nghiệp có kích thước lớn và trọng lượng nặng. Hàng hóa yêu cầu đóng gói đặc biệt, vận chuyển cẩn thận và thủ tục hải quan phức tạp với nhiều giấy tờ chứng từ.',
    },
    solution: {
      icon: CheckCircle2,
      title: 'Giải pháp TBS',
      description: 'TBS thiết kế phương án vận chuyển đặc biệt cho hàng nặng và cồng kềnh. Đóng gói chuyên nghiệp với vật liệu chống sốc, sử dụng container riêng. Đội ngũ hải quan hỗ trợ hoàn tất tất cả giấy tờ và thủ tục nhập khẩu máy móc.',
    },
    results: [
      { metric: 'An toàn hàng hóa', value: '100%', icon: CheckCircle2 },
      { metric: 'Tiết kiệm chi phí', value: '25%', icon: DollarSign },
      { metric: 'Nhanh hơn dự kiến', value: '15 ngày', icon: Clock },
    ],
    testimonial: {
      text: 'TBS đã vận chuyển máy móc trị giá hàng tỷ đồng một cách an toàn tuyệt đối. Đội ngũ rất chuyên nghiệp trong xử lý hàng đặc biệt. Chúng tôi rất yên tâm khi làm việc với TBS.',
      author: 'Giám đốc Kỹ thuật - Công ty C',
    },
  },
  {
    id: 4,
    title: 'Công ty D - Nhập khẩu nguyên liệu thực phẩm',
    industry: 'Thực phẩm & Đồ uống',
    company: 'Công ty CP Thực Phẩm D',
    location: 'Đồng Nai',
    challenge: {
      icon: Package,
      title: 'Thách thức',
      description: 'Công ty D nhập khẩu nguyên liệu thực phẩm cần bảo quản đặc biệt và có thời hạn sử dụng ngắn. Yêu cầu vận chuyển nhanh, đảm bảo nhiệt độ và giấy phép vệ sinh an toàn thực phẩm phức tạp.',
    },
    solution: {
      icon: CheckCircle2,
      title: 'Giải pháp TBS',
      description: 'TBS cung cấp dịch vụ vận chuyển nhanh ưu tiên cho hàng thực phẩm. Kho bãi có hệ thống bảo quản chuyên dụng. Đội ngũ hải quan có kinh nghiệm xử lý giấy phép ATTP, chứng nhận nguồn gốc và kiểm dịch.',
    },
    results: [
      { metric: 'Rút ngắn thời gian', value: '60%', icon: Clock },
      { metric: 'Đạt chuẩn ATTP', value: '100%', icon: CheckCircle2 },
      { metric: 'Tăng đơn hàng', value: '45%', icon: TrendingUp },
    ],
    testimonial: {
      text: 'TBS hiểu rõ yêu cầu khắt khe của ngành thực phẩm. Họ xử lý thủ tục rất nhanh, hàng về đúng thời hạn và đảm bảo chất lượng. Đây là đối tác không thể thiếu của chúng tôi.',
      author: 'Giám đốc Vận hành - Công ty D',
    },
  },
  {
    id: 5,
    title: 'Doanh nghiệp E - Nhập khẩu mỹ phẩm',
    industry: 'Mỹ phẩm & Làm đẹp',
    company: 'Công ty TNHH Mỹ Phẩm E',
    location: 'Hà Nội',
    challenge: {
      icon: Package,
      title: 'Thách thức',
      description: 'Doanh nghiệp E nhập khẩu mỹ phẩm từ nhiều thương hiệu khác nhau, cần quản lý hàng tồn kho hiệu quả. Thị trường mỹ phẩm biến động nhanh, cần linh hoạt trong việc order và nhận hàng.',
    },
    solution: {
      icon: CheckCircle2,
      title: 'Giải pháp TBS',
      description: 'TBS cung cấp giải pháp kho bãi linh hoạt tại Trung Quốc, cho phép tập trung hàng từ nhiều nhà cung cấp. Dịch vụ vận chuyển định kỳ hàng tuần giúp tối ưu chi phí. Hỗ trợ đăng ký công bố mỹ phẩm.',
    },
    results: [
      { metric: 'Giảm chi phí kho', value: '40%', icon: DollarSign },
      { metric: 'Tăng vòng quay', value: '55%', icon: TrendingUp },
      { metric: 'Linh hoạt hơn', value: '70%', icon: CheckCircle2 },
    ],
    testimonial: {
      text: 'Giải pháp kho bãi của TBS giúp chúng tôi quản lý hàng tồn hiệu quả hơn. Vận chuyển định kỳ giúp tiết kiệm chi phí đáng kể. Đội ngũ hỗ trợ rất nhiệt tình và chuyên nghiệp.',
      author: 'Giám đốc Mua hàng - Công ty E',
    },
  },
];

export default function CaseStudiesPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Case Studies - Câu chuyện thành công',
    description: 'Khám phá những câu chuyện thành công của khách hàng khi sử dụng dịch vụ TBS Logistics',
  };

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema items={breadcrumbItems} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Câu Chuyện Thành Công
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Khám phá cách TBS Logistics giúp các doanh nghiệp tối ưu hóa chuỗi cung ứng
                và phát triển kinh doanh một cách bền vững
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto space-y-16">
            {caseStudies.map((study, index) => (
              <Card key={study.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-8">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-7 h-7 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{study.title}</CardTitle>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="bg-white px-3 py-1 rounded-full">
                          {study.industry}
                        </span>
                        <span className="bg-white px-3 py-1 rounded-full">
                          {study.location}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-8">
                  {/* Challenge & Solution */}
                  <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                          <study.challenge.icon className="w-5 h-5 text-red-600" aria-hidden="true" />
                        </div>
                        <h3 className="text-xl font-semibold">{study.challenge.title}</h3>
                      </div>
                      <p className="text-muted-foreground">
                        {study.challenge.description}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <study.solution.icon className="w-5 h-5 text-green-600" aria-hidden="true" />
                        </div>
                        <h3 className="text-xl font-semibold">{study.solution.title}</h3>
                      </div>
                      <p className="text-muted-foreground">
                        {study.solution.description}
                      </p>
                    </div>
                  </div>

                  {/* Results */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-6 text-center">Kết Quả Đạt Được</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {study.results.map((result, idx) => {
                        const Icon = result.icon;
                        return (
                          <div key={idx} className="text-center p-6 bg-primary/5 rounded-lg">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                              <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                            </div>
                            <div className="text-3xl font-bold text-primary mb-2">
                              {result.value}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {result.metric}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Testimonial */}
                  <div className="bg-gray-50 p-6 rounded-lg relative">
                    <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" aria-hidden="true" />
                    <p className="text-muted-foreground italic mb-4">
                      &ldquo;{study.testimonial.text}&rdquo;
                    </p>
                    <p className="font-semibold text-primary">
                      - {study.testimonial.author}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Bạn muốn có câu chuyện thành công của riêng mình?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Hãy để TBS Logistics đồng hành cùng bạn trên hành trình phát triển kinh doanh
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/lien-he">
                <Button size="lg" className="w-full sm:w-auto">
                  Liên hệ tư vấn
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dich-vu">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Xem dịch vụ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
