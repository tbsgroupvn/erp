import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Package,
  Truck,
  FileText,
  Search,
  ArrowRight,
} from 'lucide-react';
import { TrustBadges } from './components/trust-badges';
import { SuccessMetrics } from './components/success-metrics';
import { TestimonialsSkeleton } from './components/testimonials-skeleton';
import { PartnerLogos } from './components/partner-logos';
import { UrgencyBanner } from './components/urgency-banner';

// Dynamically import Testimonials component for code splitting
const Testimonials = dynamic(() => import('./components/testimonials').then((mod) => ({ default: mod.Testimonials })), {
  loading: () => <TestimonialsSkeleton />,
  ssr: true,
});

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Urgency Banner */}
      <UrgencyBanner type="discount" />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 px-4 py-24 text-white md:py-40">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="container relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-8 text-5xl font-bold font-heading leading-tight md:text-6xl lg:text-7xl animate-fade-in">
              Vận chuyển hàng Trung Quốc
              <br />
              <span className="bg-gradient-to-r from-blue-200 to-blue-100 bg-clip-text text-transparent">
                Chuyên nghiệp - Uy tín - Giá tốt
              </span>
            </h1>
            <p className="mb-10 text-lg text-blue-100 md:text-xl leading-relaxed">
              Dịch vụ order hàng Taobao, 1688, vận chuyển hàng hóa và ủy thác
              xuất nhập khẩu chính ngạch. Giao hàng 5-7 ngày, giá từ 15k/kg.
              Hơn <span className="font-bold text-white">3000+</span> khách hàng tin tưởng
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/dang-ky"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-blue-600 shadow-xl transition-all duration-300 hover:bg-blue-50 hover:shadow-2xl hover:scale-105 cursor-pointer"
              >
                Bắt đầu ngay
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <Link
                href="/tinh-phi"
                className="group inline-flex items-center gap-2 rounded-xl border-2 border-white bg-white/10 backdrop-blur-sm px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-white hover:text-blue-600 cursor-pointer"
              >
                Tính phí vận chuyển
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* Trust Badges Section */}
      <TrustBadges />

      {/* Services Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              Dịch vụ của chúng tôi
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Cung cấp giải pháp toàn diện cho nhu cầu vận chuyển và quản lý
              hàng hóa của bạn
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-md transition-all duration-300 hover:border-blue-500 hover:shadow-xl hover:-translate-y-2 cursor-pointer">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 transition-all duration-300 group-hover:from-blue-600 group-hover:to-blue-500 group-hover:text-white group-hover:scale-110 group-hover:shadow-lg">
                <Package className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-xl font-heading font-bold text-gray-900">
                Order hàng
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Đặt hàng trực tiếp từ Trung Quốc với giá tốt nhất, hỗ trợ mua
                hàng và đàm phán với nhà cung cấp
              </p>
              <Link
                href="/dich-vu/order-hang"
                className="group/link inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition-all hover:gap-2 hover:text-blue-700"
              >
                Tìm hiểu thêm
                <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" aria-hidden="true" />
              </Link>
            </div>

            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-md transition-all duration-300 hover:border-green-500 hover:shadow-xl hover:-translate-y-2 cursor-pointer">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-green-50 text-green-600 transition-all duration-300 group-hover:from-green-600 group-hover:to-green-500 group-hover:text-white group-hover:scale-110 group-hover:shadow-lg">
                <Truck className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-xl font-heading font-bold text-gray-900">
                Vận chuyển
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Dịch vụ vận chuyển đường bộ, đường biển an toàn, nhanh chóng từ
                Trung Quốc về Việt Nam
              </p>
              <Link
                href="/dich-vu/van-chuyen"
                className="group/link inline-flex items-center gap-1 text-sm font-semibold text-green-600 transition-all hover:gap-2 hover:text-green-700"
              >
                Tìm hiểu thêm
                <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" aria-hidden="true" />
              </Link>
            </div>

            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-md transition-all duration-300 hover:border-purple-500 hover:shadow-xl hover:-translate-y-2 cursor-pointer">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 transition-all duration-300 group-hover:from-purple-600 group-hover:to-purple-500 group-hover:text-white group-hover:scale-110 group-hover:shadow-lg">
                <FileText className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-xl font-heading font-bold text-gray-900">
                Khai báo hải quan
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Hỗ trợ hoàn tất thủ tục hải quan, giấy tờ pháp lý nhanh chóng,
                chính xác
              </p>
              <Link
                href="/dich-vu/hai-quan"
                className="group/link inline-flex items-center gap-1 text-sm font-semibold text-purple-600 transition-all hover:gap-2 hover:text-purple-700"
              >
                Tìm hiểu thêm
                <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" aria-hidden="true" />
              </Link>
            </div>

            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-md transition-all duration-300 hover:border-orange-500 hover:shadow-xl hover:-translate-y-2 cursor-pointer">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 transition-all duration-300 group-hover:from-orange-600 group-hover:to-orange-500 group-hover:text-white group-hover:scale-110 group-hover:shadow-lg">
                <Search className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-xl font-heading font-bold text-gray-900">
                Tra cứu đơn hàng
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Theo dõi tình trạng đơn hàng và lộ trình vận chuyển theo thời
                gian thực
              </p>
              <Link
                href="/tra-cuu"
                className="group/link inline-flex items-center gap-1 text-sm font-semibold text-orange-600 transition-all hover:gap-2 hover:text-orange-700"
              >
                Tra cứu ngay
                <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Success Metrics Section with animated counters */}
      <SuccessMetrics />

      {/* Testimonials Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              Khách hàng nói gì về chúng tôi
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Hơn 3000+ khách hàng tin tưởng và hài lòng với dịch vụ của TBS Logistics
            </p>
          </div>
          <Testimonials />
        </div>
      </section>

      {/* Partner Logos Section */}
      <PartnerLogos />

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="container relative mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-bold font-heading md:text-5xl">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="mb-10 text-lg text-blue-100 leading-relaxed max-w-2xl mx-auto">
            Đăng ký ngay hôm nay để trải nghiệm dịch vụ vận chuyển chuyên nghiệp
            và nhận ưu đãi dành cho khách hàng mới
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dang-ky"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-blue-600 shadow-xl transition-all duration-300 hover:bg-blue-50 hover:shadow-2xl hover:scale-105 cursor-pointer"
            >
              Đăng ký miễn phí
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/lien-he"
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-white bg-white/10 backdrop-blur-sm px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-white hover:text-blue-600 cursor-pointer"
            >
              Liên hệ tư vấn
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
