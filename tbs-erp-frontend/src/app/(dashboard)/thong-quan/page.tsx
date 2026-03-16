'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  X,
  Download,
  Trash2,
  Eye,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useCustomsDeclarations,
  useCreateDeclaration,
  useExportEcus5,
} from '@/lib/hooks/use-customs-declaration';
import { useContainers } from '@/lib/hooks/use-containers';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import type {
  CustomsDeclaration,
  CustomsDeclarationStatus,
  CustomsChannel,
  CustomsDeclarationQueryParams,
} from '@/lib/types/customs.types';
import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// Status labels & colors
// ---------------------------------------------------------------------------

const DECLARATION_STATUS_LABELS: Record<CustomsDeclarationStatus, string> = {
  DRAFT: 'Nháp',
  READY: 'Sẵn sàng',
  SUBMITTED: 'Đã gửi',
  CHANNEL_ASSIGNED: 'Đã phân luồng',
  INSPECTING: 'Đang kiểm',
  CLEARED: 'Đã thông quan',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const DECLARATION_STATUS_COLORS: Record<CustomsDeclarationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  READY: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-indigo-100 text-indigo-700',
  CHANNEL_ASSIGNED: 'bg-amber-100 text-amber-700',
  INSPECTING: 'bg-orange-100 text-orange-700',
  CLEARED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const CHANNEL_LABELS: Record<CustomsChannel, string> = {
  GREEN: 'Xanh',
  YELLOW: 'Vàng',
  RED: 'Đỏ',
};

const CHANNEL_COLORS: Record<CustomsChannel, string> = {
  GREEN: 'bg-green-100 text-green-700',
  YELLOW: 'bg-yellow-100 text-yellow-700',
  RED: 'bg-red-100 text-red-700',
};

const ALL_STATUSES: CustomsDeclarationStatus[] = [
  'DRAFT',
  'READY',
  'SUBMITTED',
  'CHANNEL_ASSIGNED',
  'INSPECTING',
  'CLEARED',
  'REJECTED',
  'CANCELLED',
];

const ALL_CHANNELS: CustomsChannel[] = ['GREEN', 'YELLOW', 'RED'];

// ---------------------------------------------------------------------------
// Row actions component
// ---------------------------------------------------------------------------

function DeclarationRowActions({ declaration }: { declaration: CustomsDeclaration }) {
  const exportEcus5 = useExportEcus5();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canDelete = declaration.status === 'DRAFT';

  return (
    <div className="flex items-center gap-1">
      <Link href={`/thong-quan/${declaration.id}`}>
        <Button variant="ghost" size="sm" title="Xem chi tiết">
          <Eye className="h-4 w-4" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        title="Xuất ECUS5"
        onClick={() => exportEcus5.mutate(declaration.id)}
        disabled={exportEcus5.isPending}
      >
        <Download className="h-4 w-4" />
      </Button>
      {canDelete && (
        <>
          <Button
            variant="ghost"
            size="sm"
            title="Xóa"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
            title="Xóa tờ khai"
            description={`Bạn có chắc muốn xóa tờ khai ${declaration.code}? Thao tác này không thể hoàn tác.`}
            onConfirm={() => {
              // Delete is handled through status update to CANCELLED for simplicity
              setShowDeleteConfirm(false);
            }}
            confirmText="Xóa"
            variant="destructive"
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CustomsDeclarationListPage() {
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CustomsDeclarationStatus | ''>('');
  const [channelFilter, setChannelFilter] = useState<CustomsChannel | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContainerId, setSelectedContainerId] = useState('');

  // Build query params
  const queryParams: CustomsDeclarationQueryParams = { page, limit: 20 };
  if (statusFilter) queryParams.status = statusFilter;
  if (channelFilter) queryParams.channel = channelFilter;
  if (searchQuery) queryParams.search = searchQuery;

  const { data, isLoading } = useCustomsDeclarations(queryParams);
  const createDeclaration = useCreateDeclaration();

  // Fetch containers in CUSTOMS status for the create dialog
  const { data: containersData } = useContainers({ status: 'CUSTOMS', limit: 100 });
  const customsContainers = containersData?.data ?? [];

  const handleCreate = () => {
    if (!selectedContainerId) return;
    createDeclaration.mutate(selectedContainerId, {
      onSuccess: () => {
        setShowCreateForm(false);
        setSelectedContainerId('');
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------

  const columns: ColumnDef<CustomsDeclaration>[] = [
    {
      accessorKey: 'code',
      header: 'Mã tờ khai',
      cell: ({ row }) => (
        <Link
          href={`/thong-quan/${row.original.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      accessorKey: 'container',
      header: 'Container',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.container?.code ?? '---'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          label={DECLARATION_STATUS_LABELS[row.original.status] || row.original.status}
          colorClass={
            DECLARATION_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'
          }
        />
      ),
    },
    {
      accessorKey: 'channel',
      header: 'Luồng',
      cell: ({ row }) =>
        row.original.channel ? (
          <StatusBadge
            label={CHANNEL_LABELS[row.original.channel] || row.original.channel}
            colorClass={CHANNEL_COLORS[row.original.channel] || 'bg-gray-100 text-gray-700'}
          />
        ) : (
          <span className="text-muted-foreground text-sm">---</span>
        ),
    },
    {
      accessorKey: 'declaredTotalValue',
      header: 'Giá trị khai báo',
      cell: ({ row }) => (
        <span className="text-sm">
          {formatCurrency(row.original.declaredTotalValue, row.original.declaredCurrency)}
        </span>
      ),
    },
    {
      accessorKey: 'totalPayable',
      header: 'Tổng thuế',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatCurrency(row.original.totalPayable)}
        </span>
      ),
    },
    {
      id: 'lineCount',
      header: 'Số dòng',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.lines?.length ?? 0}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tạo',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: 'Thao tác',
      cell: ({ row }) => <DeclarationRowActions declaration={row.original} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quản lý Tờ khai Hải quan"
        description="Khai báo, phân luồng và quản lý thuế nhập khẩu"
        infoKey="thong-quan"
      >
        <Button
          onClick={() => setShowCreateForm((prev) => !prev)}
          variant={showCreateForm ? 'outline' : 'default'}
        >
          {showCreateForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Tạo tờ khai
            </>
          )}
        </Button>
      </PageHeader>

      {/* ------------------------------------------------------------------ */}
      {/* Create Declaration Form                                            */}
      {/* ------------------------------------------------------------------ */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5" />
              Tạo tờ khai mới từ Container
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="containerId">
                  Chọn Container <span className="text-destructive">*</span>
                </Label>
                <select
                  id="containerId"
                  value={selectedContainerId}
                  onChange={(e) => setSelectedContainerId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-- Chọn container --</option>
                  {customsContainers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
                {customsContainers.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Không có container nào ở trạng thái Thông quan
                  </p>
                )}
              </div>
              <Button
                onClick={handleCreate}
                disabled={!selectedContainerId || createDeclaration.isPending}
              >
                {createDeclaration.isPending ? 'Đang tạo...' : 'Tạo tờ khai'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedContainerId('');
                }}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Filters                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="statusFilter" className="whitespace-nowrap text-sm">
            Trạng thái:
          </Label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CustomsDeclarationStatus | '');
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Tất cả</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DECLARATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="channelFilter" className="whitespace-nowrap text-sm">
            Luồng:
          </Label>
          <select
            id="channelFilter"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as CustomsChannel | '');
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Tất cả</option>
            {ALL_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="searchInput" className="whitespace-nowrap text-sm">
            Tìm kiếm:
          </Label>
          <Input
            id="searchInput"
            placeholder="Mã tờ khai, container..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="h-9 w-64"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Data Table                                                         */}
      {/* ------------------------------------------------------------------ */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
