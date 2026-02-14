import { Award, FileCheck, Shield, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const certifications = [
  {
    icon: FileCheck,
    title: 'Giấy phép Kinh doanh',
    description: 'Đăng ký kinh doanh hợp pháp',
    number: 'MST: 0123456789',
  },
  {
    icon: Shield,
    title: 'Giấy phép Xuất Nhập Khẩu',
    description: 'Được cấp bởi Bộ Công Thương',
    number: 'Số: XNK/2014/123456',
  },
  {
    icon: BadgeCheck,
    title: 'Giấy phép Logistics',
    description: 'Hoạt động vận tải quốc tế',
    number: 'Số: LOG/2014/789012',
  },
  {
    icon: Award,
    title: 'Chứng nhận ISO 9001:2015',
    description: 'Hệ thống quản lý chất lượng',
    number: 'Chứng nhận: ISO-2020-VN',
  },
  {
    icon: FileCheck,
    title: 'Giấy phép Đại lý Hải quan',
    description: 'Ủy thác khai báo hải quan',
    number: 'Số: HQ/2015/345678',
  },
  {
    icon: Shield,
    title: 'Bảo hiểm trách nhiệm',
    description: 'Bảo hiểm hàng hóa toàn diện',
    number: 'Hợp đồng: BH-TBS-2024',
  },
];

export function Certifications() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Chứng nhận & Giấy phép
            </h2>
            <p className="text-lg text-muted-foreground">
              Hoạt động hợp pháp với đầy đủ giấy phép và chứng nhận
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certifications.map((cert, index) => {
              const Icon = cert.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="w-7 h-7 text-primary" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-lg">{cert.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {cert.description}
                    </p>
                    <p className="text-xs font-mono bg-gray-100 px-3 py-2 rounded text-gray-700">
                      {cert.number}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-3 rounded-lg">
              <Shield className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold">
                Hoạt động hợp pháp và minh bạch với đầy đủ giấy tờ
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
