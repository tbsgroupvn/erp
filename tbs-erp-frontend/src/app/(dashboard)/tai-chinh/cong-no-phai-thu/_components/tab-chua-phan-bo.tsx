'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { UserRole, Currency } from '@/lib/types/enums';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import { useAuthStore } from '@/lib/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UnallocatedTransaction {
  id: string;
  walletId: string;
  amount: number;
  currency: Currency;
  type: 'TOPUP' | 'DEDUCT' | 'REFUND';
  reference: string | null;
  note: string | null;
  createdAt: string;
  customer?: {
    id: string;
    fullName: string;
    code: string;
    phone: string;
  };
}

interface ClaimRequest {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  orderId: string | null;
  contractId: string | null;
  evidence: string[];
  note: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  amount: number;
}

interface CustomerOption {
  id: string;
  fullName: string;
  code: string;
}

interface OrderOption {
  id: string;
  code: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
function handleApiError(error: unknown): never {
  console.error('Unallocated funds API error:', (error as Error)?.message || error);
  throw error;
}

const unallocatedApi = {
  listUnallocated: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<UnallocatedTransaction>>('/finance/unallocated', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  searchCustomers: (search: string) =>
    apiClient
      .get<BaseResponse<CustomerOption[]>>('/customers', { params: { search, limit: 10 } })
      .then((r) => r.data.data)
      .catch(handleApiError),

  searchOrders: (customerId: string) =>
    apiClient
      .get<BaseResponse<OrderOption[]>>('/orders', {
        params: { customerId, limit: 50 },
      })
      .then((r) => r.data.data)
      .catch(handleApiError),

  createClaim: (data: {
    transactionId: string;
    customerId: string;
    orderId?: string;
    contractId?: string;
    evidence?: string[];
    note: string;
  }) =>
    apiClient
      .post<BaseResponse<ClaimRequest>>('/finance/unallocated/claim', data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  listClaims: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient
      .get<PaginatedResponse<ClaimRequest>>('/finance/unallocated/claims', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  approveClaim: (id: string) =>
    apiClient
      .patch<BaseResponse<ClaimRequest>>(`/finance/unallocated/claims/${encodeURIComponent(id)}/approve`)
      .then((r) => r.data.data)
      .catch(handleApiError),

  rejectClaim: (id: string, reason?: string) =>
    apiClient
      .patch<BaseResponse<ClaimRequest>>(`/finance/unallocated/claims/${encodeURIComponent(id)}/reject`, { reason })
      .then((r) => r.data.data)
      .catch(handleApiError),
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
const unallocatedKeys = {
  all: ['unallocated'] as const,
  list: (params?: Record<string, unknown>) => [...unallocatedKeys.all, 'list', params] as const,
  claims: (params?: Record<string, unknown>) => [...unallocatedKeys.all, 'claims', params] as const,
};

// ---------------------------------------------------------------------------
// Claim Dialog Component
// ---------------------------------------------------------------------------
function ClaimDialog({
  transaction,
  open,
  onClose,
}: {
  transaction: UnallocatedTransaction | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: () => unallocatedApi.searchCustomers(customerSearch),
    enabled: customerSearch.length >= 2,
  });

  const { data: orders } = useQuery({
    queryKey: ['customer-orders', selectedCustomerId],
    queryFn: () => unallocatedApi.searchOrders(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });

  const createClaim = useMutation({
    mutationFn: unallocatedApi.createClaim,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unallocatedKeys.all });
      toast.success('Đã tạo yêu cầu nhận vô thành công');
      handleClose();
    },
    onError: () => {
      toast.error('Không thể tạo yêu cầu. Vui lòng thử lại.');
    },
  });

  const handleClose = useCallback(() => {
    setCustomerSearch('');
    setSelectedCustomerId('');
    setSelectedOrderId('');
    setNote('');
    setEvidenceUrl('');
    onClose();
  }, [onClose]);

  const handleSubmit = () => {
    if (!transaction || !selectedCustomerId || !note) return;
    createClaim.mutate({
      transactionId: transaction.id,
      customerId: selectedCustomerId,
      orderId: selectedOrderId || undefined,
      evidence: evidenceUrl ? [evidenceUrl] : [],
      note,
    });
  };

  if (!open || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-1">Nhận vô giao dịch</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Số tiền: {formatCurrency(transaction.amount, transaction.currency || Currency.VND)} &middot;{' '}
          {formatDate(transaction.createdAt, 'dd/MM/yyyy HH:mm')}
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Tìm khách hàng *</p>
            <Input
              placeholder="Nhập tên hoặc mã khách hàng..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {customers && customers.length > 0 && !selectedCustomerId && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-0"
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerSearch(`${c.fullName} (${c.code})`);
                    }}
                  >
                    {c.fullName} ({c.code})
                  </button>
                ))}
              </div>
            )}
            {selectedCustomerId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setSelectedCustomerId('');
                  setCustomerSearch('');
                }}
              >
                Đổi khách hàng
              </Button>
            )}
          </div>

          {selectedCustomerId && (
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Đơn hàng / Hợp đồng (tuỳ chọn)</p>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">-- Chọn đơn hàng --</option>
                {(orders ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Bằng chứng (URL)</p>
            <Input
              placeholder="URL hình ảnh hoặc tài liệu..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Nhập link ảnh chụp màn hình chuyển khoản, biên lai, ...
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Ghi chú *</p>
            <textarea
              rows={3}
              placeholder="Lý do nhận vô giao dịch này..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleClose} disabled={createClaim.isPending}>
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createClaim.isPending || !selectedCustomerId || !note}
          >
            {createClaim.isPending ? 'Đang xử lý...' : 'Gửi yêu cầu nhận vô'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Component
// ---------------------------------------------------------------------------
export function TabChuaPhanBo() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [claimsPage, setClaimsPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<UnallocatedTransaction | null>(null);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: unallocatedKeys.list({ page, limit: 20 }),
    queryFn: () => unallocatedApi.listUnallocated({ page, limit: 20 }),
  });

  const { data: claimsData, isLoading: loadingClaims } = useQuery({
    queryKey: unallocatedKeys.claims({ page: claimsPage, limit: 20, status: 'PENDING' }),
    queryFn: () => unallocatedApi.listClaims({ page: claimsPage, limit: 20, status: 'PENDING' }),
  });

  const approveClaim = useMutation({
    mutationFn: unallocatedApi.approveClaim,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unallocatedKeys.all });
      toast.success('Đã duyệt yêu cầu nhận vô');
    },
    onError: () => {
      toast.error('Không thể duyệt yêu cầu');
    },
  });

  const rejectClaim = useMutation({
    mutationFn: (id: string) => unallocatedApi.rejectClaim(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unallocatedKeys.all });
      toast.success('Đã từ chối yêu cầu nhận vô');
    },
    onError: () => {
      toast.error('Không thể từ chối yêu cầu');
    },
  });

  const handleClaim = (tx: UnallocatedTransaction) => {
    setSelectedTx(tx);
    setClaimDialogOpen(true);
  };

  const transactions = txData?.data ?? [];
  const claims = claimsData?.data ?? [];

  const isAccountant =
    user?.role === UserRole.CHIEF_ACCOUNTANT ||
    user?.role === UserRole.ACCOUNTANT_AR ||
    user?.role === UserRole.CEO ||
    user?.role === UserRole.COO;

  return (
    <div>
      {/* Unallocated Transactions Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Giao dịch chưa phân bổ</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Không có giao dịch chưa phân bổ.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Ngày</th>
                    <th className="pb-3 pr-4 text-right">Số tiền</th>
                    <th className="pb-3 pr-4">Loại</th>
                    <th className="pb-3 pr-4">Khách hàng</th>
                    <th className="pb-3 pr-4">Tham chiếu</th>
                    <th className="pb-3 pr-4">Ghi chú</th>
                    <th className="pb-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0 text-sm">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {formatDate(tx.createdAt, 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium tabular-nums">
                        {formatCurrency(tx.amount, tx.currency || Currency.VND)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          className={
                            tx.type === 'TOPUP'
                              ? 'bg-green-100 text-green-700 border-0'
                              : tx.type === 'REFUND'
                                ? 'bg-blue-100 text-blue-700 border-0'
                                : 'bg-gray-100 text-gray-700 border-0'
                          }
                        >
                          {tx.type === 'TOPUP' ? 'Nạp tiền' : tx.type === 'REFUND' ? 'Hoàn tiền' : 'Khác'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {tx.customer ? (
                          <span>
                            {tx.customer.fullName}{' '}
                            <span className="text-muted-foreground">({tx.customer.code})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {tx.reference || '---'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground max-w-[200px] truncate">
                        {tx.note || '---'}
                      </td>
                      <td className="py-3 text-center">
                        <Button size="sm" variant="outline" onClick={() => handleClaim(tx)}>
                          Nhận vô
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {txData?.meta && txData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Trang {page} / {txData.meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= txData.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Claims Queue (for accountant roles) */}
      {isAccountant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Yêu cầu nhận vô chờ duyệt</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClaims ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
              </div>
            ) : claims.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Không có yêu cầu nào đang chờ duyệt.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                      <th className="pb-3 pr-4">Ngày tạo</th>
                      <th className="pb-3 pr-4">Người tạo</th>
                      <th className="pb-3 pr-4">Khách hàng</th>
                      <th className="pb-3 pr-4 text-right">Số tiền</th>
                      <th className="pb-3 pr-4">Đơn hàng</th>
                      <th className="pb-3 pr-4">Ghi chú</th>
                      <th className="pb-3 pr-4">Trạng thái</th>
                      <th className="pb-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr key={claim.id} className="border-b last:border-0 text-sm">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {formatDate(claim.createdAt, 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="py-3 pr-4">{claim.createdByName || '---'}</td>
                        <td className="py-3 pr-4">{claim.customerName}</td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">
                          {formatCurrency(claim.amount)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {claim.orderId || claim.contractId || '---'}
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate text-muted-foreground">
                          {claim.note}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className="bg-yellow-100 text-yellow-800 border-0">Chờ duyệt</Badge>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveClaim.mutate(claim.id)}
                              disabled={approveClaim.isPending || rejectClaim.isPending}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => rejectClaim.mutate(claim.id)}
                              disabled={approveClaim.isPending || rejectClaim.isPending}
                            >
                              Từ chối
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {claimsData?.meta && claimsData.meta.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Trang {claimsPage} / {claimsData.meta.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={claimsPage <= 1}
                    onClick={() => setClaimsPage((p) => p - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={claimsPage >= claimsData.meta.totalPages}
                    onClick={() => setClaimsPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ClaimDialog
        transaction={selectedTx}
        open={claimDialogOpen}
        onClose={() => {
          setClaimDialogOpen(false);
          setSelectedTx(null);
        }}
      />
    </div>
  );
}
