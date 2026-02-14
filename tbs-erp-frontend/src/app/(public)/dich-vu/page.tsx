import type { Metadata } from 'next';
import Link from 'next/link';
import { Truck, ShoppingCart, FileText, Package, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, BreadcrumbSchema } from '@/app/(public)/components/breadcrumbs';

export const metadata: Metadata = {
  title: 'Dịch vụ',
  description: 'Các dịch vụ vận chuyển và logistics chuyên nghiệp từ Trung Quốc về Việt Nam - TBS Logistics',
  keywords: [
    'dịch vụ vận chuyển',
    'mua hàng hộ',
    'ủy thác xuất nhập khẩu',
    'LCL chính ngạch',
    'logistics Trung Quốc Việt Nam',
  ],
  openGraph: {
    title: 'Dịch vụ - TBS Logistics',
    description: 'Các dịch vụ vận chuyển và logistics chuyên nghiệp từ Trung Quốc về Việt Nam',
  },
  alternates: {
    canonical: '/dich-vu'
  }
};

const services = [
  {
    id: 'van-chuyen-hang-hoa',
    title: 'Vận chuyển hàng hóa',
    description: 'Dịch vụ vận chuyển hàng hóa từ Trung Quốc về Việt Nam nhanh chóng, an toàn với chi phí tối ưu',
    icon: Truck,
    href: '/dich-vu/van-chuyen-hang-hoa',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'mua-hang-ho',
    title: 'Mua hàng hộ',
    description: 'Hỗ trợ đặt hàng, kiểm tra chất lượng và vận chuyển hàng hóa từ các sàn thương mại điện tử Trung Quốc',
    icon: ShoppingCart,
    href: '/dich-vu/mua-hang-ho',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    id: 'uy-thac-xuat-nhap-khau',
    title: 'Ủy thác xuất nhập khẩu',
    description: 'Dịch vụ ủy thác xuất nhập khẩu chuyên nghiệp, xử lý mọi thủ tục hải quan phức tạp',
    icon: FileText,
    href: '/dich-vu/uy-thac-xuat-nhap-khau',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'lcl-chinh-ngach',
    title: 'LCL chính ngạch',
    description: 'Vận chuyển LCL chính ngạch với thủ tục hải quan minh bạch, đảm bảo pháp lý',
    icon: Package,
    href: '/dich-vu/lcl-chinh-ngach',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
];

const breadcrumbItems = [
  { label: 'Dịch vụ' }
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen">
      <BreadcrumbSchema items={breadcrumbItems} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Dịch vụ của chúng tôi
            </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Giải pháp vận chuyển và logistics toàn diện từ Trung Quốc về Việt Nam.
                Chúng tôi cam kết mang đến dịch vụ tốt nhất với chi phí hợp lý.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Card
                  key={service.id}
                  className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50"
                >
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-lg ${service.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-7 h-7 ${service.color}`} aria-hidden="true" />
                    </div>
                    <CardTitle className="text-2xl mb-2">{service.title}</CardTitle>
                    <CardDescription className="text-base">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href={service.href}>
                      <Button variant="outline" className="group/btn">
                        Tìm hiểu thêm
                        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Tại sao chọn TBS Logistics?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">10+</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Năm kinh nghiệm</h3>
                <p className="text-muted-foreground text-sm">
                  Đội ngũ chuyên nghiệp với hơn 10 năm kinh nghiệm
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">99%</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Khách hài lòng</h3>
                <p className="text-muted-foreground text-sm">
                  Tỷ lệ hài lòng cao từ khách hàng
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">24/7</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Hỗ trợ liên tục</h3>
                <p className="text-muted-foreground text-sm">
                  Đội ngũ hỗ trợ sẵn sàng 24/7
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Sẵn sàng bắt đầu?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Liên hệ với chúng tôi ngay hôm nay để nhận tư vấn miễn phí và báo giá chi tiết
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/lien-he">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Liên hệ ngay
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white text-white hover:bg-white hover:text-primary">
                  Đăng ký tài khoản
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
