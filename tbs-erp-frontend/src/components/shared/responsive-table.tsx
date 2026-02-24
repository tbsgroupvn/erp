'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ResponsiveTableColumn<T = Record<string, unknown>> {
  /** Key used to access the data value on each row */
  key: string;
  /** Human-readable column header label */
  label: string;
  /** Optional custom render function for the cell content */
  render?: (value: unknown, row: T, index: number) => ReactNode;
  /** Optional className applied to the <th> and <td> */
  className?: string;
}

interface ResponsiveTableProps<T = Record<string, unknown>> {
  /** Column definitions */
  columns: ResponsiveTableColumn<T>[];
  /** Array of row data objects */
  data: T[];
  /** Optional callback when a row is clicked */
  onRowClick?: (row: T, index: number) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Message shown when data is empty */
  emptyMessage?: string;
  /** Optional className for the outer wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper: get a nested value from an object using a dot-separated key
// ---------------------------------------------------------------------------
function getNestedValue(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ResponsiveTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  emptyMessage = 'Khong co du lieu',
  className,
}: ResponsiveTableProps<T>) {
  // ------- Loading state -------
  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card p-8', className)}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Dang tai du lieu...</p>
        </div>
      </div>
    );
  }

  // ------- Empty state -------
  if (!data || data.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card p-8 text-center', className)}>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // ------- Render a cell value -------
  const renderCell = (col: ResponsiveTableColumn<T>, row: T, rowIndex: number): ReactNode => {
    const rawValue = getNestedValue(row, col.key);
    if (col.render) {
      return col.render(rawValue, row, rowIndex);
    }
    if (rawValue === null || rawValue === undefined) return '---';
    return String(rawValue);
  };

  return (
    <div className={cn(className)}>
      {/* ===== Desktop Table (md and above) ===== */}
      <div className="hidden md:block overflow-x-auto">
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3.5 text-left font-semibold text-foreground/80 uppercase text-xs tracking-wider',
                      col.className,
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={cn(
                    'border-b transition-all duration-200 hover:bg-muted/40',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={() => onRowClick?.(row, rowIndex)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3.5', col.className)}>
                      {renderCell(col, row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Mobile Cards (below md) ===== */}
      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              'rounded-lg border bg-card p-4 shadow-sm space-y-2',
              onRowClick && 'cursor-pointer active:bg-muted/40',
            )}
            onClick={() => onRowClick?.(row, rowIndex)}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowClick(row, rowIndex);
              }
            }}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {col.label}
                </span>
                <span className="text-sm text-right">{renderCell(col, row, rowIndex)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
