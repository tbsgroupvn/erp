'use client';

import { useState, Fragment } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { OrderFilters } from '@/features/orders/order-filters';
import { masterOrderColumns } from '@/features/orders/order-table-columns';
import { useMasterOrders } from '@/lib/hooks/use-orders';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
} from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import type { MasterOrderQueryParams, MasterOrder, Order, OrderStatus, ServiceType, ClearanceType } from '@/lib/types';

export default function DonHangPage() {
  const [filters, setFilters] = useState<MasterOrderQueryParams>({});
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMasterOrders({ ...filters, page, limit: 20 });

  const table = useReactTable({
    data: data?.data ?? [],
    columns: masterOrderColumns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const pageCount = data?.meta?.totalPages ?? 0;

  return (
    <div>
      <PageHeader title="Đơn hàng" description="Quản lý đơn hàng">
        <Button variant="outline" asChild>
          <Link href="/don-hang/nhap-excel" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Nhập Excel
          </Link>
        </Button>
        <Button asChild>
          <Link href="/don-hang/tao-moi" className="gap-2">
            <Plus className="h-4 w-4" />
            Tạo đơn hàng
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <OrderFilters onFilterChange={(f) => { setFilters(f as MasterOrderQueryParams); setPage(1); }} />

        <div className="space-y-4">
          <div className="rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left font-medium text-muted-foreground"
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
                    <td colSpan={masterOrderColumns.length} className="py-10 text-center text-muted-foreground">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={masterOrderColumns.length} className="py-10 text-center text-muted-foreground">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {/* Expanded sub orders */}
                      {row.getIsExpanded() && row.original.subOrders && (
                        <tr>
                          <td colSpan={masterOrderColumns.length} className="p-0">
                            <div className="bg-muted/30 px-8 py-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                                Đơn con ({row.original.subOrders.length})
                              </p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Mã đơn con</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Loại DV</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Thông quan</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Trạng thái</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tổng tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.original.subOrders.map((subOrder: Order) => (
                                    <tr key={subOrder.id} className="border-b last:border-0 hover:bg-muted/30">
                                      <td className="px-3 py-2">
                                        <span className="font-medium">{subOrder.code}</span>
                                      </td>
                                      <td className="px-3 py-2">
                                        <StatusBadge
                                          label={SERVICE_TYPE_LABELS[subOrder.serviceType as ServiceType] || subOrder.serviceType}
                                          colorClass="bg-blue-50 text-blue-700"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <StatusBadge
                                          label={CLEARANCE_TYPE_LABELS[subOrder.clearanceType as ClearanceType] || subOrder.clearanceType}
                                          colorClass={CLEARANCE_TYPE_COLORS[subOrder.clearanceType as ClearanceType] || 'bg-gray-100 text-gray-700'}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <StatusBadge
                                          label={ORDER_STATUS_LABELS[subOrder.status as OrderStatus] || subOrder.status}
                                          colorClass={ORDER_STATUS_COLORS[subOrder.status as OrderStatus] || 'bg-gray-100 text-gray-700'}
                                        />
                                      </td>
                                      <td className="px-3 py-2 font-medium">
                                        {formatCurrency(subOrder.totalAmount, subOrder.currency)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {page} / {pageCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm',
                    page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent',
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pageCount}
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm',
                    page >= pageCount ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent',
                  )}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
