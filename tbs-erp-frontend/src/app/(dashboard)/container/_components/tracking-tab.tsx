'use client';

import { useState } from 'react';
import { Search, Package, Ship } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { TrackingTimeline } from '@/features/tracking/tracking-timeline';
import { useTracking, useContainerTracking } from '@/lib/hooks/use-tracking';
import { TRACKING_EVENT_LABELS } from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import type { TrackingEventType } from '@/lib/types/enums';

export function TrackingTab() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [containerId, setContainerId] = useState('');
  const [containerSearchTerm, setContainerSearchTerm] = useState('');

  const { data: trackingInfo, isLoading: trackingLoading } = useTracking(searchTerm);
  const { data: containerInfo, isLoading: containerLoading } = useContainerTracking(containerSearchTerm);

  const handleSearch = () => {
    if (trackingNumber.trim()) {
      setSearchTerm(trackingNumber.trim());
    }
  };

  const handleContainerSearch = () => {
    if (containerId.trim()) {
      setContainerSearchTerm(containerId.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Package tracking */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Theo dõi kiện hàng</h3>
        </div>
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nhập mã tracking..."
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSearch}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tìm kiếm
          </button>
        </div>

        {trackingLoading && <LoadingOverlay className="h-40" />}

        {trackingInfo && !trackingLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Mã tracking</p>
                <p className="font-medium">{trackingInfo.trackingNumber}</p>
              </div>
              {trackingInfo.orderCode && (
                <div>
                  <p className="text-xs text-muted-foreground">Mã đơn hàng</p>
                  <p className="font-medium">{trackingInfo.orderCode}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Trạng thái hiện tại</p>
                <p className="font-medium text-primary">
                  {TRACKING_EVENT_LABELS[trackingInfo.currentStage as TrackingEventType] || trackingInfo.currentStage}
                </p>
              </div>
              {trackingInfo.estimatedDelivery && (
                <div>
                  <p className="text-xs text-muted-foreground">Dự kiến giao hàng</p>
                  <p className="font-medium">{formatDate(trackingInfo.estimatedDelivery, 'dd/MM/yyyy')}</p>
                </div>
              )}
            </div>

            <TrackingTimeline
              events={trackingInfo.events}
              currentStage={trackingInfo.currentStage}
            />
          </div>
        )}

        {searchTerm && !trackingInfo && !trackingLoading && (
          <p className="text-sm text-muted-foreground">Không tìm thấy thông tin theo dõi cho mã này.</p>
        )}
      </div>

      {/* Container tracking */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ship className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Theo dõi container</h3>
        </div>
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nhập mã container..."
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleContainerSearch()}
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleContainerSearch}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tìm kiếm
          </button>
        </div>

        {containerLoading && <LoadingOverlay className="h-40" />}

        {containerInfo && !containerLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Mã container</p>
                <p className="font-medium">{containerInfo.containerCode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Số kiện</p>
                <p className="font-medium">{containerInfo.packageCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trạng thái</p>
                <p className="font-medium text-primary">
                  {TRACKING_EVENT_LABELS[containerInfo.currentStage as TrackingEventType] || containerInfo.currentStage}
                </p>
              </div>
              {containerInfo.estimatedArrival && (
                <div>
                  <p className="text-xs text-muted-foreground">Dự kiến đến</p>
                  <p className="font-medium">{formatDate(containerInfo.estimatedArrival, 'dd/MM/yyyy')}</p>
                </div>
              )}
            </div>

            <TrackingTimeline
              events={containerInfo.events}
              currentStage={containerInfo.currentStage}
            />
          </div>
        )}

        {containerSearchTerm && !containerInfo && !containerLoading && (
          <p className="text-sm text-muted-foreground">Không tìm thấy thông tin container.</p>
        )}
      </div>
    </div>
  );
}
