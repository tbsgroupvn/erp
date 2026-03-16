'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, Check, Ban, Loader2, DollarSign } from 'lucide-react';
import { InfoTooltip } from '@/components/shared/info-tooltip';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { UserRole, Currency } from '@/lib/types/enums';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtraCharge {
  id: string;
  orderId: string;
  chargeType: string;
  amount: number;
  currency: Currency;
  description: string | null;
  imageUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  createdByUser?: { fullName: string };
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedReason: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHARGE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const CHARGE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const CHARGE_TYPE_OPTIONS = [
  { value: 'STORAGE_FEE', label: 'Phí lưu kho' },
  { value: 'REPACKAGING', label: 'Phí đóng gói lại' },
  { value: 'INSURANCE', label: 'Bảo hiểm' },
  { value: 'CUSTOMS_SURCHARGE', label: 'Phụ phí thông quan' },
  { value: 'OVERWEIGHT', label: 'Phụ phí quá cân' },
  { value: 'SPECIAL_HANDLING', label: 'Xử lý đặc biệt' },
  { value: 'DAMAGE_COMPENSATION', label: 'Bồi thường hư hỏng' },
  { value: 'OTHER', label: 'Khác' },
];

const CHARGE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CHARGE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

// Roles that can approve/reject charges
const APPROVER_ROLES = new Set([
  UserRole.CEO,
  UserRole.COO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.ACCOUNTANT_AR,
  UserRole.WAREHOUSE_VN_MANAGER,
  UserRole.XNK_MANAGER,
]);

// ---------------------------------------------------------------------------
// API hooks
// ---------------------------------------------------------------------------

function useExtraCharges(orderId: string) {
  return useQuery({
    queryKey: ['extra-charges', orderId],
    queryFn: () =>
      apiClient
        .get<BaseResponse<ExtraCharge[]>>(`/orders/${encodeURIComponent(orderId)}/extra-charges`)
        .then((r) => r.data.data),
    enabled: !!orderId,
  });
}

function useCreateExtraCharge(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      chargeType: string;
      amount: number;
      currency: Currency;
      description?: string;
      imageUrl?: string;
    }) =>
      apiClient
        .post<BaseResponse<ExtraCharge>>(
          `/orders/${encodeURIComponent(orderId)}/extra-charges`,
          data,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extra-charges', orderId] });
      toast.success('Thêm phụ phí thành công');
    },
    onError: () => {
      toast.error('Không thể thêm phụ phí');
    },
  });
}

function useApproveExtraCharge(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chargeId: string) =>
      apiClient
        .patch<BaseResponse<ExtraCharge>>(
          `/orders/${encodeURIComponent(orderId)}/extra-charges/${encodeURIComponent(chargeId)}/approve`,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extra-charges', orderId] });
      toast.success('Đã duyệt phụ phí');
    },
    onError: () => {
      toast.error('Không thể duyệt phụ phí');
    },
  });
}

function useRejectExtraCharge(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chargeId, reason }: { chargeId: string; reason: string }) =>
      apiClient
        .patch<BaseResponse<ExtraCharge>>(
          `/orders/${encodeURIComponent(orderId)}/extra-charges/${encodeURIComponent(chargeId)}/reject`,
          { reason },
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extra-charges', orderId] });
      toast.success('Đã từ chối phụ phí');
    },
    onError: () => {
      toast.error('Không thể từ chối phụ phí');
    },
  });
}

// ---------------------------------------------------------------------------
// Add Charge Dialog
// ---------------------------------------------------------------------------

function AddChargeDialog({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const [chargeType, setChargeType] = useState('OTHER');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.VND);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const createMutation = useCreateExtraCharge(orderId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    createMutation.mutate(
      {
        chargeType,
        amount: parsedAmount,
        currency,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Thêm phụ phí</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="charge-type">Loại phụ phí *</Label>
                <select
                  id="charge-type"
                  value={chargeType}
                  onChange={(e) => setChargeType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CHARGE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-amount">Số tiền *</Label>
                <Input
                  id="charge-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-currency">Loại tiền</Label>
                <select
                  id="charge-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="VND">VND</option>
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="charge-image">URL hình ảnh</Label>
                <Input
                  id="charge-image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-description">Mô tả</Label>
              <Input
                id="charge-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chi tiết phụ phí"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Thêm phụ phí
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function OrderExtraCharges({
  orderId,
  orderCode,
}: {
  orderId: string;
  orderCode: string;
}) {
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role ? APPROVER_ROLES.has(user.role as UserRole) : false;

  const { data: charges, isLoading } = useExtraCharges(orderId);
  const approveMutation = useApproveExtraCharge(orderId);
  const rejectMutation = useRejectExtraCharge(orderId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = useCallback(
    (chargeId: string) => {
      if (!rejectReason.trim()) {
        toast.error('Vui lòng nhập lý do từ chối');
        return;
      }
      rejectMutation.mutate(
        { chargeId, reason: rejectReason.trim() },
        {
          onSuccess: () => {
            setRejectingId(null);
            setRejectReason('');
          },
        },
      );
    },
    [rejectReason, rejectMutation],
  );

  if (isLoading) return null;
  if (!charges || charges.length === 0) {
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span>Chưa có phụ phí</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Thêm phụ phí
        </Button>
        {showAddForm && (
          <AddChargeDialog orderId={orderId} onClose={() => setShowAddForm(false)} />
        )}
      </div>
    );
  }

  const totalApproved = charges
    .filter((c) => c.status === 'APPROVED')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Phụ phí ({charges.length})
          <InfoTooltip
            tip={{
              definition: 'Phí phát sinh ngoài cước vận chuyển chính: lưu kho, đóng gói lại, bảo hiểm, quá cân, thông quan...',
              howTo: 'Bấm "Thêm phụ phí" → chọn loại → nhập số tiền + mô tả → Gửi duyệt. Phụ phí được duyệt mới tính vào tổng đơn.',
            }}
          />
          {totalApproved > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              Tổng duyệt: {formatCurrency(totalApproved)}
            </span>
          )}
        </h4>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Thêm phụ phí
        </Button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Loại</th>
              <th className="pb-2 pr-3 font-medium text-right">Số tiền</th>
              <th className="pb-2 pr-3 font-medium">Mô tả</th>
              <th className="pb-2 pr-3 font-medium">Trạng thái</th>
              <th className="pb-2 pr-3 font-medium">Người tạo</th>
              {canApprove && <th className="pb-2 font-medium">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => (
              <tr key={charge.id} className="border-b">
                <td className="py-2 pr-3">
                  {CHARGE_TYPE_LABELS[charge.chargeType] || charge.chargeType}
                </td>
                <td className="py-2 pr-3 text-right font-medium">
                  {formatCurrency(charge.amount, charge.currency)}
                </td>
                <td className="py-2 pr-3 max-w-[200px] truncate">
                  {charge.description || '---'}
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge
                    label={CHARGE_STATUS_LABELS[charge.status] || charge.status}
                    colorClass={CHARGE_STATUS_COLORS[charge.status] || 'bg-gray-100 text-gray-700'}
                  />
                </td>
                <td className="py-2 pr-3 text-xs">
                  {charge.createdByUser?.fullName || charge.createdBy}
                  <br />
                  <span className="text-muted-foreground">{formatDate(charge.createdAt)}</span>
                </td>
                {canApprove && (
                  <td className="py-2">
                    {charge.status === 'PENDING' && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => approveMutation.mutate(charge.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Duyệt
                        </Button>
                        {rejectingId === charge.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Lý do từ chối"
                              className="h-7 text-xs w-32"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => handleReject(charge.id)}
                              disabled={rejectMutation.isPending}
                            >
                              OK
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setRejectingId(charge.id)}
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" />
                            Từ chối
                          </Button>
                        )}
                      </div>
                    )}
                    {charge.status === 'REJECTED' && charge.rejectedReason && (
                      <span className="text-xs text-muted-foreground">
                        Lý do: {charge.rejectedReason}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddForm && (
        <AddChargeDialog orderId={orderId} onClose={() => setShowAddForm(false)} />
      )}
    </div>
  );
}
