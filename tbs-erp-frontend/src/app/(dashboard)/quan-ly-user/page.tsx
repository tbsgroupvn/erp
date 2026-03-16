'use client';

import { useState, useMemo } from 'react';
import { Plus, X, Shield, Search } from 'lucide-react';
import {
  useUsers,
  useCreateUser,
  useActivateUser,
  useDeactivateUser,
  useResetUserPassword,
} from '@/lib/hooks/use-users';
import { UserRole } from '@/lib/types/enums';
import { USER_ROLE_LABELS } from '@/lib/utils/constants';
import type { UserQueryParams, UserAccount } from '@/lib/api/users.api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
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
import { formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';

const INITIAL_FORM = {
  email: '',
  fullName: '',
  role: UserRole.SALE as UserRole,
  password: '',
  employeeId: '',
};

export default function QuanLyUserPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [formData, setFormData] = useState(INITIAL_FORM);

  const queryParams: UserQueryParams = {
    page,
    limit: 20,
    search: search || undefined,
    role: roleFilter !== 'ALL' ? (roleFilter as UserRole) : undefined,
    isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'active',
  };

  const { data: usersData, isLoading } = useUsers(queryParams);
  const createUser = useCreateUser();
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const resetPassword = useResetUserPassword();

  // Summary
  const summary = useMemo(() => {
    const items = usersData?.data ?? [];
    return {
      total: usersData?.meta?.total ?? items.length,
      active: items.filter((u) => u.isActive).length,
      inactive: items.filter((u) => !u.isActive).length,
    };
  }, [usersData]);

  const handleCreate = () => {
    createUser.mutate(
      {
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        password: formData.password,
        employeeId: formData.employeeId || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setFormData(INITIAL_FORM);
        },
      },
    );
  };

  const columns: ColumnDef<UserAccount>[] = useMemo(
    () => [
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'fullName',
        header: 'Họ tên',
      },
      {
        accessorKey: 'role',
        header: 'Vai trò',
        cell: ({ row }) => (
          <span>{USER_ROLE_LABELS[row.original.role] || row.original.role}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.isActive ? 'Hoạt động' : 'Vô hiệu'}
            colorClass={
              row.original.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }
          />
        ),
      },
      {
        accessorKey: 'lastLoginAt',
        header: 'Đăng nhập cuối',
        cell: ({ row }) => (
          <span>
            {row.original.lastLoginAt
              ? formatDate(row.original.lastLoginAt)
              : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex gap-2">
              {user.isActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deactivateUser.mutate(user.id)}
                  disabled={deactivateUser.isPending}
                >
                  Vô hiệu
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => activateUser.mutate(user.id)}
                  disabled={activateUser.isPending}
                >
                  Kích hoạt
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetPassword.mutate(user.id)}
                disabled={resetPassword.isPending}
              >
                Đặt lại MK
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activateUser.isPending, deactivateUser.isPending, resetPassword.isPending],
  );

  return (
    <div>
      <PageHeader title="Quản lý người dùng" description="Quản lý tài khoản và phân quyền" infoKey="quan-ly-user">
        <Button onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Tạo tài khoản
            </>
          )}
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng tài khoản
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đang hoạt động
            </CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã vô hiệu
            </CardTitle>
            <Shield className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tạo tài khoản mới</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Họ tên *</Label>
                <Input
                  id="fullName"
                  placeholder="Nhập họ tên"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Vai trò *</p>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, role: value as UserRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(UserRole).map((role) => (
                      <SelectItem key={role} value={role}>
                        {USER_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Mã nhân viên</Label>
                <Input
                  id="employeeId"
                  placeholder="Không bắt buộc"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, employeeId: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={
                  createUser.isPending || !formData.email || !formData.fullName || !formData.password
                }
              >
                {createUser.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormData(INITIAL_FORM);
                }}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên/email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Vai trò" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả vai trò</SelectItem>
            {Object.values(UserRole).map((role) => (
              <SelectItem key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả</SelectItem>
            <SelectItem value="active">Hoạt động</SelectItem>
            <SelectItem value="inactive">Vô hiệu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={usersData?.data ?? []}
        pageCount={usersData?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
