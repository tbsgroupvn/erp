'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { pagesApi } from '@/lib/api/cms/pages';
import { mediaApi } from '@/lib/api/cms/media';
import { menusApi } from '@/lib/api/cms/menus';
import {
  FileText,
  Image,
  Menu,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
  BookOpen,
  Mail,
  HelpCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Skeleton component for loading state
const StatCardSkeleton = () => (
  <Card className="border border-slate-200">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-8 w-16 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="h-12 w-12 bg-slate-100 rounded-lg animate-pulse"></div>
      </div>
    </CardContent>
  </Card>
);

export default function CMSDashboard() {
  // Fetch statistics with loading states (only fetch 1 item to get total count)
  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['pages-stats'],
    queryFn: () => pagesApi.list({ limit: 1 }),
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media-stats'],
    queryFn: () => mediaApi.list({ limit: 1 }),
  });

  const { data: menusData, isLoading: menusLoading } = useQuery({
    queryKey: ['menus-stats'],
    queryFn: () => menusApi.listMenus(),
  });

  const isLoading = pagesLoading || mediaLoading || menusLoading;

  const stats = [
    {
      name: 'Tổng số trang',
      value: (pagesData?.data?.data as any)?.meta?.total || 0,
      description: 'Trang tĩnh',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'hover:border-purple-200',
      href: '/admin/pages',
    },
    {
      name: 'Thư viện Media',
      value: (mediaData?.data?.data as any)?.meta?.total || 0,
      description: 'Tệp đa phương tiện',
      icon: Image,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'hover:border-blue-200',
      href: '/admin/media',
    },
    {
      name: 'Menu',
      value: (menusData?.data as any)?.data?.length || 0,
      description: 'Menu điều hướng',
      icon: Menu,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'hover:border-green-200',
      href: '/admin/menus',
    },
  ];

  const recentPages = (pagesData?.data?.data as any)?.data?.slice(0, 5) || [];

  const quickActions = [
    {
      title: 'Tạo trang mới',
      description: 'Thêm trang nội dung mới cho website',
      icon: FileText,
      href: '/admin/pages',
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      hoverBg: 'hover:bg-purple-100',
    },
    {
      title: 'Viết Blog',
      description: 'Tạo bài viết blog mới',
      icon: BookOpen,
      href: '/admin/blog',
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      hoverBg: 'hover:bg-blue-100',
    },
    {
      title: 'Upload Media',
      description: 'Thêm hình ảnh và video',
      icon: Image,
      href: '/admin/media',
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      hoverBg: 'hover:bg-green-100',
    },
    {
      title: 'Quản lý Menu',
      description: 'Cập nhật điều hướng website',
      icon: Menu,
      href: '/admin/menus',
      color: 'orange',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      hoverBg: 'hover:bg-orange-100',
    },
    {
      title: 'Tin nhắn Liên hệ',
      description: 'Xem tin nhắn từ khách hàng',
      icon: Mail,
      href: '/admin/contacts',
      color: 'red',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      hoverBg: 'hover:bg-red-100',
    },
    {
      title: 'FAQ',
      description: 'Quản lý câu hỏi thường gặp',
      icon: HelpCircle,
      href: '/admin/faq',
      color: 'indigo',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
      hoverBg: 'hover:bg-indigo-100',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Chào mừng đến với CMS Manager
        </h1>
        <p className="mt-2 text-slate-600">
          Quản lý nội dung website của bạn một cách dễ dàng và chuyên nghiệp
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-6 md:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.name} href={stat.href} className="cursor-pointer">
                <Card className={`transition-all duration-200 hover:shadow-lg border-2 border-slate-200 ${stat.borderColor}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-600">
                          {stat.name}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {stat.description}
                        </p>
                      </div>
                      <div className={`${stat.bgColor} ${stat.color} rounded-lg p-3 transition-transform duration-200 hover:scale-110`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Thao tác nhanh</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href} className="cursor-pointer">
                <Card className="transition-all duration-200 hover:shadow-md border border-slate-200 hover:border-slate-300 h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`${action.bgColor} ${action.textColor} rounded-lg p-3 transition-all duration-200 ${action.hoverBg}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2 group">
                          {action.title}
                          <ArrowRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-1" />
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Trang gần đây</h2>
          <Link href="/admin/pages">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Xem tất cả
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Card className="border border-slate-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-3 w-32 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                    <div className="h-6 w-20 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : recentPages.length > 0 ? (
          <Card className="border border-slate-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                {recentPages.map((page: any) => (
                  <Link
                    key={page.id}
                    href={`/admin/pages/${page.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-3 px-3 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {page.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(page.updatedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <div>
                      {page.status === 'PUBLISHED' ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          Đã xuất bản
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700">
                          Nháp
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200">
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có trang nào được tạo</p>
              <Button className="mt-4 cursor-pointer" asChild>
                <Link href="/admin/pages">
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo trang đầu tiên
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tips */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="bg-purple-100 text-purple-600 rounded-lg p-3 h-fit">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">
                💡 Mẹo quản lý nội dung
              </h3>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Sử dụng tiêu đề rõ ràng và mô tả SEO cho mỗi trang</li>
                <li>• Tối ưu hóa hình ảnh trước khi upload (sử dụng WebP)</li>
                <li>• Tổ chức nội dung vào các danh mục phù hợp</li>
                <li>• Kiểm tra xem trước trước khi xuất bản</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
