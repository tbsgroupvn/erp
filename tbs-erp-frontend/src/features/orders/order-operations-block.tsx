'use client';

import { Truck, Package, AlertTriangle, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
  COMPLAINT_SEVERITY_LABELS,
  COMPLAINT_SEVERITY_COLORS,
  COMPLAINT_TYPE_LABELS,
} from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import type { ComplaintStatus, ComplaintSeverity, ComplaintType } from '@/lib/types';

interface OrderOperationsBlockProps {
  order: any;
}

export function OrderOperationsBlock({ order }: OrderOperationsBlockProps) {
  const containers = order.containers || [];
  const deliveries = order.deliveries || [];
  const complaints = order.complaints || [];

  return (
    <div className="space-y-6">
      {/* Container Info */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Container ({containers.length})
        </h3>
        {containers.length > 0 ? (
          <div className="space-y-3">
            {containers.map((container: any) => (
              <div key={container.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{container.code || container.containerNumber}</span>
                  {container.status && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                      {container.status}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {container.sealNumber && (
                    <div>Seal: <span className="text-foreground">{container.sealNumber}</span></div>
                  )}
                  {container.route && (
                    <div>Tuyen: <span className="text-foreground">{container.route}</span></div>
                  )}
                  {container.departureDate && (
                    <div>Ngay di: <span className="text-foreground">{formatDateTime(container.departureDate)}</span></div>
                  )}
                  {container.arrivalDate && (
                    <div>Ngay den: <span className="text-foreground">{formatDateTime(container.arrivalDate)}</span></div>
                  )}
                  {container.packageCount != null && (
                    <div>So kien: <span className="text-foreground">{container.packageCount}</span></div>
                  )}
                  {container.totalWeight != null && (
                    <div>Tong KL: <span className="text-foreground">{container.totalWeight} kg</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chua co thong tin container</p>
        )}
      </div>

      {/* Delivery Info */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Giao hang ({deliveries.length})
        </h3>
        {deliveries.length > 0 ? (
          <div className="space-y-3">
            {deliveries.map((delivery: any) => (
              <div key={delivery.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{delivery.code || '---'}</span>
                  {delivery.status && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-700">
                      {delivery.status}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Driver Info */}
                  {delivery.driver && (
                    <div className="col-span-2 flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Tai xe:</span>
                      <span className="font-medium">{delivery.driver.fullName || delivery.driver.name}</span>
                      {delivery.driver.phone && (
                        <span className="text-muted-foreground">({delivery.driver.phone})</span>
                      )}
                    </div>
                  )}
                  {delivery.vehiclePlate && (
                    <div>
                      <span className="text-muted-foreground">Bien so:</span>{' '}
                      <span className="font-medium">{delivery.vehiclePlate}</span>
                    </div>
                  )}
                  {delivery.scheduledDate && (
                    <div>
                      <span className="text-muted-foreground">Lich giao:</span>{' '}
                      <span>{formatDateTime(delivery.scheduledDate)}</span>
                    </div>
                  )}
                  {delivery.deliveredAt && (
                    <div>
                      <span className="text-muted-foreground">Da giao:</span>{' '}
                      <span>{formatDateTime(delivery.deliveredAt)}</span>
                    </div>
                  )}
                  {delivery.recipientName && (
                    <div>
                      <span className="text-muted-foreground">Nguoi nhan:</span>{' '}
                      <span className="font-medium">{delivery.recipientName}</span>
                    </div>
                  )}
                  {delivery.address && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dia chi:</span>{' '}
                      <span>{delivery.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chua co thong tin giao hang</p>
        )}
      </div>

      {/* Complaints */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Khieu nai ({complaints.length})
        </h3>
        {complaints.length > 0 ? (
          <div className="space-y-3">
            {complaints.map((complaint: any) => (
              <div key={complaint.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{complaint.code || `#${complaint.id.slice(0, 8)}`}</span>
                    <StatusBadge
                      label={COMPLAINT_TYPE_LABELS[complaint.type as ComplaintType] || complaint.type}
                      colorClass="bg-slate-100 text-slate-700"
                    />
                    <StatusBadge
                      label={COMPLAINT_SEVERITY_LABELS[complaint.severity as ComplaintSeverity] || complaint.severity}
                      colorClass={COMPLAINT_SEVERITY_COLORS[complaint.severity as ComplaintSeverity] || 'bg-gray-100 text-gray-700'}
                    />
                  </div>
                  <StatusBadge
                    label={COMPLAINT_STATUS_LABELS[complaint.status as ComplaintStatus] || complaint.status}
                    colorClass={COMPLAINT_STATUS_COLORS[complaint.status as ComplaintStatus] || 'bg-gray-100 text-gray-700'}
                  />
                </div>
                <p className="text-sm">{complaint.description || complaint.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(complaint.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Khong co khieu nai</p>
        )}
      </div>
    </div>
  );
}
