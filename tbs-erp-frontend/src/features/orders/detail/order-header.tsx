'use client';

import Link from 'next/link';
import { ArrowLeft, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDateTime } from '@/lib/utils/format';
import { MASTER_ORDER_STATUS_LABELS, MASTER_ORDER_STATUS_COLORS } from '@/lib/utils/constants';
import type { MasterOrderStatus } from '@/lib/types';

interface OrderHeaderProps {
  masterOrder: {
    id: string;
    code: string;
    overallStatus: MasterOrderStatus;
    createdAt: string;
    customerId?: string;
    branch?: string;
    note?: string;
    subOrders?: Array<{
      serviceType: string;
      clearanceType: string;
      shippingRoute?: string | null;
      note?: string;
      items?: Array<{
        productName: string;
        productUrl?: string;
        quantity: number;
        unitPrice: number;
        note?: string;
      }>;
    }>;
  };
}

export function OrderHeader({ masterOrder }: OrderHeaderProps) {
  const router = useRouter();
  const overallStatus = masterOrder.overallStatus;

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/don-hang"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{masterOrder.code}</h1>
          <StatusBadge
            label={MASTER_ORDER_STATUS_LABELS[overallStatus] || overallStatus}
            colorClass={MASTER_ORDER_STATUS_COLORS[overallStatus] || 'bg-gray-100 text-gray-700'}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Tao luc {formatDateTime(masterOrder.createdAt)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          try {
            if (typeof window === 'undefined') return;
            sessionStorage.setItem(
              'cloneOrderData',
              JSON.stringify({
                customerId: masterOrder.customerId,
                branch: masterOrder.branch,
                note: masterOrder.note,
                subOrders:
                  masterOrder.subOrders?.map((so) => ({
                    serviceType: so.serviceType,
                    clearanceType: so.clearanceType,
                    shippingRoute: so.shippingRoute,
                    note: so.note,
                    items:
                      so.items?.map((item) => ({
                        productName: item.productName,
                        productUrl: item.productUrl,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        note: item.note,
                      })) || [],
                  })) || [],
              }),
            );
            router.push(`/don-hang/tao-moi?clone=${masterOrder.id}`);
          } catch (error) {
            console.error('Failed to prepare clone data:', error);
            toast?.error('Khong the chuan bi du lieu sao chep');
          }
        }}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        <Copy className="h-4 w-4" />
        Tao don tuong tu
      </button>
    </div>
  );
}
