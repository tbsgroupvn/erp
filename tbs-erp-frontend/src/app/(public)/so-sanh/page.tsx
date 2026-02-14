'use client';

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';

const shippingMethods = [
  {
    name: 'Đường biển',
    icon: '🚢',
    priceRange: '30,000 - 50,000đ/kg',
    transitTime: '15-25 ngày',
    reliability: 'Cao',
    costEfficiency: 'Rất cao',
    speed: 'Chậm',
    pros: [
      'Chi phí thấp nhất',
      'Phù hợp hàng khối lượng lớn',
      'An toàn, ổn định',
      'Không giới hạn kích thước',
    ],
    cons: [
      'Thời gian vận chuyển lâu',
      'Phụ thuộc vào thời tiết',
      'Thủ tục phức tạp hơn',
    ],
    recommended: 'Hàng không cần gấp, khối lượng lớn',
  },
  {
    name: 'Đường bộ',
    icon: '🚛',
    priceRange: '40,000 - 70,000đ/kg',
    transitTime: '5-7 ngày',
    reliability: 'Rất cao',
    costEfficiency: 'Cao',
    speed: 'Nhanh',
    pros: [
      'Thời gian ổn định',
      'Linh hoạt điểm giao nhận',
      'Dễ theo dõi',
      'Thủ tục đơn giản hơn',
    ],
    cons: [
      'Chi phí cao hơn đường biển',
      'Giới hạn về kích thước',
      'Phụ thuộc giao thông',
    ],
    recommended: 'Cần nhanh, khối lượng vừa phải',
  },
  {
    name: 'Đường hàng không',
    icon: '✈️',
    priceRange: '80,000 - 150,000đ/kg',
    transitTime: '3-5 ngày',
    reliability: 'Cao',
    costEfficiency: 'Thấp',
    speed: 'Rất nhanh',
    pros: [
      'Nhanh nhất',
      'An toàn cao',
      'Thời gian chính xác',
      'Phù hợp hàng giá trị cao',
    ],
    cons: [
      'Chi phí rất cao',
      'Giới hạn hàng nguy hiểm',
      'Phụ thuộc thời tiết bay',
    ],
    recommended: 'Hàng cần gấp, giá trị cao',
  },
];

const services = [
  {
    code: 'VCT',
    name: 'Vận chuyển thuần',
    description: 'Chỉ vận chuyển hàng có sẵn',
    baseFee: '35,000đ/kg',
    serviceFee: '100,000đ',
    features: [
      { name: 'Vận chuyển hàng hóa', included: true },
      { name: 'Mua hàng hộ', included: false },
      { name: 'Khai báo hải quan', included: false },
      { name: 'Đóng gói', included: true },
      { name: 'Bảo hiểm cơ bản', included: true },
      { name: 'Tư vấn khai báo', included: false },
    ],
  },
  {
    code: 'MHH',
    name: 'Mua hàng hộ',
    description: 'Order hàng + vận chuyển',
    baseFee: '40,000đ/kg',
    serviceFee: '150,000đ',
    features: [
      { name: 'Vận chuyển hàng hóa', included: true },
      { name: 'Mua hàng hộ', included: true },
      { name: 'Khai báo hải quan', included: false },
      { name: 'Đóng gói', included: true },
      { name: 'Bảo hiểm cơ bản', included: true },
      { name: 'Tư vấn khai báo', included: false },
    ],
  },
  {
    code: 'UTXNK',
    name: 'Ủy thác XNK',
    description: 'Dịch vụ toàn diện',
    baseFee: '45,000đ/kg',
    serviceFee: '200,000đ',
    features: [
      { name: 'Vận chuyển hàng hóa', included: true },
      { name: 'Mua hàng hộ', included: true },
      { name: 'Khai báo hải quan', included: true },
      { name: 'Đóng gói', included: true },
      { name: 'Bảo hiểm cơ bản', included: true },
      { name: 'Tư vấn khai báo', included: true },
    ],
    isPopular: true,
  },
  {
    code: 'LCLCN',
    name: 'LCL chính ngạch',
    description: 'Hàng lẻ chính ngạch',
    baseFee: '50,000đ/kg',
    serviceFee: '250,000đ',
    features: [
      { name: 'Vận chuyển hàng hóa', included: true },
      { name: 'Mua hàng hộ', included: true },
      { name: 'Khai báo hải quan', included: true },
      { name: 'Đóng gói', included: true },
      { name: 'Bảo hiểm cơ bản', included: true },
      { name: 'Tư vấn khai báo', included: true },
    ],
  },
];

export default function ComparisonPage() {
  const breadcrumbItems = [{ label: 'So sánh dịch vụ' }];

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
                So sánh dịch vụ
              </h1>
              <p className="text-lg text-muted-foreground">
                Tìm hiểu và so sánh các phương thức vận chuyển và dịch vụ để chọn
                giải pháp phù hợp nhất với nhu cầu của bạn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Shipping Methods Comparison */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              So sánh phương thức vận chuyển
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {shippingMethods.map((method) => (
                <Card key={method.name} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-center">
                      <div className="text-5xl mb-4">{method.icon}</div>
                      <CardTitle className="text-2xl">{method.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Giá cả:
                        </span>
                        <span className="font-semibold text-sm">
                          {method.priceRange}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Thời gian:
                        </span>
                        <span className="font-semibold text-sm">
                          {method.transitTime}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Độ tin cậy:
                        </span>
                        <span className="font-semibold text-sm">
                          {method.reliability}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Hiệu quả chi phí:
                        </span>
                        <span className="font-semibold text-sm">
                          {method.costEfficiency}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Tốc độ:
                        </span>
                        <span className="font-semibold text-sm">{method.speed}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-green-600">
                        Ưu điểm:
                      </h4>
                      <ul className="space-y-1">
                        {method.pros.map((pro, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-red-600">
                        Nhược điểm:
                      </h4>
                      <ul className="space-y-1">
                        {method.cons.map((con, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <X className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Phù hợp cho:</span>{' '}
                        {method.recommended}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services Comparison */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              So sánh gói dịch vụ
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service) => (
                <Card
                  key={service.code}
                  className={
                    service.isPopular
                      ? 'border-2 border-blue-500 shadow-lg relative'
                      : 'hover:shadow-lg transition-shadow'
                  }
                >
                  {service.isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-600">Phổ biến nhất</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="text-center">
                      <Badge variant="outline" className="mb-3">
                        {service.code}
                      </Badge>
                      <CardTitle className="text-xl mb-2">
                        {service.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {service.baseFee}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Phí dịch vụ: {service.serviceFee}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {service.features.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm">{feature.name}</span>
                          {feature.included ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <X className="h-5 w-5 text-gray-300" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Cần tư vấn thêm về dịch vụ?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Đội ngũ chuyên gia của chúng tôi sẵn sàng tư vấn giải pháp phù hợp
              nhất cho nhu cầu của bạn.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/lien-he"
                className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Liên hệ tư vấn
              </Link>
              <Link
                href="/tinh-phi"
                className="inline-flex items-center justify-center px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
              >
                Tính phí vận chuyển
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
