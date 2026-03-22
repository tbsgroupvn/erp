'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/page-loading';
import { NoResults } from '@/components/shared/empty-state';

interface DataTableProps {
  columns: ColumnDef<any, any>[];
  data: any[];
  pageCount?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  onClearFilters?: () => void;
}

export function DataTable({
  columns,
  data,
  pageCount,
  page = 1,
  onPageChange,
  isLoading,
  onClearFilters,
}: DataTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!pageCount,
    pageCount: pageCount ?? -1,
    state: {
      pagination: { pageIndex: page - 1, pageSize: 20 },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={5} columns={columns.length} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Horizontal scroll wrapper for responsive tables */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table role="table" className="w-full min-w-[640px] text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-gradient-to-r from-muted/50 to-muted/20">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    role="columnheader"
                    scope="col"
                    className="px-4 py-3.5 text-left font-semibold text-muted-foreground uppercase text-xs tracking-wider whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <NoResults onAction={onClearFilters} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b transition-all duration-200 hover:bg-muted/40 cursor-pointer animate-fade-in"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {pageCount && pageCount > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-medium text-muted-foreground">
            Trang {page} / {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label={`Trang trước (hiện tại: trang ${page})`}
              aria-disabled={page <= 1}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-all duration-200',
                page <= 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer',
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount}
              aria-label={`Trang sau (hiện tại: trang ${page} / ${pageCount})`}
              aria-disabled={page >= pageCount}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-all duration-200',
                page >= pageCount
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer',
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
