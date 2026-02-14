'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogCommentsApi, BlogComment } from '@/lib/api/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function BlogCommentsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('PENDING');

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['blog-comments', { status }],
    queryFn: () =>
      blogCommentsApi.getAll({
        status: status !== 'all' ? (status as any) : undefined,
        limit: 100,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: blogCommentsApi.approve,
    onSuccess: () => {
      toast.success('Đã duyệt bình luận');
      queryClient.invalidateQueries({ queryKey: ['blog-comments'] });
    },
    onError: () => {
      toast.error('Không thể duyệt bình luận');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: blogCommentsApi.reject,
    onSuccess: () => {
      toast.success('Đã từ chối bình luận');
      queryClient.invalidateQueries({ queryKey: ['blog-comments'] });
    },
    onError: () => {
      toast.error('Không thể từ chối bình luận');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: blogCommentsApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa bình luận');
      queryClient.invalidateQueries({ queryKey: ['blog-comments'] });
    },
    onError: () => {
      toast.error('Không thể xóa bình luận');
    },
  });

  const comments = commentsData?.data?.data || [];

  const getStatusBadge = (status: string) => {
    const config = {
      PENDING: { label: 'Chờ duyệt', className: 'bg-yellow-100 text-yellow-700' },
      APPROVED: { label: 'Đã duyệt', className: 'bg-green-100 text-green-700' },
      REJECTED: { label: 'Từ chối', className: 'bg-red-100 text-red-700' },
    };
    const { label, className } = config[status as keyof typeof config] || config.PENDING;
    return <Badge className={className}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bình luận Blog</h1>
          <p className="mt-2 text-slate-600">Kiểm duyệt và quản lý bình luận</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="PENDING">Chờ duyệt</SelectItem>
            <SelectItem value="APPROVED">Đã duyệt</SelectItem>
            <SelectItem value="REJECTED">Từ chối</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Danh sách bình luận ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-5 w-32 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-5 w-20 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                    <div className="h-4 w-48 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                    <div className="flex gap-2 mt-3">
                      <div className="h-8 w-20 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-8 w-20 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Không có bình luận nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment: BlogComment) => (
                <div
                  key={comment.id}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {comment.authorName}
                        </p>
                        <p className="text-sm text-slate-600">
                          {comment.authorEmail}
                        </p>
                      </div>
                      {getStatusBadge(comment.status)}
                    </div>
                    <p className="text-xs text-slate-500">
                      {format(new Date(comment.createdAt), 'dd/MM/yyyy HH:mm', {
                        locale: vi,
                      })}
                    </p>
                  </div>

                  {comment.post && (
                    <p className="text-sm text-slate-600 mb-2">
                      Bài viết: <span className="font-medium text-slate-900">{comment.post.title}</span>
                    </p>
                  )}

                  <p className="text-slate-700 mb-4">{comment.content}</p>

                  <div className="flex gap-2">
                    {comment.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50 cursor-pointer"
                          onClick={() => approveMutation.mutate(comment.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 cursor-pointer"
                          onClick={() => rejectMutation.mutate(comment.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Từ chối
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 cursor-pointer"
                      onClick={() => deleteMutation.mutate(comment.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa
                    </Button>
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
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">
                💡 Mẹo kiểm duyệt bình luận
              </h3>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Kiểm duyệt bình luận trong vòng 24 giờ để tăng tương tác</li>
                <li>• Từ chối các bình luận spam hoặc không phù hợp</li>
                <li>• Trả lời bình luận để tạo sự gắn kết với độc giả</li>
                <li>• Xem xét kỹ trước khi xóa vĩnh viễn</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
