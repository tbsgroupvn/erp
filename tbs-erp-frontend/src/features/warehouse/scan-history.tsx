'use client';

import * as React from 'react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Download,
  Calendar,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanHistoryEntry {
  id: string;
  trackingNumber: string;
  scannedAt: string;
  result: 'found' | 'not_found';
  packageCode?: string;
  scannedByName?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchScanHistory(params: {
  from: string;
  to: string;
  search?: string;
}): Promise<ScanHistoryEntry[]> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.search) query.set('search', params.search);
  const res = await apiClient.get<BaseResponse<ScanHistoryEntry[]>>(
    `/warehouse-cn/scan-history?${query.toString()}`,
  );
  return res.data.data ?? [];
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportCsv(entries: ScanHistoryEntry[]) {
  const header = ['Mã vận đơn', 'Thời gian quét', 'Kết quả', 'Mã kiện', 'Người quét'];
  const rows = entries.map((e) => [
    e.trackingNumber,
    format(new Date(e.scannedAt), 'dd/MM/yyyy HH:mm:ss', { locale: vi }),
    e.result === 'found' ? 'Tìm thấy' : 'Không tìm thấy',
    e.packageCode ?? '',
    e.scannedByName ?? '',
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lich-su-quet-${format(new Date(), 'yyyyMMdd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type DateRange = '0' | '1' | '3' | '7' | '30';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '0', label: 'Hôm nay' },
  { value: '1', label: 'Hôm qua' },
  { value: '3', label: '3 ngày qua' },
  { value: '7', label: '7 ngày qua' },
  { value: '30', label: '30 ngày qua' },
];

function getRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const days = parseInt(range, 10);
  const from = startOfDay(subDays(now, days));
  const to = endOfDay(now);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function ScanHistory() {
  const [dateRange, setDateRange] = React.useState<DateRange>('0');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { from, to } = getRange(dateRange);

  const { data: entries = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['scan-history', from, to, debouncedSearch],
    queryFn: () => fetchScanHistory({ from, to, search: debouncedSearch || undefined }),
    staleTime: 30_000,
  });

  const foundCount = entries.filter((e) => e.result === 'found').length;
  const notFoundCount = entries.filter((e) => e.result === 'not_found').length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm mã vận đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Làm mới"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => exportCsv(entries)}
          disabled={entries.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Xuất CSV
        </Button>
      </div>

      {/* Summary badges */}
      {!isLoading && entries.length > 0 && (
        <div className="flex gap-3 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            Tổng: <strong>{entries.length}</strong>
          </span>
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <strong>{foundCount}</strong> tìm thấy
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <XCircle className="h-3.5 w-3.5" />
            <strong>{notFoundCount}</strong> không tìm thấy
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Kết quả</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Mã vận đơn</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Mã kiện</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Thời gian quét</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Người quét</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Không có lịch sử quét trong khoảng thời gian này
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      {entry.result === 'found' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Tìm thấy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                          <XCircle className="h-3.5 w-3.5" />
                          Không thấy
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.trackingNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                      {entry.packageCode ?? '---'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(entry.scannedAt), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {entry.scannedByName ?? '---'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
