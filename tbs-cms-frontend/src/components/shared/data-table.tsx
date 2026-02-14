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

interface DataTableProps {
  columns: ColumnDef<any, any>[];
  data: any[];
  pageCount?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}

export function DataTable({
  columns,
  data,
  pageCount,
  page = 1,
  onPageChange,
  isLoading,
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3.5 text-left font-semibold text-foreground/80 uppercase text-xs tracking-wider"
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
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b transition-all duration-200 hover:bg-muted/40 cursor-pointer"
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

      {pageCount && pageCount > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-medium text-muted-foreground">
            Trang {page} / {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all duration-200',
                page <= 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer',
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all duration-200',
                page >= pageCount
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer',
              )}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
