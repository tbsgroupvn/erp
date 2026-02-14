import type { Metadata } from 'next';
import Link from 'next/link';
import { Target, Users, Award, TrendingUp, Heart, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';
import { Certifications } from '@/app/(public)/components/certifications';
import { MediaMentions } from '@/app/(public)/components/media-mentions';

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description: 'TBS Logistics - 10+ năm kinh nghiệm vận chuyển Trung - Việt. 3000+ khách hàng tin tưởng, 5000+ đơn/tháng. Đối tác uy tín cho doanh nghiệp của bạn!',
  keywords: [
    'về TBS Logistics',
    'công ty vận chuyển',
    'logistics Trung Quốc Việt Nam',
    'giới thiệu công ty',
  ],
  alternates: {
    canonical: '/gioi-thieu'
  }
};

const values = [
  {
    icon: Shield,
    title: 'Uy tín',
    description: 'Cam kết minh bạch trong mọi giao dịch, xây dựng lòng tin từ khách hàng',
  },
  {
    icon: Target,
    title: 'Chuyên nghiệp',
    description: 'Đội ngũ được đào tạo bài bản, quy trình chuẩn hóa theo tiêu chuẩn quốc tế',
  },
  {
    icon: Heart,
    title: 'Tận tâm',
    description: 'Luôn đặt quyền lợi khách hàng lên hàng đầu, hỗ trợ tận tình 24/7',
  },
  {
    icon: TrendingUp,
    title: 'Không ngừng cải tiến',
    description: 'Đầu tư công nghệ, cập nhật xu hướng để mang đến dịch vụ tốt nhất',
  },
];

const milestones = [
  {
    year: '2014',
    title: 'Thành lập công ty',
    description: 'TBS Logistics được thành lập với sứ mệnh kết nối thương mại Việt - Trung',
  },
  {
    year: '2016',
    title: 'Mở rộng mạng lưới',
    description: 'Thiết lập văn phòng và kho bãi tại các tỉnh thành chủ chốt của Trung Quốc',
  },
  {
    year: '2018',
    title: 'Phát triển công nghệ',
    description: 'Ra mắt hệ thống quản lý ERP, tối ưu hóa quy trình vận hành',
  },
  {
    year: '2020',
    title: 'Đa dạng dịch vụ',
    description: 'Bổ sung dịch vụ mua hàng hộ và ủy thác xuất nhập khẩu',
  },
  {
    year: '2024',
    title: 'Hơn 10.000 khách hàng',
    description: 'Đạt mốc 10.000+ khách hàng tin tưởng và sử dụng dịch vụ',
  },
];

const team = [
  {
    name: 'Nguyễn Văn A',
    role: 'Giám đốc điều hành',
    description: '15 năm kinh nghiệm trong ngành logistics và vận tải quốc tế',
  },
  {
    name: 'Trần Thị B',
    role: 'Giám đốc Vận hành',
    description: 'Chuyên gia về tối ưu hóa chuỗi cung ứng và quản lý kho bãi',
  },
  {
    name: 'Lê Văn C',
    role: 'Trưởng phòng Hải quan',
    description: 'Hơn 10 năm làm việc với hải quan, am hiểu sâu về pháp luật XNK',
  },
  {
    name: 'Phạm Thị D',
    role: 'Trưởng phòng CSKH',
    description: 'Chăm sóc và hỗ trợ khách hàng với đội ngũ nhiệt tình, chuyên nghiệp',
  },
];

const stats = [
  { label: 'Năm kinh nghiệm', value: '10+' },
  { label: 'Khách hàng', value: '10,000+' },
  { label: 'Đơn hàng/tháng', value: '5,000+' },
  { label: 'Tỷ lệ hài lòng', value: '99%' },
];

const breadcrumbItems = [
  { label: 'Giới thiệu' }
];

export default function AboutPage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TBS Logistics',
    description: 'Đối tác tin cậy trong vận chuyển và logistics Trung Quốc - Việt Nam với hơn 10 năm kinh nghiệm',
    foundingDate: '2014',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'VN'
    }
  };

  return (
    <div className="min-h-screen">
      <BreadcrumbSchema items={breadcrumbItems} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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
              Về TBS Logistics
            </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Đối tác tin cậy trong vận chuyển và logistics Trung Quốc - Việt Nam.
                Chúng tôi tự hào là cầu nối thương mại giữa hai quốc gia với hơn 10 năm kinh nghiệm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Câu chuyện của chúng tôi</h2>
              <p className="text-lg text-muted-foreground">
                Hành trình xây dựng và phát triển TBS Logistics
              </p>
            </div>
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground mb-6">
                TBS Logistics được thành lập vào năm 2014 với mục tiêu trở thành cầu nối thương mại
                giữa Việt Nam và Trung Quốc. Xuất phát từ những khó khăn mà các doanh nghiệp vừa và
                nhỏ gặp phải khi nhập khẩu hàng hóa từ Trung Quốc, chúng tôi quyết tâm tạo ra một
                dịch vụ logistics toàn diện, đáng tin cậy và giá cả hợp lý.
              </p>
              <p className="text-muted-foreground mb-6">
                Qua hơn 10 năm hoạt động, chúng tôi đã phục vụ hàng nghìn doanh nghiệp và cá nhân,
                vận chuyển hàng triệu kiện hàng từ Trung Quốc về Việt Nam. Chúng tôi không ngừng
                đầu tư vào công nghệ, mở rộng mạng lưới và nâng cao chất lượng dịch vụ để đáp ứng
                nhu cầu ngày càng đa dạng của khách hàng.
              </p>
              <p className="text-muted-foreground">
                Ngày nay, TBS Logistics tự hào là một trong những đơn vị hàng đầu trong lĩnh vực
                vận chuyển và logistics Việt - Trung, với đội ngũ nhân viên chuyên nghiệp, hệ thống
                kho bãi hiện đại tại cả hai nước và mạng lưới đối tác rộng khắp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Giá trị cốt lõi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <Card key={index} className="text-center">
                    <CardHeader>
                      <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-7 h-7 text-primary" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-lg">{value.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {value.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Các mốc quan trọng
            </h2>
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">{milestone.year}</span>
                    </div>
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="text-xl font-semibold mb-2">{milestone.title}</h3>
                    <p className="text-muted-foreground">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              Đội ngũ lãnh đạo
            </h2>
            <p className="text-center text-muted-foreground mb-12">
              Những người đồng hành cùng bạn trên hành trình phát triển
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-10 h-10 text-primary" aria-label={`Anh ${member.name}`} />
                    </div>
                    <CardTitle className="text-lg text-center">{member.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="font-semibold text-primary mb-2">{member.role}</p>
                    <p className="text-sm text-muted-foreground">{member.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                    <Target className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Sứ mệnh</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Kết nối và phát triển thương mại Việt - Trung thông qua dịch vụ vận chuyển và
                    logistics chuyên nghiệp, đáng tin cậy. Chúng tôi cam kết mang đến giải pháp
                    tối ưu, giúp khách hàng tiết kiệm chi phí và nâng cao hiệu quả kinh doanh.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                    <Award className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Tầm nhìn</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Trở thành đơn vị dẫn đầu trong lĩnh vực vận chuyển và logistics Việt - Trung,
                    được khách hàng tin tưởng lựa chọn hàng đầu. Xây dựng hệ sinh thái logistics
                    toàn diện, ứng dụng công nghệ 4.0 để tạo ra trải nghiệm tốt nhất.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications & Licenses */}
      <Certifications />

      {/* Media Mentions */}
      <MediaMentions />

      {/* CTA */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Hợp tác cùng TBS Logistics
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Hãy để chúng tôi đồng hành cùng bạn trên con đường phát triển kinh doanh
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/lien-he">
                <Button size="lg" variant="secondary">
                  Liên hệ với chúng tôi
                </Button>
              </Link>
              <Link href="/dich-vu">
                <Button size="lg" variant="outline" className="bg-white/10 border-white text-white hover:bg-white hover:text-primary">
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
