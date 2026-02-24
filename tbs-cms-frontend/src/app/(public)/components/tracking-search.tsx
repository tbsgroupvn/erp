'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import TrackingResult from './tracking-result';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/** Strip HTML tags and trim whitespace from input */
function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export interface TrackingData {
  type: 'order' | 'container';
  code: string;
  status: string;
  serviceType?: string;
  shippingRoute?: string;
  currentLocation: string;
  estimatedDelivery: string | null;
  actualDelivery?: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<{
    status: string;
    note: string | null;
    timestamp: string;
  }>;
  trackingEvents: Array<{
    type: string;
    location: string | null;
    description: string | null;
    timestamp: string;
  }>;
  container?: {
    code: string;
    status: string;
    currentLocation: string | null;
    estimatedArrival: string | null;
  } | null;
  orders?: Array<{
    code: string;
    status: string;
  }>;
}

export default function TrackingSearch() {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);

  const handleSearch = async () => {
    const sanitizedCode = sanitizeInput(code);
    if (!sanitizedCode) {
      setError('Vui lòng nhập mã đơn hàng hoặc mã container');
      return;
    }

    // Validate format: only allow alphanumeric, dashes, and underscores
    if (!/^[a-zA-Z0-9\-_]+$/.test(sanitizedCode)) {
      setError('Mã tra cứu chỉ được chứa chữ, số và dấu gạch ngang');
      return;
    }

    setLoading(true);
    setError(null);
    setTrackingData(null);

    try {
      const response = await axios.get<{
        success: boolean;
        data: TrackingData;
        message: string;
      }>(`${API_BASE_URL}/public/tracking/${encodeURIComponent(sanitizedCode)}`);

      if (response.data.success) {
        setTrackingData(response.data.data);
      } else {
        setError('Không tìm thấy thông tin vận chuyển');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(
          'Không tìm thấy đơn hàng hoặc container với mã đã nhập'
        );
      } else {
        setError(
          'Đã xảy ra lỗi khi tra cứu. Vui lòng thử lại sau.'
        );
      }
      console.error('Tracking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-8">
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Nhập mã tra cứu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Nhập mã đơn hàng hoặc mã container..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
              disabled={loading}
            />
            <Button onClick={handleSearch} disabled={loading} size="lg">
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang tra cứu...
                </>
              ) : (
                'Tra cứu'
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Examples */}
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">
              <strong>Ví dụ mã đơn hàng:</strong> TBS-ORD-240101-0001
            </p>
            <p className="text-sm text-slate-600">
              <strong>Ví dụ mã container:</strong> CONT-240101-01
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tracking Result */}
      {trackingData && <TrackingResult data={trackingData} />}
    </div>
  );
}
