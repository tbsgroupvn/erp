import type { Metadata } from 'next';
import TrackingSearch from '../components/tracking-search';

export const metadata: Metadata = {
  title: 'Tra cứu đơn hàng',
  description:
    'Tra cứu tình trạng đơn hàng và lịch sử vận chuyển. Cập nhật vị trí hàng hóa theo thời gian thực.',
};

export default function TrackingPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Tra cứu đơn hàng
          </h1>
          <p className="text-lg text-slate-600">
            Nhập mã đơn hàng hoặc mã container để kiểm tra tình trạng vận chuyển
          </p>
        </div>

        <TrackingSearch />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Mã đơn hàng</h3>
            <p className="text-sm text-slate-600">
              Định dạng: TBS-ORD-YYMMDD-XXXX
              <br />
              Ví dụ: TBS-ORD-240101-0001
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Mã container</h3>
            <p className="text-sm text-slate-600">
              Định dạng: CONT-YYMMDD-XX
              <br />
              Ví dụ: CONT-240101-01
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">
              Cập nhật liên tục
            </h3>
            <p className="text-sm text-slate-600">
              Thông tin vận chuyển được cập nhật theo thời gian thực từ hệ thống
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
