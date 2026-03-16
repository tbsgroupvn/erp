'use client';

import { useState, type FormEvent } from 'react';
import {
  Plus,
  X,
  UserCog,
  CalendarDays,
  ShieldCheck,
  ShieldOff,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDelegations,
  useCreateDelegation,
  useDeactivateDelegation,
} from '@/lib/hooks/use-approval-flows';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export default function UyQuyenPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    delegateUserId: '',
    startDate: '',
    endDate: '',
    approvalTypes: '',
    reason: '',
  });
  const { data: delegations, isLoading } = useDelegations();
  const createDelegation = useCreateDelegation();
  const deactivateDelegation = useDeactivateDelegation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createDelegation.mutateAsync({
        toUserId: formData.delegateUserId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        approvalTypes: formData.approvalTypes
          ? formData.approvalTypes.split(',').map((t) => t.trim())
          : undefined,
        reason: formData.reason,
      });
      setFormData({
        delegateUserId: '',
        startDate: '',
        endDate: '',
        approvalTypes: '',
        reason: '',
      });
      setShowForm(false);
    } catch (error) {
      console.error('Failed to create delegation:', error);
    }
  };

  const handleDeactivate = async (delegationId: string) => {
    if (confirm('Bạn có chắc chắn muốn hủy ủy quyền này?')) {
      try {
        await deactivateDelegation.mutateAsync(delegationId);
      } catch (error) {
        console.error('Failed to deactivate delegation:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Ủy quyền phê duyệt" description="Quản lý ủy quyền phê duyệt khi vắng mặt">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Tạo ủy quyền
            </>
          )}
        </Button>
      </PageHeader>

      {/* Create delegation form */}
      {showForm && (
        <div className="section-card">
          <div className="section-card-header">
            <h3 className="flex items-center gap-2 text-base font-semibold font-heading">
              <UserCog className="h-5 w-5" />
              Tạo ủy quyền mới
            </h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delegateUserId">
                    Người nhận ủy quyền <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="delegateUserId"
                    value={formData.delegateUserId}
                    onChange={(e) => setFormData({ ...formData, delegateUserId: e.target.value })}
                    required
                    placeholder="Nhập ID người dùng"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">
                    Lý do <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    placeholder="Nhập lý do ủy quyền"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    Ngày bắt đầu <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    Ngày kết thúc <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="approvalTypes">
                    Loại phê duyệt <span className="text-muted-foreground">(tùy chọn)</span>
                  </Label>
                  <Input
                    id="approvalTypes"
                    value={formData.approvalTypes}
                    onChange={(e) => setFormData({ ...formData, approvalTypes: e.target.value })}
                    placeholder="Để trống cho tất cả hoặc nhập các loại cách nhau bởi dấu phẩy"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ví dụ: purchase_order, expense, leave_request
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createDelegation.isPending}>
                  {createDelegation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    'Tạo ủy quyền'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delegation list */}
      <div className="section-card">
        <div className="section-card-header">
          <h3 className="text-base font-semibold font-heading">Danh sách ủy quyền</h3>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border bg-card p-4 animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-muted" />
                    <div className="h-3 w-56 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : !delegations || delegations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <UserCog className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Chưa có ủy quyền nào</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Nhấn &quot;Tạo ủy quyền&quot; để bắt đầu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {delegations.map((delegation) => {
                const isActive = delegation.isActive;
                const isExpired = !isActive || new Date(delegation.endDate) < new Date();

                return (
                  <div
                    key={delegation.id}
                    className={cn(
                      'group relative flex items-start gap-4 rounded-xl border bg-card p-4 transition-all',
                      isActive && !isExpired
                        ? 'hover:shadow-md hover:border-primary/20'
                        : 'opacity-70',
                    )}
                  >
                    {/* Status icon */}
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {isActive ? (
                        <ShieldCheck className="h-5 w-5" />
                      ) : (
                        <ShieldOff className="h-5 w-5" />
                      )}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Ủy quyền cho: {delegation.toUserId}
                          </p>
                          {delegation.reason && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {delegation.reason}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {isActive ? 'Đang hoạt động' : 'Đã hủy'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(delegation.startDate)} — {formatDate(delegation.endDate)}
                        </span>
                        {delegation.approvalTypes && delegation.approvalTypes.length > 0 && (
                          <span>
                            Loại: {delegation.approvalTypes.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Deactivate action */}
                    {isActive && (
                      <div className="flex shrink-0 items-center">
                        <button
                          onClick={() => handleDeactivate(delegation.id)}
                          disabled={deactivateDelegation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
