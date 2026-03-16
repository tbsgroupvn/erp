'use client';

import { useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useVasReport } from '@/lib/hooks/use-finance';
import { vasApi } from '@/lib/api/finance.api';
import type { VasReportType, VasReportLine } from '@/lib/api/finance.api';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TABS: { value: VasReportType; label: string }[] = [
  { value: 'B01', label: 'Bảng cân đối kế toán' },
  { value: 'B02', label: 'Kết quả kinh doanh' },
  { value: 'B03', label: 'Lưu chuyển tiền tệ' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function firstDayOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface ReportRowProps {
  line: VasReportLine;
  showPrev: boolean;
}

function ReportRow({ line, showPrev }: ReportRowProps) {
  const indent = line.indentLevel * 16;

  const rowClass = cn(
    'border-b last:border-0 transition-colors',
    line.isTotal
      ? 'bg-blue-50 font-semibold text-blue-900 hover:bg-blue-100'
      : line.isGroup
      ? 'bg-muted/50 font-medium hover:bg-muted'
      : 'hover:bg-muted/30',
  );

  return (
    <tr className={rowClass}>
      <td className="py-2 px-3 text-xs font-mono text-muted-foreground w-24">{line.code}</td>
      <td className="py-2 px-3 text-sm" style={{ paddingLeft: `${indent + 12}px` }}>
        {line.name}
      </td>
      <td className="py-2 px-3 text-right text-sm tabular-nums">
        {line.isGroup ? '' : formatVnd(line.currentPeriod)}
      </td>
      {showPrev && (
        <td className="py-2 px-3 text-right text-sm tabular-nums text-muted-foreground">
          {line.isGroup || line.previousPeriod == null ? '' : formatVnd(line.previousPeriod)}
        </td>
      )}
      <td className="py-2 px-3 text-xs text-muted-foreground">{line.notes ?? ''}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function ReportSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VasReportViewer() {
  const [activeTab, setActiveTab] = useState<VasReportType>('B01');
  const [dateFrom, setDateFrom] = useState(firstDayOfYear());
  const [dateTo, setDateTo] = useState(todayStr());
  const [comparePrevious, setComparePrevious] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isFetching, refetch } = useVasReport(
    { reportType: activeTab, dateFrom, dateTo, comparePrevious },
    true,
  );

  // Export Excel
  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await vasApi.exportExcel({
        reportType: activeTab,
        dateFrom,
        dateTo,
        comparePrevious,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-vas-${activeTab}-${dateFrom}-${dateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Xuất Excel thành công');
    } catch {
      toast.error('Không thể xuất Excel');
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, dateFrom, dateTo, comparePrevious]);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const reportTitle = REPORT_TABS.find((t) => t.value === activeTab)?.label ?? '';

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-background p-1 w-fit">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {tab.value} — {tab.label.split(' ').slice(0, 3).join(' ')}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-background p-4 print:hidden">
        <div className="flex flex-col gap-1">
          <label htmlFor="vas-date-from" className="text-xs font-medium text-muted-foreground">Từ ngày</label>
          <input
            id="vas-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vas-date-to" className="text-xs font-medium text-muted-foreground">Đến ngày</label>
          <input
            id="vas-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Compare previous toggle */}
        <button
          type="button"
          onClick={() => setComparePrevious((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 h-9 rounded-md border text-sm font-medium transition-colors',
            comparePrevious
              ? 'bg-primary/10 border-primary text-primary'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {comparePrevious ? (
            <ToggleRight className="h-4 w-4" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          So sánh kỳ trước
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md border text-sm text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Làm mới
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md border bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Printer className="h-4 w-4" />
            In
          </button>
        </div>
      </div>

      {/* Report table */}
      <div className="rounded-lg border bg-background overflow-hidden">
        {/* Print header */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-base font-semibold">{reportTitle}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kỳ báo cáo: {dateFrom} — {dateTo}
            {data?.generatedAt && (
              <span className="ml-3">
                Xuất lúc: {new Date(data.generatedAt).toLocaleString('vi-VN')}
              </span>
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="p-6">
            <ReportSkeleton />
          </div>
        ) : !data || data.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <ChevronDown className="h-8 w-8 opacity-30" />
            <p>Không có dữ liệu trong kỳ này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 text-left font-medium w-24">Mã TK</th>
                  <th className="py-2.5 px-3 text-left font-medium">Tên khoản mục</th>
                  <th className="py-2.5 px-3 text-right font-medium min-w-[140px]">
                    Kỳ này (VND)
                  </th>
                  {comparePrevious && (
                    <th className="py-2.5 px-3 text-right font-medium min-w-[140px]">
                      Kỳ trước (VND)
                    </th>
                  )}
                  <th className="py-2.5 px-3 text-left font-medium min-w-[80px]">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line, idx) => (
                  <ReportRow key={`${line.code}-${idx}`} line={line} showPrev={comparePrevious} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-friendly styles injected inline */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}
