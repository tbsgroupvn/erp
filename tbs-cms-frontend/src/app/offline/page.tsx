'use client';

import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <WifiOff className="h-10 w-10 text-gray-400" aria-hidden="true" />
        </div>

        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          Không có kết nối mạng
        </h1>

        <p className="mb-8 text-lg text-gray-600">
          Vui lòng kiểm tra kết nối internet của bạn và thử lại.
        </p>

        <Button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2"
        >
          Thử lại
        </Button>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 text-left">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Các bước khắc phục:
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">•</span>
              <span>Kiểm tra kết nối WiFi hoặc dữ liệu di động</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">•</span>
              <span>Tắt chế độ máy bay nếu đang bật</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">•</span>
              <span>Khởi động lại router hoặc modem</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">•</span>
              <span>Liên hệ nhà cung cấp dịch vụ internet nếu vấn đề vẫn tiếp diễn</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
