'use client';

import { useRef, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useMetricHistory } from '@/lib/hooks/use-dashboard';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Image as ImageIcon, Download } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MetricChartProps {
  metric: string;
  days: number;
  label: string;
  /** Colour theme for the area fill — defaults to blue */
  colour?: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
  /** Height of the chart in pixels — defaults to 120 */
  height?: number;
  className?: string;
  /** Show export buttons */
  showExport?: boolean;
}

// ---------------------------------------------------------------------------
// Colour tokens
// ---------------------------------------------------------------------------

const COLOUR_MAP = {
  blue:    { stroke: '#3b82f6', fill: '#3b82f620' },
  emerald: { stroke: '#10b981', fill: '#10b98120' },
  amber:   { stroke: '#f59e0b', fill: '#f59e0b20' },
  violet:  { stroke: '#8b5cf6', fill: '#8b5cf620' },
  rose:    { stroke: '#f43f5e', fill: '#f43f5e20' },
};

// ---------------------------------------------------------------------------
// Compact tick formatter — avoids large numbers on axis
// ---------------------------------------------------------------------------

function compactTick(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}tỷ`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}tr`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}k`;
  return `${v}`;
}

// ---------------------------------------------------------------------------
// Tooltip formatter (uses currency for monetary metrics, plain number otherwise)
// ---------------------------------------------------------------------------

const CURRENCY_METRICS = new Set(['revenue', 'ar_outstanding', 'cash_inflow', 'cash_outflow']);

function tooltipFormatter(metric: string) {
  return (value: number) =>
    CURRENCY_METRICS.has(metric) ? formatCurrency(value) : value.toLocaleString('vi-VN');
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportCsv(
  data: { date: string; value: number }[],
  label: string,
  metric: string,
) {
  const header = `Ngay,${label}`;
  const rows = data.map((d) => `${d.date},${d.value}`).join('\n');
  const csv = `${header}\n${rows}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${metric}-export.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportChartPng(containerEl: HTMLElement, filename: string) {
  // Prefer SVG export (no extra dep, always available from recharts)
  const svg = containerEl.querySelector('svg');
  if (svg) {
    // Add white background for clean export
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    clone.insertBefore(rect, clone.firstChild);

    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.png', '.svg');
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  // Fallback: canvas API via offscreen
  const canvas = document.createElement('canvas');
  canvas.width = containerEl.offsetWidth * 2;
  canvas.height = containerEl.offsetHeight * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricChart({
  metric,
  days,
  label,
  colour = 'blue',
  height = 120,
  className,
  showExport = false,
}: MetricChartProps) {
  const { data, isLoading } = useMetricHistory(metric, days);
  const containerRef = useRef<HTMLDivElement>(null);

  const colours = COLOUR_MAP[colour];

  const handleExportPng = useCallback(() => {
    if (containerRef.current) {
      exportChartPng(containerRef.current, `${metric}-chart.png`);
    }
  }, [metric]);

  const handleExportCsv = useCallback(() => {
    if (!data) return;
    exportCsv(data.points, label, metric);
  }, [data, label, metric]);

  if (isLoading) {
    return <Skeleton className={cn('rounded-lg w-full', className)} style={{ height }} />;
  }

  if (!data || data.points.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-muted/30 text-xs text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        Không có dữ liệu
      </div>
    );
  }

  // Format date label — show MM/dd for short periods, dd for very short
  const formatLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (days <= 14) return `${d.getDate()}/${d.getMonth() + 1}`;
    if (days <= 60) return `${d.getDate()}/${d.getMonth() + 1}`;
    return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  };

  // Thin out x-axis ticks to avoid overlap (show ~6 ticks maximum)
  const tickInterval = Math.max(1, Math.floor(data.points.length / 6)) - 1;

  const chartData = data.points.map((pt) => ({
    date: formatLabel(pt.date),
    rawDate: pt.date,
    value: pt.value,
  }));

  return (
    <div className={cn('w-full relative group', className)}>
      {/* Export buttons — appear on hover when showExport=true */}
      {showExport && (
        <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleExportPng}
            title="Xuất PNG"
            className="flex items-center gap-1 px-2 py-1 rounded bg-background/90 border text-xs text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-sm"
          >
            <ImageIcon className="h-3 w-3" />
            PNG
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            title="Xuất CSV"
            className="flex items-center gap-1 px-2 py-1 rounded bg-background/90 border text-xs text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-sm"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      )}

      <div ref={containerRef} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colours.stroke} stopOpacity={0.18} />
                <stop offset="95%" stopColor={colours.stroke} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-muted/50"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              tickFormatter={compactTick}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip
              formatter={tooltipFormatter(metric)}
              labelFormatter={(lbl) => `${label}: ${lbl}`}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={label}
              stroke={colours.stroke}
              strokeWidth={2}
              fill={`url(#grad-${metric})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: colours.stroke }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
