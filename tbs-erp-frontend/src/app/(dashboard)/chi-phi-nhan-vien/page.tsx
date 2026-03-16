'use client';

import { useState } from 'react';
import {
  FileText,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Wallet,
  Clock,
  AlertCircle,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/lib/types/enums';
import { formatCurrency } from '@/lib/utils/format';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import {
  useExpenses,
  useMyExpenses,
  useExpenseStats,
  useExpense,
  useCreateExpense,
  useSubmitExpense,
  useApproveExpense,
  useRejectExpense,
  useMarkPaidExpense,
  useAddExpenseItem,
  useRemoveExpenseItem,
} from '@/lib/hooks/use-expenses';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  EXPENSE_STATUS_COLORS,
  type ExpenseClaim,
  type ExpenseItem,
} from '@/lib/api/expense.api';
import type { ColumnDef } from '@tanstack/react-table';

// ============================================
// Constants
// ============================================

const APPROVAL_ROLES: UserRole[] = [
  UserRole.HR_MANAGER,
  UserRole.CEO,
  UserRole.COO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.CFO,
  UserRole.DIRECTOR_OPERATIONS,
];

const PAYMENT_ROLES: UserRole[] = [
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.CFO,
];

const VIEWER_ROLES: UserRole[] = [
  UserRole.HR_MANAGER,
  UserRole.CEO,
  UserRole.COO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.CFO,
  UserRole.DIRECTOR_OPERATIONS,
  UserRole.ACCOUNTANT,
];

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({
  value,
  label,
}));

// ============================================
// Status Badge
// ============================================

function ExpenseStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        EXPENSE_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700',
      )}
    >
      {EXPENSE_STATUS[status] ?? status}
    </span>
  );
}

// ============================================
// Create Expense Dialog
// ============================================

function CreateExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<
    { category: string; description: string; amount: string; date: string; receiptUrl: string }[]
  >([]);
  const createMutation = useCreateExpense();

  function addItemRow() {
    setItems((prev) => [
      ...prev,
      { category: 'TRAVEL', description: '', amount: '', date: '', receiptUrl: '' },
    ]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return;

    const parsedItems = items
      .filter((i) => i.description.trim() && i.amount && i.date)
      .map((i) => ({
        category: i.category,
        description: i.description,
        amount: parseFloat(i.amount),
        date: i.date,
        receiptUrl: i.receiptUrl || undefined,
      }));

    await createMutation.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      items: parsedItems,
    });

    setOpen(false);
    setTitle('');
    setDescription('');
    setItems([]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Tạo đề nghị
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo đề nghị chi phí mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Tiêu đề <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="VD: Chi phí công tác Hà Nội tháng 3/2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Ghi chú</Label>
            <Textarea
              id="description"
              placeholder="Mô tả thêm về đề nghị chi phí..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Danh sách khoản chi</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Thêm khoản
              </Button>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                Chưa có khoản chi nào. Nhấn &quot;Thêm khoản&quot; để bắt đầu.
              </p>
            )}

            {items.map((item, index) => (
              <div key={index} className="grid gap-2 p-3 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Danh mục</Label>
                    <Select
                      value={item.category}
                      onValueChange={(v) => updateItem(index, 'category', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ngày phát sinh</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={item.date}
                      onChange={(e) => updateItem(index, 'date', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Mô tả khoản chi</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="VD: Vé máy bay Hà Nội - HCM"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Số tiền (VND)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      placeholder="0"
                      value={item.amount}
                      onChange={(e) => updateItem(index, 'amount', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">URL hóa đơn (tùy chọn)</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="https://..."
                      value={item.receiptUrl}
                      onChange={(e) => updateItem(index, 'receiptUrl', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() => removeItemRow(index)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Xóa
                  </Button>
                </div>
              </div>
            ))}

            {items.length > 0 && (
              <div className="flex justify-end text-sm font-medium text-muted-foreground pt-1">
                Tổng cộng:{' '}
                <span className="ml-1 font-bold text-foreground">
                  {formatCurrency(
                    items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo đề nghị'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Reject Dialog
// ============================================

function RejectDialog({
  claimId,
  onClose,
}: {
  claimId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const rejectMutation = useRejectExpense();

  async function handleReject() {
    if (!reason.trim()) return;
    await rejectMutation.mutateAsync({ id: claimId, reason: reason.trim() });
    setReason('');
    onClose();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="reject-reason">Lý do từ chối <span className="text-destructive">*</span></Label>
        <Textarea
          id="reject-reason"
          placeholder="Nhập lý do từ chối..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Hủy
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={!reason.trim() || rejectMutation.isPending}
          onClick={handleReject}
        >
          {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Claim Detail Panel
// ============================================

function ClaimDetailPanel({
  claimId,
  currentUserId,
  userRole,
  onClose,
}: {
  claimId: string;
  currentUserId: string;
  userRole: UserRole;
  onClose: () => void;
}) {
  const { data: claim, isLoading } = useExpense(claimId);
  const submitMutation = useSubmitExpense();
  const approveMutation = useApproveExpense();
  const markPaidMutation = useMarkPaidExpense();
  const addItemMutation = useAddExpenseItem(claimId);
  const removeItemMutation = useRemoveExpenseItem(claimId);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    category: 'TRAVEL',
    description: '',
    amount: '',
    date: '',
    receiptUrl: '',
  });

  const isApprover = APPROVAL_ROLES.includes(userRole);
  const isPayer = PAYMENT_ROLES.includes(userRole);
  const isOwner = claim?.employeeId === currentUserId;

  async function handleAddItem() {
    if (!newItem.description.trim() || !newItem.amount || !newItem.date) return;
    await addItemMutation.mutateAsync({
      category: newItem.category,
      description: newItem.description,
      amount: parseFloat(newItem.amount),
      date: newItem.date,
      receiptUrl: newItem.receiptUrl || undefined,
    });
    setNewItem({ category: 'TRAVEL', description: '', amount: '', date: '', receiptUrl: '' });
    setShowAddItem(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground text-sm">Đang tải...</div>
      </div>
    );
  }

  if (!claim) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{claim.code}</p>
          <h3 className="text-lg font-semibold">{claim.title}</h3>
          {claim.description && (
            <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
          )}
        </div>
        <ExpenseStatusBadge status={claim.status} />
      </div>

      {/* Amount */}
      <div className="rounded-xl bg-muted/40 p-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Tổng số tiền</p>
        <p className="text-2xl font-bold mt-1">{formatCurrency(Number(claim.totalAmount))}</p>
        <p className="text-xs text-muted-foreground mt-1">{claim.currency}</p>
      </div>

      {/* Rejection reason */}
      {claim.status === 'REJECTED' && claim.rejectionReason && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-destructive">Lý do từ chối</p>
            <p className="text-sm mt-0.5">{claim.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Danh sách khoản chi ({claim.items.length})</h4>
          {isOwner && claim.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowAddItem(!showAddItem)}
            >
              {showAddItem ? (
                <>
                  <ChevronUp className="mr-1 h-3.5 w-3.5" /> Ẩn
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Thêm khoản
                </>
              )}
            </Button>
          )}
        </div>

        {showAddItem && (
          <div className="mb-3 p-3 border rounded-lg bg-muted/30 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Danh mục</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(v) => setNewItem((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ngày</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={newItem.date}
                  onChange={(e) => setNewItem((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mô tả</Label>
              <Input
                className="h-8 text-xs"
                value={newItem.description}
                onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Số tiền (VND)</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={newItem.amount}
                  onChange={(e) => setNewItem((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">URL hóa đơn</Label>
                <Input
                  className="h-8 text-xs"
                  value={newItem.receiptUrl}
                  onChange={(e) => setNewItem((p) => ({ ...p, receiptUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddItem(false)}>
                Hủy
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!newItem.description || !newItem.amount || !newItem.date || addItemMutation.isPending}
                onClick={handleAddItem}
              >
                Thêm
              </Button>
            </div>
          </div>
        )}

        {claim.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
            Chưa có khoản chi nào
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Danh mục</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Mô tả</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Ngày</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Số tiền</th>
                  {isOwner && claim.status === 'DRAFT' && (
                    <th className="px-3 py-2 w-8" />
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {claim.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {EXPENSE_CATEGORIES[item.category] ?? item.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate">
                      {item.receiptUrl ? (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title="Xem hóa đơn"
                        >
                          {item.description}
                        </a>
                      ) : (
                        item.description
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(item.date, 'dd/MM/yyyy')}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(Number(item.amount))}
                    </td>
                    {isOwner && claim.status === 'DRAFT' && (
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => removeItemMutation.mutate(item.id)}
                          disabled={removeItemMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={isOwner && claim.status === 'DRAFT' ? 3 : 3} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {formatCurrency(Number(claim.totalAmount))}
                  </td>
                  {isOwner && claim.status === 'DRAFT' && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div>
          <span className="font-medium">Tạo lúc:</span>{' '}
          {formatDate(claim.createdAt)}
        </div>
        {claim.submittedAt && (
          <div>
            <span className="font-medium">Gửi lúc:</span>{' '}
            {formatDate(claim.submittedAt)}
          </div>
        )}
        {claim.approvedAt && (
          <div>
            <span className="font-medium">Duyệt lúc:</span>{' '}
            {formatDate(claim.approvedAt)}
          </div>
        )}
        {claim.paidAt && (
          <div>
            <span className="font-medium">Chi lúc:</span>{' '}
            {formatDate(claim.paidAt)}
          </div>
        )}
      </div>

      {/* Reject form */}
      {showRejectForm && (
        <div className="rounded-lg border p-3">
          <h4 className="text-sm font-medium mb-2">Từ chối đề nghị</h4>
          <RejectDialog claimId={claim.id} onClose={() => setShowRejectForm(false)} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {/* Owner: Submit */}
        {isOwner && claim.status === 'DRAFT' && claim.items.length > 0 && (
          <Button
            size="sm"
            onClick={() => submitMutation.mutate(claim.id)}
            disabled={submitMutation.isPending}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {submitMutation.isPending ? 'Đang gửi...' : 'Gửi phê duyệt'}
          </Button>
        )}

        {/* Approver: Approve / Reject */}
        {isApprover && claim.status === 'SUBMITTED' && (
          <>
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => approveMutation.mutate(claim.id)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              {approveMutation.isPending ? 'Đang duyệt...' : 'Phê duyệt'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowRejectForm(true)}
              disabled={showRejectForm}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Từ chối
            </Button>
          </>
        )}

        {/* Payer: Mark paid */}
        {isPayer && claim.status === 'APPROVED' && (
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => markPaidMutation.mutate(claim.id)}
            disabled={markPaidMutation.isPending}
          >
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            {markPaidMutation.isPending ? 'Đang xử lý...' : 'Xác nhận đã chi'}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Tab: My Expenses
// ============================================

function MyExpensesTab({
  currentUserId,
  userRole,
}: {
  currentUserId: string;
  userRole: UserRole;
}) {
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: statsData } = useExpenseStats();
  const { data, isLoading } = useMyExpenses(
    filterStatus ? { status: filterStatus } : undefined,
  );

  const claims = data?.items ?? [];

  const columns: ColumnDef<ExpenseClaim>[] = [
    {
      accessorKey: 'code',
      header: 'Mã',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Tiêu đề',
      cell: ({ row }) => (
        <p className="font-medium text-sm line-clamp-1 max-w-[200px]">{row.original.title}</p>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => <ExpenseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng tiền',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(Number(row.original.totalAmount))}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tạo',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {formatDate(row.original.createdAt, 'dd/MM/yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setSelectedId(row.original.id)}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          Xem
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Nháp"
          value={statsData?.draft.count ?? 0}
          icon={FileText}
          description={formatCurrency(statsData?.draft.totalAmount ?? 0)}
          variant="cyan"
        />
        <StatCard
          title="Đã gửi"
          value={statsData?.submitted.count ?? 0}
          icon={Clock}
          description={formatCurrency(statsData?.submitted.totalAmount ?? 0)}
          variant="amber"
        />
        <StatCard
          title="Đã duyệt"
          value={statsData?.approved.count ?? 0}
          icon={CheckCircle}
          description={formatCurrency(statsData?.approved.totalAmount ?? 0)}
          variant="emerald"
        />
        <StatCard
          title="Đã chi"
          value={statsData?.paid.count ?? 0}
          icon={Wallet}
          description={formatCurrency(statsData?.paid.totalAmount ?? 0)}
          variant="violet"
        />
      </div>

      {/* Filters + Create button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={filterStatus || 'all'}
            onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              {Object.entries(EXPENSE_STATUS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CreateExpenseDialog />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={claims}
        isLoading={isLoading}
      />

      {/* Detail dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết đề nghị chi phí</DialogTitle>
          </DialogHeader>
          {selectedId && (
            <ClaimDetailPanel
              claimId={selectedId}
              currentUserId={currentUserId}
              userRole={userRole}
              onClose={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Tab: Pending Approval
// ============================================

function PendingApprovalTab({
  currentUserId,
  userRole,
}: {
  currentUserId: string;
  userRole: UserRole;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const approveMutation = useApproveExpense();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { data, isLoading } = useExpenses({ status: 'SUBMITTED', limit: 50 });

  const claims = data?.items ?? [];

  const columns: ColumnDef<ExpenseClaim>[] = [
    {
      accessorKey: 'code',
      header: 'Mã',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'employeeId',
      header: 'Nhân viên',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.employeeId}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Tiêu đề',
      cell: ({ row }) => (
        <p className="font-medium text-sm line-clamp-1 max-w-[180px]">{row.original.title}</p>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng tiền',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(Number(row.original.totalAmount))}
        </span>
      ),
    },
    {
      accessorKey: 'submittedAt',
      header: 'Ngày gửi',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {formatDate(row.original.submittedAt, 'dd/MM/yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedId(row.original.id)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            Xem
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => approveMutation.mutate(row.original.id)}
            disabled={approveMutation.isPending}
          >
            <CheckCircle className="mr-1 h-3.5 w-3.5" />
            Duyệt
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setRejectingId(row.original.id)}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Từ chối
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <DataTable
        columns={columns}
        data={claims}
        isLoading={isLoading}
      />

      {/* Reject inline dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Từ chối đề nghị chi phí</DialogTitle>
          </DialogHeader>
          {rejectingId && (
            <RejectDialog claimId={rejectingId} onClose={() => setRejectingId(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết đề nghị chi phí</DialogTitle>
          </DialogHeader>
          {selectedId && (
            <ClaimDetailPanel
              claimId={selectedId}
              currentUserId={currentUserId}
              userRole={userRole}
              onClose={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Tab: All Expenses
// ============================================

function AllExpensesTab({
  currentUserId,
  userRole,
}: {
  currentUserId: string;
  userRole: UserRole;
}) {
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useExpenses(filterStatus ? { status: filterStatus } : undefined);
  const claims = data?.items ?? [];

  const columns: ColumnDef<ExpenseClaim>[] = [
    {
      accessorKey: 'code',
      header: 'Mã',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'employeeId',
      header: 'Nhân viên',
      cell: ({ row }) => (
        <span className="text-xs">{row.original.employeeId}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Tiêu đề',
      cell: ({ row }) => (
        <p className="font-medium text-sm line-clamp-1 max-w-[160px]">{row.original.title}</p>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => <ExpenseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng tiền',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(Number(row.original.totalAmount))}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tạo',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {formatDate(row.original.createdAt, 'dd/MM/yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setSelectedId(row.original.id)}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          Xem
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Select
          value={filterStatus || 'all'}
          onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {Object.entries(EXPENSE_STATUS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} đề nghị
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={claims}
        isLoading={isLoading}
      />

      {/* Detail dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết đề nghị chi phí</DialogTitle>
          </DialogHeader>
          {selectedId && (
            <ClaimDetailPanel
              claimId={selectedId}
              currentUserId={currentUserId}
              userRole={userRole}
              onClose={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

const TABS = [
  { key: 'my' as const, label: 'Của tôi', icon: FileText, managerOnly: false },
  { key: 'approval' as const, label: 'Phê duyệt', icon: CheckCircle, managerOnly: true },
  { key: 'all' as const, label: 'Tất cả', icon: Wallet, managerOnly: true },
];

type TabKey = 'my' | 'approval' | 'all';

export default function ChiPhiNhanVienPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('my');

  const role = (user?.role as UserRole) ?? UserRole.SALE;
  const isManager = VIEWER_ROLES.includes(role);

  const visibleTabs = TABS.filter((tab) => !tab.managerOnly || isManager);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Chi phí nhân viên"
        description="Quản lý đề nghị thanh toán chi phí công việc"
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'my' && (
          <MyExpensesTab currentUserId={user?.id ?? ''} userRole={role} />
        )}
        {activeTab === 'approval' && isManager && (
          <PendingApprovalTab currentUserId={user?.id ?? ''} userRole={role} />
        )}
        {activeTab === 'all' && isManager && (
          <AllExpensesTab currentUserId={user?.id ?? ''} userRole={role} />
        )}
      </div>
    </div>
  );
}
