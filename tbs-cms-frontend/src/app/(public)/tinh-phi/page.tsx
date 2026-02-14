import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { PricingCalculatorSkeleton } from '@/components/shared/pricing-calculator-skeleton';

const PricingCalculator = dynamic(
  () => import('../components/pricing-calculator'),
  {
    loading: () => <PricingCalculatorSkeleton />,
    ssr: false,
  }
);

export const metadata: Metadata = {
  title: 'Tính phí vận chuyển',
  description:
    'Tính toán chi phí vận chuyển hàng hóa từ Trung Quốc về Việt Nam. Dự toán nhanh chóng và minh bạch.',
};

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Tính phí vận chuyển
          </h1>
          <p className="text-lg text-slate-600">
            Nhập thông tin hàng hóa để nhận báo giá nhanh chóng
          </p>
        </div>

        <PricingCalculator />

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="font-semibold text-slate-900 mb-3">
            Lưu ý quan trọng
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>
                Chi phí trên đây là ước tính ban đầu. Chi phí thực tế sẽ được
                xác nhận sau khi kiểm tra hàng hóa tại kho.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>
                Trọng lượng tính phí = Max(trọng lượng thực, trọng lượng quy
                đổi). Trọng lượng quy đổi = Dài × Rộng × Cao (cm) / Hệ số.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>
                Giá cuối cùng có thể thay đổi tùy thuộc vào loại hàng hóa, tuyến
                đường và khối lượng thực tế.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>
                Để nhận báo giá chính xác, vui lòng liên hệ với bộ phận kinh
                doanh của chúng tôi.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
