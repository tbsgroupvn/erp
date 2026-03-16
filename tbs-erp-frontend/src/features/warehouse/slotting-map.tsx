'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, Info, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BinInfo {
  code: string;
  status: 'empty' | 'occupied' | 'near_full' | 'inactive';
  packageCode?: string;
  weightKg?: number;
  abcClass?: 'A' | 'B' | 'C';
  occupiedPct?: number;
}

export interface AisleInfo {
  aisleId: string;
  bins: BinInfo[];
}

export interface ZoneInfo {
  zoneId: string;
  label: string;
  aisles: AisleInfo[];
}

export interface SlottingMapData {
  zones: ZoneInfo[];
  stats: {
    totalBins: number;
    occupiedBins: number;
    emptyBins: number;
    nearFullBins: number;
    inactiveBins: number;
    utilizationPct: number;
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchSlottingMap(): Promise<SlottingMapData> {
  const res = await apiClient.get<BaseResponse<SlottingMapData>>('/warehouse-cn/slotting/map');
  return res.data.data!;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const BIN_COLOR: Record<BinInfo['status'], string> = {
  empty: 'bg-emerald-400 hover:bg-emerald-500 border-emerald-500',
  occupied: 'bg-red-400 hover:bg-red-500 border-red-500',
  near_full: 'bg-amber-400 hover:bg-amber-500 border-amber-500',
  inactive: 'bg-zinc-300 hover:bg-zinc-400 border-zinc-400 dark:bg-zinc-600 dark:border-zinc-500',
};

const BIN_LABEL: Record<BinInfo['status'], string> = {
  empty: 'Trống',
  occupied: 'Đầy',
  near_full: 'Gần đầy',
  inactive: 'Không sử dụng',
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

interface BinDetailPanelProps {
  bin: BinInfo;
  zoneId: string;
  aisleId: string;
  onClose: () => void;
}

function BinDetailPanel({ bin, zoneId, aisleId, onClose }: BinDetailPanelProps) {
  return (
    <div className="absolute right-0 top-0 z-20 w-64 rounded-lg border bg-card shadow-lg p-4 text-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-1.5">
          <Package className="h-4 w-4 text-primary" />
          Ô {bin.code}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vị trí:</span>
          <span className="font-medium">Zone {zoneId} / Lối {aisleId} / Ô {bin.code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Trạng thái:</span>
          <span className="font-medium">{BIN_LABEL[bin.status]}</span>
        </div>
        {bin.packageCode && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mã kiện:</span>
            <span className="font-medium font-mono">{bin.packageCode}</span>
          </div>
        )}
        {bin.weightKg != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cân nặng:</span>
            <span className="font-medium">{bin.weightKg.toFixed(2)} kg</span>
          </div>
        )}
        {bin.occupiedPct != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đầy:</span>
            <span className="font-medium">{bin.occupiedPct}%</span>
          </div>
        )}
        {bin.abcClass && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ABC class:</span>
            <span className={`font-semibold ${bin.abcClass === 'A' ? 'text-emerald-600' : bin.abcClass === 'B' ? 'text-amber-600' : 'text-zinc-500'}`}>
              {bin.abcClass}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip (for hover)
// ---------------------------------------------------------------------------

interface BinTooltipProps {
  bin: BinInfo;
}

function BinTooltip({ bin }: BinTooltipProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 w-44 rounded-md border bg-popover shadow-md p-2 text-xs pointer-events-none">
      <p className="font-semibold mb-0.5">{bin.code}</p>
      <p className="text-muted-foreground">{BIN_LABEL[bin.status]}</p>
      {bin.packageCode && <p className="font-mono mt-0.5">{bin.packageCode}</p>}
      {bin.weightKg != null && <p>{bin.weightKg.toFixed(2)} kg</p>}
      {bin.abcClass && <p>ABC: {bin.abcClass}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bin cell
// ---------------------------------------------------------------------------

interface BinCellProps {
  bin: BinInfo;
  onClick: (bin: BinInfo) => void;
}

function BinCell({ bin, onClick }: BinCellProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className={`h-10 w-10 rounded border-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${BIN_COLOR[bin.status]}`}
        title={bin.code}
        onClick={() => onClick(bin)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Ô ${bin.code}: ${BIN_LABEL[bin.status]}`}
      >
        <span className="sr-only">{bin.code}</span>
      </button>
      {hovered && <BinTooltip bin={bin} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SlottingMap() {
  const { data, isLoading, error } = useQuery<SlottingMapData>({
    queryKey: ['slotting-map'],
    queryFn: fetchSlottingMap,
    staleTime: 60_000,
  });

  const [selectedBin, setSelectedBin] = React.useState<{
    bin: BinInfo;
    zoneId: string;
    aisleId: string;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Info className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Không thể tải sơ đồ kho. Vui lòng thử lại.</p>
      </div>
    );
  }

  const { zones, stats } = data;

  return (
    <div className="space-y-5">
      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'Tổng ô', value: stats.totalBins, color: 'text-foreground' },
          { label: 'Trống', value: stats.emptyBins, color: 'text-emerald-600' },
          { label: 'Đầy', value: stats.occupiedBins, color: 'text-red-500' },
          { label: 'Gần đầy', value: stats.nearFullBins, color: 'text-amber-600' },
          { label: 'Không dùng', value: stats.inactiveBins, color: 'text-zinc-400' },
          { label: 'Sử dụng', value: `${stats.utilizationPct}%`, color: 'text-primary' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {(Object.keys(BIN_COLOR) as BinInfo['status'][]).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-4 w-4 rounded border-2 ${BIN_COLOR[status]}`} />
            <span className="text-muted-foreground">{BIN_LABEL[status]}</span>
          </div>
        ))}
      </div>

      {/* Zone grid */}
      <div className="relative space-y-6">
        {zones.map((zone) => (
          <div key={zone.zoneId} className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold">
                {zone.zoneId}
              </span>
              Khu {zone.label}
            </h3>
            <div className="space-y-2">
              {zone.aisles.map((aisle) => (
                <div key={aisle.aisleId} className="flex items-center gap-2">
                  <span className="w-12 text-right text-xs text-muted-foreground shrink-0">
                    Lối {aisle.aisleId}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {aisle.bins.map((bin) => (
                      <BinCell
                        key={bin.code}
                        bin={bin}
                        onClick={(b) =>
                          setSelectedBin({ bin: b, zoneId: zone.zoneId, aisleId: aisle.aisleId })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Detail panel */}
        {selectedBin && (
          <div className="relative">
            <BinDetailPanel
              bin={selectedBin.bin}
              zoneId={selectedBin.zoneId}
              aisleId={selectedBin.aisleId}
              onClose={() => setSelectedBin(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
