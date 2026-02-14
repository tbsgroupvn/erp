'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api/cms';
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
  Mail,
  Phone,
  Calendar,
  Eye,
  Trash2,
  Search,
  Download,
  CheckCircle,
  Reply
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import { Pagination } from '@/components/shared/pagination';
import { BADGE_COLORS } from '@/lib/constants/colors';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;
  const queryClient = useQueryClient();

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // Fetch contacts from API
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts', { search, status, page }],
    queryFn: () => contactsApi.getAll({
      search: search || undefined,
      status: status !== 'all' ? (status as 'NEW' | 'READ' | 'REPLIED') : undefined,
      limit: itemsPerPage,
      page: page,
    }),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['contacts-stats'],
    queryFn: () => contactsApi.getStats(),
  });

  const markAsReadMutation = useMutation({
    mutationFn: contactsApi.markAsRead,
    onSuccess: () => {
      toast.success('Đã đánh dấu là đã đọc');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-stats'] });
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });

  const markAsRepliedMutation = useMutation({
    mutationFn: contactsApi.markAsReplied,
    onSuccess: () => {
      toast.success('Đã đánh dấu là đã trả lời');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-stats'] });
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contactsApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa tin nhắn');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-stats'] });
    },
    onError: () => {
      toast.error('Không thể xóa tin nhắn');
    },
  });

  const contacts = contactsData?.data?.data || [];
  const stats = statsData?.data?.data;
  const totalItems = contactsData?.data?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.info('Đang xuất danh sách liên hệ...');
      await contactsApi.exportToExcel();
      toast.success('Đã xuất danh sách liên hệ thành công');
    } catch (error) {
      toast.error('Không thể xuất danh sách liên hệ');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      NEW: { label: 'Mới', className: BADGE_COLORS.NEW },
      READ: { label: 'Đã đọc', className: BADGE_COLORS.READ },
      REPLIED: { label: 'Đã trả lời', className: BADGE_COLORS.REPLIED },
    };
    const { label, className } = config[status as keyof typeof config] || config.NEW;
    return <Badge className={className}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Liên hệ</h1>
          <p className="mt-2 text-slate-600">
            Quản lý tin nhắn liên hệ từ khách hàng
          </p>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className={`mr-2 h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
          {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tổng số</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.total || 0}</p>
              </div>
              <Mail className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Chưa đọc</p>
                <p className="text-2xl font-bold text-blue-700">{stats?.unread || 0}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Hôm nay</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.today || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tuần này</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.week || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm kiếm theo tên, email, số điện thoại..."
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
            <SelectItem value="NEW">Mới</SelectItem>
            <SelectItem value="READ">Đã đọc</SelectItem>
            <SelectItem value="REPLIED">Đã trả lời</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contact List */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Danh sách liên hệ ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-48 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-3 w-32 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-3 w-full bg-slate-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có tin nhắn liên hệ nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">
                          {contact.name}
                        </h3>
                        {getStatusBadge(contact.status)}
                      </div>
                      <div className="space-y-1 text-sm text-slate-600 mb-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{contact.email}</span>
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                      <p className="font-medium text-slate-900 mb-2">
                        {contact.subject}
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {contact.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(contact.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {contact.status === 'NEW' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsReadMutation.mutate(contact.id)}
                          disabled={markAsReadMutation.isPending}
                          className="cursor-pointer"
                          title="Đánh dấu đã đọc"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {(contact.status === 'NEW' || contact.status === 'READ') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsRepliedMutation.mutate(contact.id)}
                          disabled={markAsRepliedMutation.isPending}
                          className="cursor-pointer text-green-600 hover:text-green-700"
                          title="Đánh dấu đã trả lời"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(contact.id)}
                        disabled={deleteMutation.isPending}
                        className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="bg-purple-100 text-purple-600 rounded-lg p-3 h-fit">
              <Reply className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">
                💡 Mẹo quản lý tin nhắn
              </h3>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Trả lời tin nhắn trong vòng 24 giờ để tạo ấn tượng tốt</li>
                <li>• Sử dụng template email để tiết kiệm thời gian</li>
                <li>• Đánh dấu trạng thái để theo dõi tiến độ</li>
                <li>• Export Excel để phân tích xu hướng liên hệ</li>
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
        itemLabel="liên hệ"
      />
    </div>
  );
}
