'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogPostsApi, blogCategoriesApi, BlogPost, BlogCategory, BlogPostFilters } from '@/lib/api/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Edit, Trash2, BookOpen, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BlogPostsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['blog-posts', { search, status, categoryId }],
    queryFn: () =>
      blogPostsApi.getAll({
        search: search || undefined,
        status: status !== 'all' ? (status as BlogPostFilters['status']) : undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        limit: 100,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => blogCategoriesApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: blogPostsApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa bài viết thành công');
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
    },
    onError: () => {
      toast.error('Không thể xóa bài viết');
    },
  });

  const posts = postsData?.data?.data || [];
  const categories = categoriesData?.data?.data || [];

  const getStatusBadge = (status: string) => {
    const config = {
      PUBLISHED: { label: 'Đã xuất bản', className: 'bg-green-100 text-green-700' },
      DRAFT: { label: 'Nháp', className: 'bg-yellow-100 text-yellow-700' },
      ARCHIVED: { label: 'Lưu trữ', className: 'bg-gray-100 text-gray-700' },
    };
    const { label, className } = config[status as keyof typeof config] || config.DRAFT;
    return <Badge className={className}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bài viết Blog</h1>
          <p className="mt-2 text-slate-600">Quản lý bài viết blog</p>
        </div>
        <Button
          onClick={() => {
            console.log('Button clicked, navigating to /admin/blog/posts/new');
            router.push('/admin/blog/posts/new');
          }}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Viết bài mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
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
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Danh mục" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {categories.map((cat: BlogCategory) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Danh sách bài viết ({posts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="h-6 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có bài viết nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post: BlogPost) => (
                <div
                  key={post.id}
                  role="button"
                  tabIndex={0}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                  onClick={() => router.push(`/admin/blog/posts/${post.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/admin/blog/posts/${post.id}`); }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {post.title}
                        </h3>
                        {getStatusBadge(post.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        {post.category && (
                          <span className="flex items-center gap-1">
                            <Badge variant="outline">{post.category.name}</Badge>
                          </span>
                        )}
                        {post.author && (
                          <span>Tác giả: {post.author.fullName}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {post.views} lượt xem
                        </span>
                        {post._count && (
                          <span>{post._count.comments} bình luận</span>
                        )}
                      </div>
                      {post.excerpt && (
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        {format(new Date(post.createdAt), 'dd/MM/yyyy HH:mm', {
                          locale: vi,
                        })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/blog/posts/${post.id}`)}
                          className="cursor-pointer"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(post.id)}
                          className="text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
