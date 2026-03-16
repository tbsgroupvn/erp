'use client';

import { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useMyCommissions,
  useTeamCommissions,
  useMonthlyCommissionReport,
  useCalculateCommission,
  useApproveCommission,
  useCommissionRules,
} from '@/lib/hooks/use-commission';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { Commission } from '@/lib/api/commission.api';

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PAID: 'Đã chi',
};

const COMMISSION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PAID: 'bg-blue-100 text-blue-700',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SERVICE_TYPE_LABELS: Record<string, string> = {
  IMPORT: 'Nhập khẩu',
  EXPORT: 'Xuất khẩu',
  DOMESTIC: 'Nội địa',
  TRANSIT: 'Chuyển tiếp',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HoaHongPage() {
  const now = new Date();

  // State
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'my' | 'team'>('my');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showRules, setShowRules] = useState(false);

  // Derived period string e.g. "2026-02"
  const period = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;

  // Data hooks
  const queryParams = useMemo(() => ({ page, limit: 20, period }), [page, period]);

  const {
    data: myData,
    isLoading: isLoadingMy,
  } = useMyCommissions(queryParams);

  const {
    data: teamData,
    isLoading: isLoadingTeam,
  } = useTeamCommissions(queryParams);

  const { data: report } = useMonthlyCommissionReport(period);
  const { data: rules } = useCommissionRules();

  const calculateCommission = useCalculateCommission();
  const approveCommission = useApproveCommission();

  // Select data source based on active view
  const activeData = view === 'my' ? myData : teamData;
  const isLoading = view === 'my' ? isLoadingMy : isLoadingTeam;

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------

  const columns = useMemo<ColumnDef<Commission, any>[]>(
    () => [
      {
        accessorKey: 'employeeName',
        header: 'Nhân viên',
      },
      {
        accessorKey: 'orderCode',
        header: 'Mã đơn hàng',
      },
      {
        accessorKey: 'amount',
        header: 'Doanh số',
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        accessorKey: 'rate',
        header: 'Tỷ lệ (%)',
        cell: ({ getValue }) => `${getValue<number>()}%`,
      },
      {
        accessorKey: 'commissionAmount',
        header: 'Hoa hồng',
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return (
            <StatusBadge
              label={COMMISSION_STATUS_LABELS[status] ?? status}
              colorClass={COMMISSION_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}
            />
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Ngày tạo',
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        cell: ({ row }) => {
          const commission = row.original;
          if (view !== 'team' || commission.status !== 'PENDING') return null;
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={approveCommission.isPending}
              onClick={() => approveCommission.mutate(commission.id)}
            >
              {approveCommission.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Duyệt
            </Button>
          );
        },
      },
    ],
    [view, approveCommission],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader title="Hoa hồng" description="Quản lý hoa hồng nhân viên" infoKey="hoa-hong">
        <Button
          disabled={calculateCommission.isPending}
          onClick={() => calculateCommission.mutate(period)}
        >
          {calculateCommission.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Calculator className="h-4 w-4 mr-2" />
          )}
          Tính hoa hồng
        </Button>
      </PageHeader>

      <div className="space-y-4">
        {/* ---- Period selector ---- */}
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* ---- Summary cards ---- */}
        {report && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng đơn hàng
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.totalOrders}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng doanh số
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(report.totalAmount)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng hoa hồng
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.totalCommission)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Hoa hồng chờ duyệt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(report.pendingCommission)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ---- View toggle ---- */}
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'my' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setView('my');
              setPage(1);
            }}
          >
            Hoa hồng của tôi
          </Button>
          <Button
            variant={view === 'team' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setView('team');
              setPage(1);
            }}
          >
            Hoa hồng nhóm
          </Button>
        </div>

        {/* ---- Commission table ---- */}
        <DataTable
          columns={columns}
          data={activeData?.data ?? []}
          pageCount={activeData?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />

        {/* ---- Commission rules (expandable) ---- */}
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setShowRules((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Quy tắc hoa hồng</CardTitle>
              {showRules ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>

          {showRules && (
            <CardContent>
              {!rules || rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có quy tắc hoa hồng nào.
                </p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Tên quy tắc
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Loại dịch vụ
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Tỷ lệ (%)
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Doanh số tối thiểu
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr
                          key={rule.id}
                          className="border-b last:border-0 transition-colors hover:bg-muted/50"
                        >
                          <td className="px-4 py-3 font-medium">{rule.name}</td>
                          <td className="px-4 py-3">
                            {SERVICE_TYPE_LABELS[rule.serviceType] ?? rule.serviceType}
                          </td>
                          <td className="px-4 py-3">{rule.rate}%</td>
                          <td className="px-4 py-3">
                            {formatCurrency(rule.minAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              label={rule.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                              colorClass={
                                rule.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
