'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { newsletterApi } from '@/lib/api/cms';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Search,
  Download,
  Trash2,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { format, isToday, isThisWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Pagination } from '@/components/shared/pagination';
import { BADGE_COLORS } from '@/lib/constants/colors';

export default function NewsletterPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const itemsPerPage = 20;

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Fetch subscribers from API
  const { data: subscribersData, isLoading } = useQuery({
    queryKey: ['newsletter', { search, page }],
    queryFn: () => newsletterApi.getAll({
      search: search || undefined,
      limit: itemsPerPage,
      page: page,
    }),
  });

  const subscribers = subscribersData?.data?.data || [];
  const totalItems = subscribersData?.data?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const deleteMutation = useMutation({
    mutationFn: newsletterApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa người đăng ký');
      queryClient.invalidateQueries({ queryKey: ['newsletter'] });
    },
    onError: () => {
      toast.error('Không thể xóa người đăng ký');
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.info('Đang xuất danh sách email...');
      await newsletterApi.exportToExcel();
      toast.success('Đã xuất danh sách email thành công');
    } catch (error) {
      toast.error('Không thể xuất danh sách email');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = (id: string, email: string) => {
    if (confirm(`Xóa người đăng ký "${email}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Newsletter</h1>
          <p className="mt-2 text-slate-600">
            Quản lý danh sách đăng ký nhận tin
          </p>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className={`mr-2 h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
          {isExporting ? 'Đang xuất...' : 'Xuất Email List'}
        </Button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-8 w-16 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-8 w-8 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tổng số</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{subscribers.length}</p>
                </div>
                <Mail className="h-8 w-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Đang hoạt động</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {subscribers.filter(s => s.status === 'ACTIVE').length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Hôm nay</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">
                    {subscribers.filter(s => isToday(new Date(s.createdAt))).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Tuần này</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">
                    {subscribers.filter(s => isThisWeek(new Date(s.createdAt), { weekStartsOn: 1 })).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Tìm kiếm theo email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Subscribers List */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Danh sách đăng ký ({subscribers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
                  <div className="h-4 w-4 bg-slate-200 rounded animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-3 w-32 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-6 w-20 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-8 w-8 bg-slate-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : subscribers.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có người đăng ký</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-900">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900">Trạng thái</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-900">Ngày đăng ký</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-900">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors duration-200">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{subscriber.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={subscriber.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={subscriber.status === 'ACTIVE' ? BADGE_COLORS.ACTIVE : BADGE_COLORS.INACTIVE}
                        >
                          {subscriber.status === 'ACTIVE' ? 'Hoạt động' : 'Hủy'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {format(new Date(subscriber.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 cursor-pointer"
                          onClick={() => handleDelete(subscriber.id, subscriber.email)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Xóa người đăng ký: ${subscriber.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="bg-purple-100 text-purple-600 rounded-lg p-3 h-fit">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">
                💡 Mẹo tăng số lượng đăng ký
              </h3>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Đặt form đăng ký ở vị trí dễ thấy trên website</li>
                <li>• Cung cấp incentive (giảm giá, ebook miễn phí) cho người đăng ký</li>
                <li>• Gửi email đều đặn với nội dung chất lượng</li>
                <li>• Tôn trọng quyền riêng tư và cho phép hủy đăng ký dễ dàng</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
        itemLabel="đăng ký"
      />
    </div>
  );
}
