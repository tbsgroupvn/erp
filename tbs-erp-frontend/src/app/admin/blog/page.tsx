'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { blogPostsApi, blogCategoriesApi, blogCommentsApi } from '@/lib/api/cms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  FolderTree,
  MessageSquare,
  Plus,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function BlogDashboard() {
  // Fetch blog stats
  const { data: postsData } = useQuery({
    queryKey: ['blog-posts-stats'],
    queryFn: () => blogPostsApi.getAll({ limit: 1000 }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['blog-categories-stats'],
    queryFn: () => blogCategoriesApi.getAll(),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['blog-comments-stats'],
    queryFn: () => blogCommentsApi.getAll({ status: 'PENDING', limit: 1000 }),
  });

  const postsCount = postsData?.data?.data?.length || 0;
  const categoriesCount = categoriesData?.data?.data?.length || 0;
  const pendingCommentsCount = commentsData?.data?.data?.length || 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Quản lý Blog</h1>
        <p className="mt-2 text-slate-600">
          Quản lý danh mục, bài viết và bình luận blog
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/admin/blog/categories">
          <Card className="transition-all hover:shadow-lg cursor-pointer border-2 hover:border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">
                    Danh mục Blog
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {categoriesCount}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Phân loại bài viết
                  </p>
                </div>
                <div className="bg-purple-50 text-purple-600 rounded-lg p-3">
                  <FolderTree className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/blog/posts">
          <Card className="transition-all hover:shadow-lg cursor-pointer border-2 hover:border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">
                    Bài viết
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {postsCount}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Tổng số bài viết
                  </p>
                </div>
                <div className="bg-blue-50 text-blue-600 rounded-lg p-3">
                  <BookOpen className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/blog/comments">
          <Card className="transition-all hover:shadow-lg cursor-pointer border-2 hover:border-green-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">
                    Bình luận
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {pendingCommentsCount}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Chờ kiểm duyệt
                  </p>
                </div>
                <div className="bg-green-50 text-green-600 rounded-lg p-3">
                  <MessageSquare className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Thao tác nhanh</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/admin/blog/categories">
            <Card className="transition-all hover:shadow-md cursor-pointer h-full">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-50 text-purple-600 rounded-lg p-3">
                    <FolderTree className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      Quản lý Danh mục
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-1" />
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Tạo và tổ chức danh mục blog
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/blog/posts">
            <Card className="transition-all hover:shadow-md cursor-pointer h-full">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 text-blue-600 rounded-lg p-3">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      Viết bài mới
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Tạo bài viết blog mới
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/blog/comments">
            <Card className="transition-all hover:shadow-md cursor-pointer h-full">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-green-50 text-green-600 rounded-lg p-3">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      Kiểm duyệt Bình luận
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Xem và duyệt bình luận
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="bg-blue-100 text-blue-600 rounded-lg p-3 h-fit">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">
                💡 Mẹo viết blog hiệu quả
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Sử dụng tiêu đề hấp dẫn và từ khóa SEO</li>
                <li>• Thêm hình ảnh chất lượng cao cho mỗi bài viết</li>
                <li>• Phân loại bài viết vào đúng danh mục</li>
                <li>• Trả lời bình luận để tăng tương tác</li>
                <li>• Xuất bản đều đặn để giữ lượng độc giả</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
