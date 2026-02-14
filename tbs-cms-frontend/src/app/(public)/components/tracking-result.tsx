'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TrackingData } from './tracking-search';

const statusLabels: Record<string, { label: string; color: string }> = {
  CONSULTING: { label: 'Đang tư vấn', color: 'bg-slate-500' },
  QUOTATION: { label: 'Đang báo giá', color: 'bg-blue-500' },
  PENDING_DEPOSIT: { label: 'Chờ đặt cọc', color: 'bg-yellow-500' },
  SOURCING: { label: 'Đang mua hàng', color: 'bg-orange-500' },
  WAREHOUSE_CN: { label: 'Kho Trung Quốc', color: 'bg-purple-500' },
  PACKING: { label: 'Đang đóng gói', color: 'bg-indigo-500' },
  CONSOLIDATION: { label: 'Đang ghép container', color: 'bg-violet-500' },
  IN_TRANSIT: { label: 'Đang vận chuyển', color: 'bg-blue-600' },
  CUSTOMS: { label: 'Đang thông quan', color: 'bg-amber-600' },
  WAREHOUSE_VN: { label: 'Kho Việt Nam', color: 'bg-teal-500' },
  DELIVERING: { label: 'Đang giao hàng', color: 'bg-cyan-600' },
  SETTLEMENT: { label: 'Đang quyết toán', color: 'bg-emerald-500' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'bg-green-600' },
  ON_HOLD: { label: 'Tạm giữ', color: 'bg-gray-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-600' },
  RETURNED: { label: 'Đã trả hàng', color: 'bg-pink-600' },
  ISSUE: { label: 'Có vấn đề', color: 'bg-red-700' },
};

const serviceTypeLabels: Record<string, string> = {
  VCT: 'Vận chuyển thuần',
  MHH: 'Mua hàng hộ',
  UTXNK: 'Ủy thác xuất nhập khẩu',
  LCLCN: 'LCL chính ngạch',
};

const shippingRouteLabels: Record<string, string> = {
  SEA: 'Đường biển',
  ROAD: 'Đường bộ',
  AIR: 'Đường hàng không',
};

const eventTypeLabels: Record<string, string> = {
  PICKED_UP: 'Đã nhận hàng',
  IN_WAREHOUSE_CN: 'Nhập kho Trung Quốc',
  PACKED: 'Đã đóng gói',
  LOADED_CONTAINER: 'Đã xếp container',
  DEPARTED_CN: 'Đã khởi hành từ TQ',
  IN_TRANSIT: 'Đang vận chuyển',
  ARRIVED_PORT: 'Đã đến cảng',
  CUSTOMS_CLEARANCE: 'Đang thông quan',
  CUSTOMS_RELEASED: 'Đã thông quan',
  IN_WAREHOUSE_VN: 'Nhập kho Việt Nam',
  OUT_FOR_DELIVERY: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
};

interface TrackingResultProps {
  data: TrackingData;
}

export default function TrackingResult({ data }: TrackingResultProps) {
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusInfo = (status: string) => {
    return statusLabels[status] || { label: status, color: 'bg-gray-500' };
  };

  const statusInfo = getStatusInfo(data.status);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl mb-2">
                {data.type === 'order' ? 'Đơn hàng' : 'Container'}: {data.code}
              </CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`${statusInfo.color} text-white`}>
                  {statusInfo.label}
                </Badge>
                {data.serviceType && (
                  <span className="text-sm text-slate-600">
                    {serviceTypeLabels[data.serviceType] || data.serviceType}
                  </span>
                )}
                {data.shippingRoute && (
                  <span className="text-sm text-slate-600">
                    • {shippingRouteLabels[data.shippingRoute] || data.shippingRoute}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">Vị trí hiện tại:</p>
              <p className="font-semibold text-lg">{data.currentLocation}</p>
            </div>
            {data.estimatedDelivery && (
              <div>
                <p className="text-sm text-slate-600 mb-1">
                  Dự kiến giao hàng:
                </p>
                <p className="font-semibold text-lg">
                  {formatDate(data.estimatedDelivery)}
                </p>
              </div>
            )}
            {data.actualDelivery && (
              <div>
                <p className="text-sm text-slate-600 mb-1">Đã giao hàng:</p>
                <p className="font-semibold text-lg text-green-600">
                  {formatDate(data.actualDelivery)}
                </p>
              </div>
            )}
          </div>

          {/* Container Info (for orders) */}
          {data.container && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-semibold text-slate-900 mb-2">
                Thông tin container:
              </p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-slate-600">Mã container:</span>{' '}
                  <span className="font-medium">{data.container.code}</span>
                </p>
                <p>
                  <span className="text-slate-600">Trạng thái:</span>{' '}
                  <span className="font-medium">
                    {getStatusInfo(data.container.status).label}
                  </span>
                </p>
                {data.container.currentLocation && (
                  <p>
                    <span className="text-slate-600">Vị trí:</span>{' '}
                    <span className="font-medium">
                      {data.container.currentLocation}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Orders (for containers) */}
          {data.orders && data.orders.length > 0 && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-semibold text-slate-900 mb-2">
                Đơn hàng trong container ({data.orders.length}):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.orders.map((order) => (
                  <div
                    key={order.code}
                    className="flex items-center justify-between p-2 bg-white rounded border"
                  >
                    <span className="text-sm font-medium">{order.code}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusInfo(order.status).color} text-white border-none`}
                    >
                      {getStatusInfo(order.status).label}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử vận chuyển</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trackingEvents && data.trackingEvents.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

              <div className="space-y-6">
                {data.trackingEvents.map((event, index) => (
                  <div key={index} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        index === 0
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      <div
                        className={`h-3 w-3 rounded-full ${
                          index === 0 ? 'bg-white' : 'bg-slate-300'
                        }`}
                      />
                    </div>

                    {/* Event content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between mb-1">
                        <p
                          className={`font-semibold ${
                            index === 0 ? 'text-blue-600' : 'text-slate-900'
                          }`}
                        >
                          {eventTypeLabels[event.type] || event.type}
                        </p>
                        <span className="text-sm text-slate-500">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                      {event.location && (
                        <p className="text-sm text-slate-600">
                          Địa điểm: {event.location}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-sm text-slate-600 mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">
              Chưa có thông tin vận chuyển
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status History (for orders) */}
      {data.statusHistory && data.statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.statusHistory.map((history, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <Badge className={`${getStatusInfo(history.status).color} text-white`}>
                      {getStatusInfo(history.status).label}
                    </Badge>
                    {history.note && (
                      <p className="text-sm text-slate-600 mt-2">
                        {history.note}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-slate-500">
                    {formatDate(history.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
