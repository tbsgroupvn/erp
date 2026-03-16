'use client';

import { Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import { ORDER_STATUS_LABELS } from '@/lib/utils/constants';
import type { OrderStatus } from '@/lib/types';

interface StatusHistoryEntry {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
}

interface OrderTrackingProps {
  statusHistory: StatusHistoryEntry[];
}

export function OrderTracking({ statusHistory }: OrderTrackingProps) {
  if (!statusHistory || statusHistory.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Lich su trang thai</h4>
      <div className="space-y-2">
        {statusHistory.map((h) => (
          <div key={h.id} className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm">
                {h.fromStatus && (
                  <>
                    <span className="font-medium">
                      {ORDER_STATUS_LABELS[h.fromStatus as OrderStatus] || h.fromStatus}
                    </span>
                    {' -> '}
                  </>
                )}
                <span className="font-medium">
                  {ORDER_STATUS_LABELS[h.toStatus as OrderStatus] || h.toStatus}
                </span>
              </p>
              {h.note && (
                <p className="text-xs text-muted-foreground">{h.note}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(h.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
