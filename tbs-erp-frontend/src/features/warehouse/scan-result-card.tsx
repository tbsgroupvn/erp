'use client';

import Link from 'next/link';
import { Package as PackageIcon, RotateCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import type { Package } from '@/lib/types';

const CN_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Da nhan',
  CHECKED: 'Da kiem',
  PACKED: 'Da dong',
  SHIPPED: 'Da gui',
};

const CN_STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  CHECKED: 'bg-cyan-100 text-cyan-700',
  PACKED: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700',
};

interface ScanResultCardProps {
  pkg: Package;
  onRescan?: () => void;
}

export function ScanResultCard({ pkg, onRescan }: ScanResultCardProps) {
  const status = pkg.warehouseCNStatus ?? '';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageIcon className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">{pkg.code}</span>
          <StatusBadge
            label={CN_STATUS_LABELS[status] || status || '---'}
            colorClass={CN_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">Don hang:</span>{' '}
          <span className="font-medium">{pkg.orderId || '---'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Tracking TQ:</span>{' '}
          <span className="font-medium">{pkg.trackingNumberCN || '---'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Can nang:</span>{' '}
          <span className="font-medium">
            {pkg.actualWeight != null ? Number(pkg.actualWeight).toFixed(2) : '---'} kg
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">TL tinh phi:</span>{' '}
          <span className="font-medium">
            {pkg.chargeableWeight != null ? Number(pkg.chargeableWeight).toFixed(2) : '---'} kg
          </span>
        </div>
        {pkg.length && pkg.width && pkg.height && (
          <div>
            <span className="text-muted-foreground">Kich thuoc:</span>{' '}
            <span className="font-medium">
              {Number(pkg.length)}x{Number(pkg.width)}x{Number(pkg.height)} cm
            </span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Mo ta:</span>{' '}
          <span className="font-medium">{pkg.description || '---'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link href={`/kho-trung-quoc/${pkg.id}`}>
          <Button variant="default" size="sm" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Xem chi tiet
          </Button>
        </Link>
        {onRescan && (
          <Button variant="outline" size="sm" onClick={onRescan} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Quet tiep
          </Button>
        )}
      </div>
    </div>
  );
}
