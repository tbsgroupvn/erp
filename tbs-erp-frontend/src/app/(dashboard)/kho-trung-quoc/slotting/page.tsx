'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Flame, Lightbulb, ArrowRight, Package } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import type { BaseResponse } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

const SlottingMap = dynamic(
  () => import('@/features/warehouse/slotting-map').then((m) => ({ default: m.SlottingMap })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> },
);
const SlottingHeatmap = dynamic(
  () => import('@/features/warehouse/slotting-heatmap').then((m) => ({ default: m.SlottingHeatmap })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> },
);

// ---------------------------------------------------------------------------
// Suggestion types
// ---------------------------------------------------------------------------

interface SlottingSuggestion {
  id: string;
  packageCode: string;
  currentBin?: string;
  suggestedBin: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedSavingPct?: number;
}

async function fetchSuggestions(): Promise<SlottingSuggestion[]> {
  const res = await apiClient.get<BaseResponse<SlottingSuggestion[]>>(
    '/warehouse-cn/slotting/suggestions',
  );
  return res.data.data ?? [];
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabKey = 'map' | 'heatmap' | 'suggestions';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'map', label: 'Sơ đồ kho', icon: LayoutGrid },
  { key: 'heatmap', label: 'Heat map', icon: Flame },
  { key: 'suggestions', label: 'Gợi ý tối ưu', icon: Lightbulb },
];

const PRIORITY_CFG = {
  HIGH: { label: 'Cao', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  MEDIUM: { label: 'TB', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  LOW: { label: 'Thấp', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

// ---------------------------------------------------------------------------
// Suggestions tab content
// ---------------------------------------------------------------------------

function SuggestionsContent() {
  const { data = [], isLoading, error } = useQuery<SlottingSuggestion[]>({
    queryKey: ['slotting-suggestions'],
    queryFn: fetchSuggestions,
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Không thể tải gợi ý. Vui lòng thử lại.
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Lightbulb className="h-10 w-10 text-amber-400" />
        <p className="font-medium">Không có gợi ý tối ưu nào</p>
        <p className="text-sm text-muted-foreground">Cấu trúc kho hiện tại đã được tối ưu hóa tốt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.length} gợi ý tối ưu hóa vị trí</p>
      {data.map((s) => {
        const pri = PRIORITY_CFG[s.priority];
        return (
          <div key={s.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold font-mono text-sm">{s.packageCode}</span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      pri.className,
                    )}
                  >
                    {pri.label}
                  </span>
                  {s.estimatedSavingPct != null && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      -{s.estimatedSavingPct}% di chuyển
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                  {s.currentBin ? (
                    <>
                      <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5">{s.currentBin}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </>
                  ) : (
                    <span className="text-xs">Chưa có vị trí</span>
                  )}
                  <span className="font-mono text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5 border border-emerald-200 dark:border-emerald-700">
                    {s.suggestedBin}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.reason}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SlottingPage() {
  const [activeTab, setActiveTab] = React.useState<TabKey>('map');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sơ đồ kho Trung Quốc"
        description="Quản lý vị trí và tối ưu hóa không gian kho"
        infoKey="slotting"
      />

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'map' && <SlottingMap />}
      {activeTab === 'heatmap' && <SlottingHeatmap />}
      {activeTab === 'suggestions' && <SuggestionsContent />}
    </div>
  );
}
