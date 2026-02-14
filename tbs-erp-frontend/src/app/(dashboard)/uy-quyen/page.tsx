'use client';

import { useState } from 'react';
import { Plus, X, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDelegations,
  useCreateDelegation,
  useDeactivateDelegation,
} from '@/lib/hooks/use-approval-flows';
import { formatDate } from '@/lib/utils/format';

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

  const handleSubmit = async (e: React.FormEvent) => {
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

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Tạo ủy quyền mới
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  <p className="text-sm text-muted-foreground">
                    Ví dụ: purchase_order, expense, leave_request
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createDelegation.isPending}>
                  {createDelegation.isPending ? 'Đang tạo...' : 'Tạo ủy quyền'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ủy quyền</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : !delegations || delegations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Chưa có ủy quyền nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Người nhận</th>
                    <th className="text-left py-3 px-4 font-medium">Ngày bắt đầu</th>
                    <th className="text-left py-3 px-4 font-medium">Ngày kết thúc</th>
                    <th className="text-left py-3 px-4 font-medium">Lý do</th>
                    <th className="text-left py-3 px-4 font-medium">Trạng thái</th>
                    <th className="text-center py-3 px-4 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {delegations.map((delegation) => (
                    <tr key={delegation.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{delegation.toUserId}</td>
                      <td className="py-3 px-4">{formatDate(delegation.startDate)}</td>
                      <td className="py-3 px-4">{formatDate(delegation.endDate)}</td>
                      <td className="py-3 px-4">{delegation.reason}</td>
                      <td className="py-3 px-4">
                        {delegation.isActive ? (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700">
                            Đã hủy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {delegation.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(delegation.id)}
                            disabled={deactivateDelegation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Hủy
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
