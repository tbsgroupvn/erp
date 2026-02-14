'use client';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  useInvoices,
  useCreateInvoice,
  useIssueInvoice,
  useCancelInvoice,
} from '@/lib/hooks/use-finance';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnDef } from '@tanstack/react-table';
import type { Invoice, CreateInvoiceDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ISSUED: 'Đã xuất',
  SENT_TAX: 'Đã gửi thuế',
  CANCELLED: 'Đã hủy',
  ADJUSTED: 'Điều chỉnh',
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  SENT_TAX: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ADJUSTED: 'bg-amber-100 text-amber-700',
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  GTGT: 'GTGT',
  DIEU_CHINH: 'Điều chỉnh',
  HUY: 'Hủy',
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ISSUED', label: 'Đã xuất' },
  { value: 'SENT_TAX', label: 'Đã gửi thuế' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'ADJUSTED', label: 'Điều chỉnh' },
];

const INITIAL_FORM_DATA: {
  customerId: string;
  orderId: string;
  type: 'GTGT' | 'DIEU_CHINH' | 'HUY';
  amount: number;
  taxRate: number;
} = {
  customerId: '',
  orderId: '',
  type: 'GTGT',
  amount: 0,
  taxRate: 10,
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function HoaDonPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Queries & mutations
  const { data, isLoading } = useInvoices({
    page,
    limit: 20,
    status: statusFilter !== 'ALL' ? (statusFilter as Invoice['status']) : undefined,
  });
  const createInvoice = useCreateInvoice();
  const issueInvoice = useIssueInvoice();
  const cancelInvoice = useCancelInvoice();

  // Summary counts
  const summaryCards = useMemo(() => {
    const items = data?.data ?? [];
    return {
      draft: items.filter((inv) => inv.status === 'DRAFT').length,
      issued: items.filter((inv) => inv.status === 'ISSUED').length,
      cancelled: items.filter((inv) => inv.status === 'CANCELLED').length,
    };
  }, [data?.data]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreate = () => {
    const dto: CreateInvoiceDto = {
      customerId: formData.customerId,
      orderId: formData.orderId || undefined,
      type: formData.type,
      amount: formData.amount,
      taxRate: formData.taxRate,
    };
    createInvoice.mutate(dto, {
      onSuccess: () => {
        setShowForm(false);
        setFormData(INITIAL_FORM_DATA);
      },
    });
  };

  const handleIssue = (id: string) => {
    issueInvoice.mutate(id);
  };

  const handleCancel = (id: string) => {
    cancelInvoice.mutate(id);
  };

  // ---------------------------------------------------------------------------
  // Table columns (defined inside component to access handlers)
  // ---------------------------------------------------------------------------

  const invoiceColumns: ColumnDef<Invoice>[] = useMemo(() => [
    {
      accessorKey: 'code',
      header: 'Mã hóa đơn',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'customerId',
      header: 'Khách hàng',
    },
    {
      accessorKey: 'type',
      header: 'Loại',
      cell: ({ row }) => (
        <span>{INVOICE_TYPE_LABELS[row.original.type] || row.original.type}</span>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng tiền',
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.original.totalAmount)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          label={
            INVOICE_STATUS_LABELS[row.original.status] || row.original.status
          }
          colorClass={
            INVOICE_STATUS_COLORS[row.original.status] ||
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
      header: 'Thao tác',
      cell: ({ row }) => {
        const { status, id } = row.original;
        return (
          <div className="flex items-center gap-2">
            {status === 'DRAFT' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleIssue(id)}
                disabled={issueInvoice.isPending}
              >
                Phát hành
              </Button>
            )}
            {(status === 'DRAFT' || status === 'ISSUED') && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleCancel(id)}
                disabled={cancelInvoice.isPending}
              >
                Hủy
              </Button>
            )}
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [issueInvoice.isPending, cancelInvoice.isPending]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader title="Hóa đơn" description="Quản lý hóa đơn">
        <Button onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Tạo hóa đơn
            </>
          )}
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng nháp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryCards.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã xuất
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryCards.issued}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã hủy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryCards.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create invoice form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tạo hóa đơn mới</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Customer ID */}
              <div className="space-y-2">
                <Label htmlFor="customerId">Mã khách hàng *</Label>
                <Input
                  id="customerId"
                  placeholder="Nhập mã khách hàng"
                  value={formData.customerId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customerId: e.target.value }))
                  }
                />
              </div>

              {/* Order ID (optional) */}
              <div className="space-y-2">
                <Label htmlFor="orderId">Mã đơn hàng</Label>
                <Input
                  id="orderId"
                  placeholder="Nhập mã đơn hàng (không bắt buộc)"
                  value={formData.orderId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, orderId: e.target.value }))
                  }
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Loại hóa đơn *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value as 'GTGT' | 'DIEU_CHINH' | 'HUY',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại hóa đơn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GTGT">GTGT</SelectItem>
                    <SelectItem value="DIEU_CHINH">Điều chỉnh</SelectItem>
                    <SelectItem value="HUY">Hủy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Số tiền *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      amount: Number(e.target.value),
                    }))
                  }
                />
              </div>

              {/* Tax Rate */}
              <div className="space-y-2">
                <Label htmlFor="taxRate">Thuế suất (%) *</Label>
                <Input
                  id="taxRate"
                  type="number"
                  placeholder="10"
                  value={formData.taxRate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      taxRate: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={createInvoice.isPending || !formData.customerId}
              >
                {createInvoice.isPending ? 'Đang tạo...' : 'Tạo hóa đơn'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormData(INITIAL_FORM_DATA);
                }}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status filter */}
      <div className="mb-4 flex items-center gap-2">
        <Label>Lọc trạng thái:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data table */}
      <DataTable
        columns={invoiceColumns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
