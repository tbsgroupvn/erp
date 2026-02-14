'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useNettingOpportunities,
  useDebtNettingList,
  useCreateDebtNetting,
  useApproveDebtNetting,
  useExecuteDebtNetting,
} from '@/lib/hooks/use-debt-netting';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ApprovalStatus } from '@/lib/types/enums';
import type { ColumnDef } from '@tanstack/react-table';
import type { DebtNetting } from '@/lib/types/finance.types';

const NETTING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Trả lại',
  WITHDRAWN: 'Đã rút',
};

const NETTING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-700',
  RETURNED: 'bg-orange-100 text-orange-700',
  WITHDRAWN: 'bg-gray-100 text-gray-700',
};

export default function BuTruCongNoPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: opportunities, isLoading: isLoadingOpportunities } =
    useNettingOpportunities();

  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      ...(statusFilter !== 'ALL' ? { status: statusFilter as ApprovalStatus } : {}),
    }),
    [page, statusFilter],
  );

  const { data: nettingData, isLoading: isLoadingList } =
    useDebtNettingList(queryParams);

  const createDebtNetting = useCreateDebtNetting();
  const approveDebtNetting = useApproveDebtNetting();
  const executeDebtNetting = useExecuteDebtNetting();

  const columns: ColumnDef<DebtNetting>[] = [
    {
      accessorKey: 'code',
      header: 'Mã',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'partnerName',
      header: 'Đối tác',
    },
    {
      accessorKey: 'arAmount',
      header: 'Công nợ phải thu',
      cell: ({ row }) => (
        <span className="font-medium text-green-600">
          {formatCurrency(row.original.arAmount)}
        </span>
      ),
    },
    {
      accessorKey: 'apAmount',
      header: 'Công nợ phải trả',
      cell: ({ row }) => (
        <span className="font-medium text-red-600">
          {formatCurrency(row.original.apAmount)}
        </span>
      ),
    },
    {
      accessorKey: 'netAmount',
      header: 'Số tiền bù trừ',
      cell: ({ row }) => (
        <span className="font-semibold">
          {formatCurrency(row.original.netAmount)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          label={
            NETTING_STATUS_LABELS[row.original.status] || row.original.status
          }
          colorClass={
            NETTING_STATUS_COLORS[row.original.status] ||
            'bg-gray-100 text-gray-700'
          }
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tạo',
      cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const { id, status } = row.original;

        if (status === 'PENDING') {
          return (
            <Button
              variant="outline"
              size="sm"
              disabled={approveDebtNetting.isPending}
              onClick={() => approveDebtNetting.mutate(id)}
            >
              {approveDebtNetting.isPending ? 'Đang xử lý...' : 'Duyệt'}
            </Button>
          );
        }

        if (status === 'APPROVED') {
          return (
            <Button
              variant="default"
              size="sm"
              disabled={executeDebtNetting.isPending}
              onClick={() => executeDebtNetting.mutate(id)}
            >
              {executeDebtNetting.isPending ? 'Đang xử lý...' : 'Thực hiện'}
            </Button>
          );
        }

        return null;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bù trừ công nợ"
        description="Quản lý bù trừ công nợ phải thu và phải trả"
      />

      {/* Cơ hội bù trừ */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Cơ hội bù trừ</h2>
        {isLoadingOpportunities ? (
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
        ) : !opportunities || opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Không có cơ hội bù trừ nào
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opp) => (
              <Card key={opp.partnerId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{opp.partnerName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phải thu:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(opp.arTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phải trả:</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(opp.apTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">
                        Có thể bù trừ:
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(opp.nettableAmount)}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    size="sm"
                    disabled={createDebtNetting.isPending}
                    onClick={() =>
                      createDebtNetting.mutate({
                        partnerId: opp.partnerId,
                        arIds: [],
                        apIds: [],
                        note: `Bù trừ tự động cho ${opp.partnerName}`,
                      })
                    }
                  >
                    {createDebtNetting.isPending
                      ? 'Đang tạo...'
                      : 'Tạo bù trừ'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Danh sách bù trừ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Danh sách bù trừ</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Trạng thái:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả</option>
              {Object.entries(NETTING_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={nettingData?.data ?? []}
          pageCount={nettingData?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoadingList}
        />
      </div>
    </div>
  );
}
