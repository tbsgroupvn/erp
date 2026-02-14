'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pagesApi, Page } from '@/lib/api/cms';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, MoreHorizontal, Eye, Edit, Copy, Trash2, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function PagesListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['pages', { search, status, page }],
    queryFn: () =>
      pagesApi.list({
        search: search || undefined,
        status: (status && status !== 'all') ? (status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') : undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: pagesApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa trang thành công');
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: () => {
      toast.error('Không thể xóa trang');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: pagesApi.duplicate,
    onSuccess: () => {
      toast.success('Đã nhân bản trang thành công');
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: () => {
      toast.error('Không thể nhân bản trang');
    },
  });

  const columns = [
    {
      header: 'Tiêu đề',
      accessorKey: 'title',
      cell: ({ row }: any) => (
        <div>
          <Link
            href={`/admin/pages/${row.original.id}`}
            className="font-medium hover:text-primary"
          >
            {row.original.title}
          </Link>
          <p className="text-sm text-muted-foreground">/{row.original.slug}</p>
        </div>
      ),
    },
    {
      header: 'Trạng thái',
      accessorKey: 'status',
      cell: ({ row }: any) => {
        const status = row.original.status;
        const colorMap: Record<string, string> = {
          PUBLISHED: 'bg-green-100 text-green-700',
          DRAFT: 'bg-yellow-100 text-yellow-700',
          ARCHIVED: 'bg-gray-100 text-gray-700',
        };
        const labelMap: Record<string, string> = {
          PUBLISHED: 'Đã xuất bản',
          DRAFT: 'Nháp',
          ARCHIVED: 'Lưu trữ',
        };
        return (
          <StatusBadge
            label={labelMap[status] || status}
            colorClass={colorMap[status]}
          />
        );
      },
    },
    {
      header: 'Cập nhật',
      accessorKey: 'updatedAt',
      cell: ({ row }: any) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.updatedAt), {
            addSuffix: true,
            locale: vi,
          })}
        </span>
      ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.status === 'PUBLISHED' && (
              <DropdownMenuItem
                onClick={() =>
                  window.open(`/${row.original.slug}`, '_blank')
                }
              >
                <Eye className="mr-2 h-4 w-4" />
                Xem
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => router.push(`/admin/pages/${row.original.id}`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Sửa
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => duplicateMutation.mutate(row.original.id)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Nhân bản
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteMutation.mutate(row.original.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Pages" description="Quản lý trang tĩnh">
        <Button asChild>
          <Link href="/admin/pages/new">
            <Plus className="mr-2 h-4 w-4" />
            Tạo trang mới
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm trang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="PUBLISHED">Đã xuất bản</SelectItem>
              <SelectItem value="DRAFT">Nháp</SelectItem>
              <SelectItem value="ARCHIVED">Lưu trữ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={data?.data.data || []}
          pageCount={data?.data.meta.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
