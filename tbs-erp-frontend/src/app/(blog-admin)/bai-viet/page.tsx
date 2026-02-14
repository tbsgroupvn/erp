'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  FileText,
  CheckCircle2,
  XCircle,
  Archive,
} from 'lucide-react';
import { useBlogPosts, useDeleteBlogPost } from '@/lib/hooks/use-blog-posts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function BlogAdminListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useBlogPosts({
    search: search || undefined,
    status: status === 'all' ? undefined : (status as any),
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: 100,
  });

  const deleteMutation = useDeleteBlogPost();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          setDeleteId(null);
        },
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Đã xuất bản
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="secondary">
            <FileText className="mr-1 h-3 w-3" />
            Bản nháp
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="outline">
            <Archive className="mr-1 h-3 w-3" />
            Lưu trữ
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Quản lý bài viết</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tạo và quản lý các bài viết blog
          </p>
        </div>
        <Button size="lg" onClick={() => router.push('/bai-viet/tao-moi')}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo bài viết mới
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm kiếm bài viết..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="published">Đã xuất bản</SelectItem>
                <SelectItem value="draft">Bản nháp</SelectItem>
                <SelectItem value="archived">Lưu trữ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Danh sách bài viết ({data?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 w-32" />
                  <Skeleton className="h-12 w-32" />
                  <Skeleton className="h-12 w-24" />
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-medium text-slate-900">
                Chưa có bài viết
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Bắt đầu bằng cách tạo bài viết đầu tiên của bạn
              </p>
              <Button className="mt-4" onClick={() => router.push('/bai-viet/tao-moi')}>
                <Plus className="mr-2 h-4 w-4" />
                Tạo bài viết mới
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Tác giả</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày xuất bản</TableHead>
                    <TableHead className="text-right">Lượt xem</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium text-slate-900">
                            {post.title}
                          </div>
                          {post.excerpt && (
                            <div className="mt-1 line-clamp-1 text-sm text-slate-600">
                              {post.excerpt}
                            </div>
                          )}
                          {post.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {post.tags.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{post.author.name}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(post.status)}</TableCell>
                      <TableCell>
                        {post.publishedAt ? (
                          <div className="text-sm">
                            {format(new Date(post.publishedAt), 'dd/MM/yyyy', {
                              locale: vi,
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">Chưa xuất bản</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
                          <Eye className="h-3 w-3" />
                          {post.viewCount || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => window.open(`/tin-tuc/${post.slug}`, '_blank')}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Xem bài viết
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/bai-viet/${post.id}/chinh-sua`)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(post.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
