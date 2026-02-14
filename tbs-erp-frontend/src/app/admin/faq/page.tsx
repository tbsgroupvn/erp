'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { faqApi } from '@/lib/api/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MessageSquare
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function FAQPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '',
    isPublished: true,
  });

  // Fetch FAQs from API
  const { data: faqsData, isLoading } = useQuery({
    queryKey: ['faq', { search }],
    queryFn: () => faqApi.getAll({
      search: search || undefined,
      limit: 100
    }),
  });

  const faqs = faqsData?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: faqApi.create,
    onSuccess: () => {
      toast.success('Đã tạo câu hỏi thành công');
      queryClient.invalidateQueries({ queryKey: ['faq'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Không thể tạo câu hỏi');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      faqApi.update(id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật câu hỏi thành công');
      queryClient.invalidateQueries({ queryKey: ['faq'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Không thể cập nhật câu hỏi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: faqApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa câu hỏi thành công');
      queryClient.invalidateQueries({ queryKey: ['faq'] });
    },
    onError: () => {
      toast.error('Không thể xóa câu hỏi');
    },
  });

  const publishMutation = useMutation({
    mutationFn: faqApi.publish,
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái');
      queryClient.invalidateQueries({ queryKey: ['faq'] });
    },
    onError: () => {
      toast.error('Không thể cập nhật trạng thái');
    },
  });

  const resetForm = () => {
    setFormData({ question: '', answer: '', category: '', isPublished: true });
    setEditingFAQ(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question || !formData.answer) {
      toast.error('Vui lòng nhập đầy đủ câu hỏi và câu trả lời');
      return;
    }

    if (editingFAQ) {
      updateMutation.mutate({ id: editingFAQ.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (faq: any) => {
    setEditingFAQ(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '',
      isPublished: faq.isPublished,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string, question: string) => {
    if (confirm(`Xóa câu hỏi "${question}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* FAQ Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {editingFAQ ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="category">Danh mục</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="VD: Vận chuyển, Thanh toán, ..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="question">Câu hỏi *</Label>
              <Textarea
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Nhập câu hỏi..."
                rows={3}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="answer">Câu trả lời *</Label>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                placeholder="Nhập câu trả lời..."
                rows={6}
                className="mt-1"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="cursor-pointer"
              />
              <Label htmlFor="isPublished" className="cursor-pointer">Xuất bản ngay</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="cursor-pointer"
              >
                Hủy
              </Button>
              <Button type="submit" className="cursor-pointer" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingFAQ ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">FAQ</h1>
          <p className="mt-2 text-slate-600">
            Câu hỏi thường gặp
          </p>
        </div>
        <Button className="cursor-pointer" onClick={handleOpenDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm câu hỏi mới
        </Button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-slate-200">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-8 w-20 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-sm text-slate-600">Tổng số câu hỏi</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{faqs.length}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-sm text-slate-600">Đã xuất bản</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {faqs.filter(f => f.isPublished).length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-sm text-slate-600">Nháp</p>
              <p className="text-2xl font-bold text-slate-600 mt-2">
                {faqs.filter(f => !f.isPublished).length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-sm text-slate-600">Lượt xem</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {faqs.reduce((sum, f) => sum + f.views, 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Tìm kiếm câu hỏi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* FAQ List */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Danh sách câu hỏi ({faqs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-20 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-5 w-24 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                    <div className="h-6 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có câu hỏi nào</p>
              <Button className="mt-4 cursor-pointer" onClick={handleOpenDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Tạo câu hỏi đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200"
                >
                  <div className="p-4 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="border-purple-200 text-purple-700">{faq.category}</Badge>
                          {faq.isPublished ? (
                            <Badge variant="default" className="bg-green-100 text-green-700">
                              <Eye className="h-3 w-3 mr-1" />
                              Đã xuất bản
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Nháp
                            </Badge>
                          )}
                          <span className="text-xs text-slate-500">
                            {faq.views} lượt xem
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                          className="text-left w-full cursor-pointer"
                        >
                          <h3 className="font-semibold text-slate-900 mb-2 hover:text-purple-600 transition-colors duration-200">
                            {faq.question}
                          </h3>
                        </button>
                        {expandedId === faq.id && (
                          <p className="text-sm text-slate-600 mt-2 p-3 bg-slate-50 rounded">
                            {faq.answer}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                          className="cursor-pointer"
                        >
                          {expandedId === faq.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => handleEdit(faq)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 cursor-pointer"
                          onClick={() => handleDelete(faq.id, faq.question)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">
                💡 Mẹo quản lý FAQ
              </h3>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Nhóm câu hỏi theo danh mục để dễ tìm kiếm</li>
                <li>• Cập nhật câu trả lời khi có thông tin mới</li>
                <li>• Dựa vào số lượt xem để biết câu hỏi nào quan trọng</li>
                <li>• Viết câu trả lời ngắn gọn, dễ hiểu</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
