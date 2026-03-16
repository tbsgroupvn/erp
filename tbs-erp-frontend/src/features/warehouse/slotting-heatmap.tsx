'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Thermometer, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeatmapCell {
  zoneId: string;
  aisleId: string;
  binCode: string;
  frequency: number;
  normalizedFrequency: number; // 0.0 – 1.0
}

export interface SlottingHeatmapData {
  cells: HeatmapCell[];
  maxFrequency: number;
  zones: string[];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchSlottingHeatmap(): Promise<SlottingHeatmapData> {
  const res = await apiClient.get<BaseResponse<SlottingHeatmapData>>('/warehouse-cn/slotting/heatmap');
  return res.data.data!;
}

// ---------------------------------------------------------------------------
// Color helper: blue (cold) → red (hot)
// ---------------------------------------------------------------------------

function heatmapColor(normalized: number): string {
  // 0 = blue (#3b82f6), 0.5 = yellow (#f59e0b), 1.0 = red (#ef4444)
  if (normalized < 0.01) return 'bg-zinc-100 dark:bg-zinc-800';
  if (normalized < 0.2) return 'bg-blue-200 dark:bg-blue-900';
  if (normalized < 0.4) return 'bg-cyan-300 dark:bg-cyan-700';
  if (normalized < 0.6) return 'bg-yellow-300 dark:bg-yellow-600';
  if (normalized < 0.8) return 'bg-orange-400 dark:bg-orange-600';
  return 'bg-red-500 dark:bg-red-600';
}

function heatmapBorder(normalized: number): string {
  if (normalized < 0.01) return 'border-zinc-200 dark:border-zinc-700';
  if (normalized < 0.2) return 'border-blue-300';
  if (normalized < 0.4) return 'border-cyan-400';
  if (normalized < 0.6) return 'border-yellow-400';
  if (normalized < 0.8) return 'border-orange-500';
  return 'border-red-600';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlottingHeatmap() {
  const { data, isLoading, error } = useQuery<SlottingHeatmapData>({
    queryKey: ['slotting-heatmap'],
    queryFn: fetchSlottingHeatmap,
    staleTime: 120_000,
  });

  const [hoveredCell, setHoveredCell] = React.useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  // Group cells by zone and aisle — must be called before any early returns (Rules of Hooks)
  const grouped = React.useMemo(() => {
    const map = new Map<string, Map<string, HeatmapCell[]>>();
    for (const cell of data?.cells ?? []) {
      if (!map.has(cell.zoneId)) map.set(cell.zoneId, new Map());
      const zoneMap = map.get(cell.zoneId)!;
      if (!zoneMap.has(cell.aisleId)) zoneMap.set(cell.aisleId, []);
      zoneMap.get(cell.aisleId)!.push(cell);
    }
    return map;
  }, [data?.cells]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Info className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Không thể tải heat map. Vui lòng thử lại.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex items-center gap-3">
        <Thermometer className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Tần suất sử dụng:</span>
        <div className="flex items-center gap-1">
          {['bg-blue-200', 'bg-cyan-300', 'bg-yellow-300', 'bg-orange-400', 'bg-red-500'].map((c, i) => (
            <div key={i} className={`h-4 w-6 ${c} rounded`} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Ít</span>
        <span className="text-xs text-muted-foreground ml-auto">Nhiều</span>
      </div>

      {/* Max frequency info */}
      <p className="text-xs text-muted-foreground">
        Tần suất cao nhất: <strong>{data.maxFrequency}</strong> lần
      </p>

      {/* Heatmap grid */}
      <div className="space-y-6">
        {data.zones.map((zoneId) => {
          const zoneMap = grouped.get(zoneId);
          if (!zoneMap) return null;

          return (
            <div key={zoneId} className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold">
                  {zoneId}
                </span>
                Khu {zoneId}
              </h3>
              <div className="space-y-1.5">
                {Array.from(zoneMap.entries()).map(([aisleId, cells]) => (
                  <div key={aisleId} className="flex items-center gap-2">
                    <span className="w-12 text-right text-xs text-muted-foreground shrink-0">
                      Lối {aisleId}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cells.map((cell) => (
                        <div
                          key={cell.binCode}
                          className={`relative h-10 w-10 rounded border-2 cursor-pointer transition-all ${heatmapColor(cell.normalizedFrequency)} ${heatmapBorder(cell.normalizedFrequency)}`}
                          onMouseEnter={(e) => {
                            setHoveredCell(cell);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          aria-label={`${cell.binCode}: ${cell.frequency} lần`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 rounded-md border bg-popover shadow-md p-2 text-xs pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
        >
          <p className="font-semibold">{hoveredCell.binCode}</p>
          <p className="text-muted-foreground">
            {hoveredCell.frequency} lần ({Math.round(hoveredCell.normalizedFrequency * 100)}%)
          </p>
        </div>
      )}
    </div>
  );
}
