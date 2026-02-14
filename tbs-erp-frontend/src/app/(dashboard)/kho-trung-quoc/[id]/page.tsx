'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, Package, Ruler, Scale, Truck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePackageCN,
  useMeasurePackageCN,
  useUpdateCNStatus,
} from '@/lib/hooks/use-warehouse';
import { formatDate } from '@/lib/utils/format';
import type { WarehouseCNStatus, WarehouseVNStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const CN_STATUS_LABELS: Record<WarehouseCNStatus, string> = {
  RECEIVED: '\u0110\u00e3 nh\u1eadn',
  CHECKED: '\u0110\u00e3 ki\u1ec3m',
  PACKED: '\u0110\u00e3 \u0111\u00f3ng',
  SHIPPED: '\u0110\u00e3 g\u1eedi',
};

const CN_STATUS_COLORS: Record<WarehouseCNStatus, string> = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  CHECKED: 'bg-cyan-100 text-cyan-700',
  PACKED: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700',
};

const VN_STATUS_LABELS: Record<WarehouseVNStatus, string> = {
  RECEIVED: '\u0110\u00e3 nh\u1eadn',
  SORTED: '\u0110\u00e3 ph\u00e2n lo\u1ea1i',
  READY: 'S\u1eb5n s\u00e0ng giao',
  DELIVERED: '\u0110\u00e3 giao',
};

const VN_STATUS_COLORS: Record<WarehouseVNStatus, string> = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  SORTED: 'bg-cyan-100 text-cyan-700',
  READY: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
};

const CN_STATUS_FLOW: WarehouseCNStatus[] = [
  'RECEIVED',
  'CHECKED',
  'PACKED',
  'SHIPPED',
];

const NEXT_STATUS_LABEL: Record<WarehouseCNStatus, string> = {
  RECEIVED: 'Chuy\u1ec3n sang \u0110\u00e3 ki\u1ec3m',
  CHECKED: 'Chuy\u1ec3n sang \u0110\u00e3 \u0111\u00f3ng',
  PACKED: 'Chuy\u1ec3n sang \u0110\u00e3 g\u1eedi',
  SHIPPED: '',
};

// ---------------------------------------------------------------------------
// Measure form schema
// ---------------------------------------------------------------------------

const measureSchema = z.object({
  actualWeight: z.number({ required_error: 'B\u1eaft bu\u1ed9c' }).positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  length: z.number({ required_error: 'B\u1eaft bu\u1ed9c' }).positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  width: z.number({ required_error: 'B\u1eaft bu\u1ed9c' }).positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  height: z.number({ required_error: 'B\u1eaft bu\u1ed9c' }).positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  note: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PackageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { data: pkg, isLoading } = usePackageCN(params.id);
  const measureMutation = useMeasurePackageCN();
  const statusMutation = useUpdateCNStatus();

  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [measureForm, setMeasureForm] = useState({
    actualWeight: '',
    length: '',
    width: '',
    height: '',
    note: '',
  });
  const [measureErrors, setMeasureErrors] = useState<Record<string, string>>(
    {},
  );

  // ---- helpers ----

  function getNextStatus(
    current: WarehouseCNStatus | null,
  ): WarehouseCNStatus | null {
    if (!current) return null;
    const idx = CN_STATUS_FLOW.indexOf(current);
    if (idx < 0 || idx >= CN_STATUS_FLOW.length - 1) return null;
    return CN_STATUS_FLOW[idx + 1];
  }

  function handleStatusUpdate() {
    if (!pkg) return;
    const next = getNextStatus(pkg.warehouseCNStatus);
    if (!next) return;
    statusMutation.mutate({ id: pkg.id, status: next });
  }

  function handleMeasureSubmit() {
    const parsed = measureSchema.safeParse({
      actualWeight: parseFloat(measureForm.actualWeight),
      length: parseFloat(measureForm.length),
      width: parseFloat(measureForm.width),
      height: parseFloat(measureForm.height),
      note: measureForm.note || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setMeasureErrors(fieldErrors);
      return;
    }

    setMeasureErrors({});
    measureMutation.mutate(
      { id: params.id, data: parsed.data },
      {
        onSuccess: () => {
          setShowMeasureForm(false);
          setMeasureForm({
            actualWeight: '',
            length: '',
            width: '',
            height: '',
            note: '',
          });
        },
      },
    );
  }

  // ---- loading state ----

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/kho-trung-quoc')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay l\u1ea1i
        </Button>
        <p className="text-muted-foreground">Kh\u00f4ng t\u00ecm th\u1ea5y ki\u1ec7n h\u00e0ng.</p>
      </div>
    );
  }

  const nextStatus = getNextStatus(pkg.warehouseCNStatus);
  const hasMeasurements =
    pkg.actualWeight != null &&
    pkg.length != null &&
    pkg.width != null &&
    pkg.height != null;

  // ---- timeline events ----

  const timelineEvents: { label: string; date: string | null; by?: string | null }[] = [
    { label: 'Ng\u00e0y t\u1ea1o', date: pkg.createdAt },
    {
      label: 'Nh\u1eadn t\u1ea1i TQ',
      date: pkg.receivedCNAt,
      by: pkg.receivedCNBy,
    },
    { label: '\u0110\u00f3ng g\u00f3i', date: pkg.packedAt },
    {
      label: 'Nh\u1eadn t\u1ea1i VN',
      date: pkg.receivedVNAt,
      by: pkg.receivedVNBy,
    },
    { label: 'Giao h\u00e0ng', date: pkg.deliveredAt },
  ].filter((e) => e.date != null);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/kho-trung-quoc')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title="Chi ti\u1ebft ki\u1ec7n h\u00e0ng"
            description={pkg.code}
          >
            {nextStatus && (
              <Button
                onClick={handleStatusUpdate}
                disabled={statusMutation.isPending}
              >
                <Truck className="mr-2 h-4 w-4" />
                {NEXT_STATUS_LABEL[pkg.warehouseCNStatus!]}
              </Button>
            )}
          </PageHeader>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ---------- Card 1: Th\u00f4ng tin c\u01a1 b\u1ea3n ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Th\u00f4ng tin c\u01a1 b\u1ea3n
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">M\u00e3 ki\u1ec7n</dt>
              <dd className="font-medium">{pkg.code}</dd>

              <dt className="text-muted-foreground">\u0110\u01a1n h\u00e0ng</dt>
              <dd>
                <Link
                  href={`/don-hang/${pkg.orderId}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {pkg.orderId}
                </Link>
              </dd>

              <dt className="text-muted-foreground">Tracking TQ</dt>
              <dd>{pkg.trackingNumberCN || '---'}</dd>

              <dt className="text-muted-foreground">Container</dt>
              <dd>{pkg.containerId || '---'}</dd>

              <dt className="text-muted-foreground">Tr\u1ea1ng th\u00e1i kho TQ</dt>
              <dd>
                {pkg.warehouseCNStatus ? (
                  <StatusBadge
                    label={CN_STATUS_LABELS[pkg.warehouseCNStatus]}
                    colorClass={CN_STATUS_COLORS[pkg.warehouseCNStatus]}
                  />
                ) : (
                  '---'
                )}
              </dd>

              <dt className="text-muted-foreground">Tr\u1ea1ng th\u00e1i kho VN</dt>
              <dd>
                {pkg.warehouseVNStatus ? (
                  <StatusBadge
                    label={VN_STATUS_LABELS[pkg.warehouseVNStatus]}
                    colorClass={VN_STATUS_COLORS[pkg.warehouseVNStatus]}
                  />
                ) : (
                  '---'
                )}
              </dd>

              <dt className="text-muted-foreground">Ghi ch\u00fa</dt>
              <dd className="col-span-1">{pkg.note || '---'}</dd>
            </dl>
          </CardContent>
        </Card>

        {/* ---------- Card 2: K\u00edch th\u01b0\u1edbc & C\u00e2n n\u1eb7ng ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ruler className="h-5 w-5" />
              K\u00edch th\u01b0\u1edbc & C\u00e2n n\u1eb7ng
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasMeasurements && !showMeasureForm ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">C\u00e2n n\u1eb7ng th\u1ef1c</dt>
                <dd className="font-medium">
                  <Scale className="mr-1 inline h-4 w-4" />
                  {pkg.actualWeight?.toFixed(2)} kg
                </dd>

                <dt className="text-muted-foreground">K\u00edch th\u01b0\u1edbc (D\u00d7R\u00d7C)</dt>
                <dd className="font-medium">
                  {pkg.length} \u00d7 {pkg.width} \u00d7 {pkg.height} cm
                </dd>

                <dt className="text-muted-foreground">TL th\u1ec3 t\u00edch</dt>
                <dd className="font-medium">
                  {pkg.volumetricWeight?.toFixed(2) ?? '---'} kg
                </dd>

                <dt className="text-muted-foreground">TL t\u00ednh ph\u00ed</dt>
                <dd className="font-medium">
                  {pkg.chargeableWeight?.toFixed(2) ?? '---'} kg
                </dd>
              </dl>
            ) : !showMeasureForm ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Ruler className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-4 text-sm text-muted-foreground">
                  Ch\u01b0a c\u00e2n \u0111o
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowMeasureForm(true)}
                >
                  <Scale className="mr-2 h-4 w-4" />
                  C\u00e2n/\u0110o
                </Button>
              </div>
            ) : null}

            {showMeasureForm && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="actualWeight">C\u00e2n n\u1eb7ng th\u1ef1c (kg)</Label>
                    <Input
                      id="actualWeight"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={measureForm.actualWeight}
                      onChange={(e) =>
                        setMeasureForm((f) => ({
                          ...f,
                          actualWeight: e.target.value,
                        }))
                      }
                    />
                    {measureErrors.actualWeight && (
                      <p className="text-xs text-destructive">
                        {measureErrors.actualWeight}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="length">D\u00e0i (cm)</Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={measureForm.length}
                      onChange={(e) =>
                        setMeasureForm((f) => ({
                          ...f,
                          length: e.target.value,
                        }))
                      }
                    />
                    {measureErrors.length && (
                      <p className="text-xs text-destructive">
                        {measureErrors.length}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="width">R\u1ed9ng (cm)</Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={measureForm.width}
                      onChange={(e) =>
                        setMeasureForm((f) => ({
                          ...f,
                          width: e.target.value,
                        }))
                      }
                    />
                    {measureErrors.width && (
                      <p className="text-xs text-destructive">
                        {measureErrors.width}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Cao (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={measureForm.height}
                      onChange={(e) =>
                        setMeasureForm((f) => ({
                          ...f,
                          height: e.target.value,
                        }))
                      }
                    />
                    {measureErrors.height && (
                      <p className="text-xs text-destructive">
                        {measureErrors.height}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="measureNote">Ghi ch\u00fa</Label>
                  <Input
                    id="measureNote"
                    placeholder="Ghi ch\u00fa (t\u00f9y ch\u1ecdn)"
                    value={measureForm.note}
                    onChange={(e) =>
                      setMeasureForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleMeasureSubmit}
                    disabled={measureMutation.isPending}
                  >
                    {measureMutation.isPending ? '\u0110ang l\u01b0u...' : 'L\u01b0u'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowMeasureForm(false);
                      setMeasureErrors({});
                    }}
                  >
                    H\u1ee7y
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Card 3: D\u00f2ng th\u1eddi gian ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5" />
            D\u00f2ng th\u1eddi gian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ch\u01b0a c\u00f3 s\u1ef1 ki\u1ec7n n\u00e0o.
            </p>
          ) : (
            <div className="relative space-y-0">
              {timelineEvents.map((event, idx) => (
                <div key={event.label} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Vertical line */}
                  {idx < timelineEvents.length - 1 && (
                    <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
                  )}
                  {/* Dot */}
                  <div className="relative z-10 mt-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 border-primary bg-background" />
                  {/* Content */}
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(event.date)}
                      {event.by && (
                        <span className="ml-2 text-xs">
                          (b\u1edfi {event.by})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
