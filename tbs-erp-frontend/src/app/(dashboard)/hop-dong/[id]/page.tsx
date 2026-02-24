'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useContract, useUpdateContractStatus, useDeleteContract } from '@/lib/hooks/use-contracts';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_COLORS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ContractStatus, ContractType } from '@/lib/types';
import type { Contract } from '@/lib/types';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useState } from 'react';

/** Valid next statuses for each current status */
const STATUS_ACTIONS: Partial<Record<ContractStatus, { label: string; status: ContractStatus; variant: string }[]>> = {
  [ContractStatus.DRAFT]: [
    { label: 'Gửi ký', status: ContractStatus.PENDING_SIGNATURE, variant: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
    { label: 'Hủy', status: ContractStatus.CANCELLED, variant: 'border border-destructive text-destructive hover:bg-destructive/10' },
  ],
  [ContractStatus.PENDING_SIGNATURE]: [
    { label: 'Xác nhận đã ký', status: ContractStatus.SIGNED, variant: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Trả về nháp', status: ContractStatus.DRAFT, variant: 'border hover:bg-accent' },
  ],
  [ContractStatus.SIGNED]: [
    { label: 'Kích hoạt', status: ContractStatus.ACTIVE, variant: 'bg-green-600 hover:bg-green-700 text-white' },
  ],
  [ContractStatus.ACTIVE]: [
    { label: 'Thanh lý', status: ContractStatus.SETTLED, variant: 'bg-orange-600 hover:bg-orange-700 text-white' },
    { label: 'Tạm dừng', status: ContractStatus.SUSPENDED, variant: 'border border-purple-600 text-purple-600 hover:bg-purple-50' },
    { label: 'Hoàn thành', status: ContractStatus.COMPLETED, variant: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  ],
  [ContractStatus.SUSPENDED]: [
    { label: 'Kích hoạt lại', status: ContractStatus.ACTIVE, variant: 'bg-green-600 hover:bg-green-700 text-white' },
    { label: 'Hủy', status: ContractStatus.CANCELLED, variant: 'border border-destructive text-destructive hover:bg-destructive/10' },
  ],
  [ContractStatus.SETTLED]: [
    { label: 'Hoàn thành', status: ContractStatus.COMPLETED, variant: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  ],
};

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: contract, isLoading } = useContract(id);
  const updateStatus = useUpdateContractStatus();
  const deleteContract = useDeleteContract();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!contract) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy hợp đồng</p>
        <Link href="/hop-dong" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const c = contract as Contract;
  const status = c.status as ContractStatus;
  const actions = STATUS_ACTIONS[status] ?? [];

  const handleStatusChange = (newStatus: ContractStatus) => {
    updateStatus.mutate(
      { id, status: newStatus },
      {
        onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái'),
      },
    );
  };

  const handleDelete = () => {
    deleteContract.mutate(id, {
      onSuccess: () => router.push('/hop-dong'),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/hop-dong" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.code}</h1>
            <StatusBadge
              label={CONTRACT_STATUS_LABELS[status] || status}
              colorClass={CONTRACT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
            <StatusBadge
              label={CONTRACT_TYPE_LABELS[c.type as ContractType] || c.type}
              colorClass={CONTRACT_TYPE_COLORS[c.type as ContractType] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {c.title} &mdash; Tạo lúc {formatDate(c.createdAt)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.status}
            onClick={() => handleStatusChange(action.status)}
            disabled={updateStatus.isPending}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${action.variant}`}
          >
            {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {action.label}
          </button>
        ))}
        {status === 'DRAFT' && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Xóa
          </button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contract Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin hợp đồng</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mã hợp đồng</dt>
              <dd className="font-medium">{c.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại</dt>
              <dd>{CONTRACT_TYPE_LABELS[c.type as ContractType] || c.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày hiệu lực</dt>
              <dd>{formatDate(c.effectiveDate, 'dd/MM/yyyy')}</dd>
            </div>
            {c.expiryDate && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ngày hết hạn</dt>
                <dd>{formatDate(c.expiryDate, 'dd/MM/yyyy')}</dd>
              </div>
            )}
            {c.signedDate && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ngày ký</dt>
                <dd>{formatDate(c.signedDate, 'dd/MM/yyyy')}</dd>
              </div>
            )}
            {c.note && (
              <div>
                <dt className="text-muted-foreground mb-1">Ghi chú</dt>
                <dd>{c.note}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Customer Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Khách hàng</h3>
          {c.customer ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mã KH</dt>
                <dd>
                  <Link href={`/khach-hang/${c.customer.id}`} className="text-primary hover:underline">
                    {c.customer.code}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tên</dt>
                <dd>{c.customer.fullName}</dd>
              </div>
              {c.customer.companyName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Công ty</dt>
                  <dd>{c.customer.companyName}</dd>
                </div>
              )}
              {c.customer.phone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Điện thoại</dt>
                  <dd>{c.customer.phone}</dd>
                </div>
              )}
              {c.customer.email && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{c.customer.email}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Không có thông tin</p>
          )}
        </div>

        {/* Financial Summary */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Tài chính</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giá trị hợp đồng</dt>
              <dd className="font-semibold text-base">{formatCurrency(c.totalValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Đặt cọc yêu cầu</dt>
              <dd>{formatCurrency(c.depositRequired)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Đã đặt cọc</dt>
              <dd>{formatCurrency(c.depositPaid)}</dd>
            </div>
            <div className="flex justify-between border-t pt-3">
              <dt className="text-muted-foreground">Đã thanh toán</dt>
              <dd className="font-medium">{formatCurrency(c.totalPaid)}</dd>
            </div>
          </dl>
        </div>

        {/* Links */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Liên kết</h3>
          <dl className="space-y-3 text-sm">
            {c.parent && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hợp đồng chính</dt>
                <dd>
                  <Link href={`/hop-dong/${c.parent.id}`} className="text-primary hover:underline">
                    {c.parent.code} - {c.parent.title}
                  </Link>
                </dd>
              </div>
            )}
            {c.quotation && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Báo giá gốc</dt>
                <dd>
                  <Link href={`/bao-gia/${c.quotation.id}`} className="text-primary hover:underline">
                    {c.quotation.code}
                  </Link>
                </dd>
              </div>
            )}
            {c.sale && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Người phụ trách</dt>
                <dd>{c.sale.fullName}</dd>
              </div>
            )}
            {c._count?.orders !== undefined && c._count.orders > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Đơn hàng liên kết</dt>
                <dd>{c._count.orders} đơn</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Appendixes List */}
      {c.type === ContractType.MASTER && c.appendixes && c.appendixes.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Phụ lục hợp đồng ({c.appendixes.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Mã PL</th>
                  <th className="pb-2 font-medium">Tiêu đề</th>
                  <th className="pb-2 font-medium">Giá trị</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {c.appendixes.map((appendix) => (
                  <tr key={appendix.id} className="border-b">
                    <td className="py-2">
                      <Link href={`/hop-dong/${appendix.id}`} className="text-primary hover:underline font-medium">
                        {appendix.code}
                      </Link>
                    </td>
                    <td className="py-2">{appendix.title}</td>
                    <td className="py-2">{formatCurrency(appendix.totalValue)}</td>
                    <td className="py-2">
                      <StatusBadge
                        label={CONTRACT_STATUS_LABELS[appendix.status as ContractStatus] || appendix.status}
                        colorClass={CONTRACT_STATUS_COLORS[appendix.status as ContractStatus] || 'bg-gray-100 text-gray-700'}
                      />
                    </td>
                    <td className="py-2">{formatDate(appendix.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contract Terms */}
      {c.terms && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Điều khoản hợp đồng</h3>
          <div className="whitespace-pre-wrap text-sm">{c.terms}</div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Xóa hợp đồng"
        description={`Bạn có chắc muốn xóa hợp đồng ${c.code}? Hành động này không thể hoàn tác.`}
        onConfirm={handleDelete}
        confirmText="Xóa"
        variant="destructive"
      />
    </div>
  );
}
