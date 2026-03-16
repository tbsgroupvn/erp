'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogCategoriesApi, BlogCategory, CreateBlogCategoryDto } from '@/lib/api/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, FolderTree } from 'lucide-react';
import { toast } from 'sonner';

export default function BlogCategoriesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => blogCategoriesApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: blogCategoriesApi.create,
    onSuccess: () => {
      toast.success('Đã tạo danh mục thành công');
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Không thể tạo danh mục');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBlogCategoryDto> }) =>
      blogCategoriesApi.update(id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật danh mục thành công');
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Không thể cập nhật danh mục');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: blogCategoriesApi.delete,
    onSuccess: () => {
      toast.success('Đã xóa danh mục thành công');
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
    },
    onError: () => {
      toast.error('Không thể xóa danh mục');
    },
  });

  const categories = categoriesData?.data?.data || [];

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '' });
    setEditingCategory(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (category: BlogCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Danh mục Blog</h1>
          <p className="mt-2 text-slate-600">Quản lý danh mục cho bài viết blog</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Tạo danh mục
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Sửa danh mục' : 'Tạo danh mục mới'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Tên danh mục</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Mô tả</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Hủy
                </Button>
                <Button type="submit">
                  {editingCategory ? 'Cập nhật' : 'Tạo mới'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Danh sách danh mục ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-48 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-8 w-8 bg-slate-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có danh mục nào</p>
              <Button className="mt-4 cursor-pointer" onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Tạo danh mục đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category: BlogCategory) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <FolderTree className="h-5 w-5 text-purple-500" />
                      <h3 className="font-semibold text-slate-900">
                        {category.name}
                      </h3>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {category._count?.posts || 0} bài viết
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 ml-8">
                      /{category.slug}
                    </p>
                    {category.description && (
                      <p className="text-sm text-slate-500 mt-1 ml-8">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(category)}
                      className="cursor-pointer hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 cursor-pointer"
                      onClick={() => {
                        if (confirm(`Xóa danh mục "${category.name}"?`)) {
                          deleteMutation.mutate(category.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
