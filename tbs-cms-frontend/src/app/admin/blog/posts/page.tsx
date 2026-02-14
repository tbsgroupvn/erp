'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogPostsApi, blogCategoriesApi, BlogPost, BlogCategory } from '@/lib/api/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import DOMPurify from 'isomorphic-dompurify';
import { Pagination } from '@/components/shared/pagination';
import { BADGE_COLORS } from '@/lib/constants/colors';
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
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, categoryId]);

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['blog-posts', { search, status, categoryId, page }],
    queryFn: () =>
      blogPostsApi.getAll({
        search: search || undefined,
        status: status !== 'all' ? (status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') : undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        limit: itemsPerPage,
        page: page,
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
  const totalItems = postsData?.data?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getStatusBadge = (status: string) => {
    const config = {
      PUBLISHED: { label: 'Đã xuất bản', className: BADGE_COLORS.PUBLISHED },
      DRAFT: { label: 'Nháp', className: BADGE_COLORS.DRAFT },
      ARCHIVED: { label: 'Lưu trữ', className: BADGE_COLORS.ARCHIVED },
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
          onClick={() => router.push('/admin/blog/posts/new')}
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
            aria-label="Tìm kiếm bài viết"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]" aria-label="Lọc theo trạng thái">
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
          <SelectTrigger className="w-[180px]" aria-label="Lọc theo danh mục">
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
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onClick={() => router.push(`/admin/blog/posts/${post.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/admin/blog/posts/${post.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem chi tiết bài viết: ${post.title}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3
                          className="font-semibold text-slate-900 text-lg"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(post.title)
                          }}
                        />
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
                        <div
                          className="text-sm text-slate-600 line-clamp-2"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(post.excerpt)
                          }}
                        />
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        {format(new Date(post.createdAt), 'dd/MM/yyyy HH:mm', {
                          locale: vi,
                        })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer"
                          aria-label={`Thao tác cho bài viết: ${post.title}`}
                        >
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

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
        itemLabel="bài viết"
      />
    </div>
  );
}
