'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { RoleGuard } from '@/components/shared/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  // Search customers
  const { data: customers } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: () => unallocatedApi.searchCustomers(customerSearch),
    enabled: customerSearch.length >= 2,
  });

  // Fetch orders for selected customer
  const { data: orders } = useQuery({
    queryKey: ['customer-orders', selectedCustomerId],
    queryFn: () => unallocatedApi.searchOrders(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });

  const createClaim = useMutation({
    mutationFn: unallocatedApi.createClaim,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unallocatedKeys.all });
      toast.success('Da tao yeu cau nhan vo thanh cong');
      handleClose();
    },
    onError: () => {
      toast.error('Khong the tao yeu cau. Vui long thu lai.');
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
        <h2 className="text-lg font-semibold mb-1">Nhan vo giao dich</h2>
        <p className="text-sm text-muted-foreground mb-4">
          So tien: {formatCurrency(transaction.amount, transaction.currency || Currency.VND)} &middot;{' '}
          {formatDate(transaction.createdAt, 'dd/MM/yyyy HH:mm')}
        </p>

        <div className="space-y-4">
          {/* Search customer */}
          <div className="space-y-2">
            <Label>Tim khach hang *</Label>
            <Input
              placeholder="Nhap ten hoac ma khach hang..."
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
                Doi khach hang
              </Button>
            )}
          </div>

          {/* Select order */}
          {selectedCustomerId && (
            <div className="space-y-2">
              <Label>Don hang / Hop dong (tuy chon)</Label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">-- Chon don hang --</option>
                {(orders ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Evidence upload */}
          <div className="space-y-2">
            <Label>Bang chung (URL)</Label>
            <Input
              placeholder="URL hinh anh hoac tai lieu..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Nhap link anh chup man hinh chuyen khoan, bien lai, ...
            </p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Ghi chu *</Label>
            <textarea
              rows={3}
              placeholder="Ly do nhan vo giao dich nay..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleClose} disabled={createClaim.isPending}>
            Huy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createClaim.isPending || !selectedCustomerId || !note}
          >
            {createClaim.isPending ? 'Dang xu ly...' : 'Gui yeu cau nhan vo'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function ChuaPhanBoPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [claimsPage, setClaimsPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<UnallocatedTransaction | null>(null);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);

  // Fetch unallocated transactions
  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: unallocatedKeys.list({ page, limit: 20 }),
    queryFn: () => unallocatedApi.listUnallocated({ page, limit: 20 }),
  });

  // Fetch pending claims
  const { data: claimsData, isLoading: loadingClaims } = useQuery({
    queryKey: unallocatedKeys.claims({ page: claimsPage, limit: 20, status: 'PENDING' }),
    queryFn: () => unallocatedApi.listClaims({ page: claimsPage, limit: 20, status: 'PENDING' }),
  });

  const approveClaim = useMutation({
    mutationFn: unallocatedApi.approveClaim,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unallocatedKeys.all });
      toast.success('Da duyet yeu cau nhan vo');
    },
    onError: () => {
      toast.error('Khong the duyet yeu cau');
    },
  });

  const rejectClaim = useMutation({
    mutationFn: (id: string) => unallocatedApi.rejectClaim(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unallocatedKeys.all });
      toast.success('Da tu choi yeu cau nhan vo');
    },
    onError: () => {
      toast.error('Khong the tu choi yeu cau');
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
      <PageHeader
        title="Tien chua phan bo"
        description="Quan ly cac giao dich vi chua duoc phan bo cho don hang"
      />

      {/* ===== Unallocated Transactions Table ===== */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Giao dich chua phan bo</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Dang tai du lieu...</p>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Khong co giao dich chua phan bo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Ngay</th>
                    <th className="pb-3 pr-4 text-right">So tien</th>
                    <th className="pb-3 pr-4">Loai</th>
                    <th className="pb-3 pr-4">Khach hang</th>
                    <th className="pb-3 pr-4">Tham chieu</th>
                    <th className="pb-3 pr-4">Ghi chu</th>
                    <th className="pb-3 text-center">Thao tac</th>
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
                          {tx.type === 'TOPUP' ? 'Nap tien' : tx.type === 'REFUND' ? 'Hoan tien' : 'Khac'}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClaim(tx)}
                        >
                          Nhan vo
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {txData?.meta && txData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Trang {page} / {txData.meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Truoc
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

      {/* ===== Pending Claims Queue (for accountant roles) ===== */}
      {isAccountant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Yeu cau nhan vo cho duyet</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClaims ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Dang tai du lieu...</p>
              </div>
            ) : claims.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Khong co yeu cau nao dang cho duyet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                      <th className="pb-3 pr-4">Ngay tao</th>
                      <th className="pb-3 pr-4">Nguoi tao</th>
                      <th className="pb-3 pr-4">Khach hang</th>
                      <th className="pb-3 pr-4 text-right">So tien</th>
                      <th className="pb-3 pr-4">Don hang</th>
                      <th className="pb-3 pr-4">Ghi chu</th>
                      <th className="pb-3 pr-4">Trang thai</th>
                      <th className="pb-3 text-center">Thao tac</th>
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
                          <Badge className="bg-yellow-100 text-yellow-800 border-0">
                            Cho duyet
                          </Badge>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveClaim.mutate(claim.id)}
                              disabled={approveClaim.isPending || rejectClaim.isPending}
                            >
                              Duyet
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => rejectClaim.mutate(claim.id)}
                              disabled={approveClaim.isPending || rejectClaim.isPending}
                            >
                              Tu choi
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Claims Pagination */}
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
                    Truoc
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

      {/* ===== Claim Dialog ===== */}
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
