'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blogPostsApi, blogCategoriesApi, BlogPost, BlogCategory, CreateBlogPostDto } from '@/lib/api/cms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Save, Trash2, Upload, Eye, Calendar, User, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MediaPicker } from '@/components/cms/media-picker';
import { Media } from '@/lib/api/cms';

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const postId = params.id as string;

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    featuredImage: '',
    categoryId: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [] as string[],
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Fetch post data
  const { data: postData, isLoading: postLoading } = useQuery({
    queryKey: ['blog-post', postId],
    queryFn: () => blogPostsApi.getById(postId),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => blogCategoriesApi.getAll(),
  });

  // Pre-fill form when data loads
  useEffect(() => {
    if (postData?.data?.data) {
      const post = postData.data.data;
      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        content: post.content || '',
        excerpt: post.excerpt || '',
        featuredImage: post.featuredImage || '',
        categoryId: post.categoryId || '',
        metaTitle: post.metaTitle || '',
        metaDescription: post.metaDescription || '',
        metaKeywords: post.metaKeywords || [],
        status: post.status || 'DRAFT',
      });
    }
  }, [postData]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateBlogPostDto>) => blogPostsApi.update(postId, data),
    onSuccess: () => {
      toast.success('Đã cập nhật bài viết thành công!');
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      queryClient.invalidateQueries({ queryKey: ['blog-post', postId] });
      router.push('/admin/blog/posts');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật bài viết');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => blogPostsApi.delete(postId),
    onSuccess: () => {
      toast.success('Đã xóa bài viết');
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      router.push('/admin/blog/posts');
    },
    onError: () => {
      toast.error('Không thể xóa bài viết');
    },
  });

  const categories = categoriesData?.data?.data || [];

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      setFormData(prev => ({
        ...prev,
        metaKeywords: [...prev.metaKeywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setFormData(prev => ({
      ...prev,
      metaKeywords: prev.metaKeywords.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    if (!formData.title) {
      toast.error('Vui lòng nhập tiêu đề bài viết');
      return;
    }
    if (!formData.content) {
      toast.error('Vui lòng nhập nội dung bài viết');
      return;
    }

    updateMutation.mutate({
      ...formData,
      status,
    });
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc muốn xóa bài viết này?')) {
      deleteMutation.mutate();
    }
  };

  if (postLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-slate-200 rounded animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-4 w-48 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="h-10 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-10 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-64 bg-slate-200 rounded animate-pulse"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCategory = categories.find((cat: BlogCategory) => cat.id === formData.categoryId);

  return (
    <>
      {/* Media Picker */}
      <MediaPicker
        open={isMediaPickerOpen}
        onOpenChange={setIsMediaPickerOpen}
        onSelect={(media: Media) => handleChange('featuredImage', media.url)}
        type="IMAGE"
      />

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Xem trước bài viết</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Featured Image */}
            {formData.featuredImage && (
              <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                <img
                  src={formData.featuredImage}
                  alt={formData.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Category & Meta */}
            <div className="flex items-center gap-4 text-sm text-slate-600">
              {selectedCategory && (
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                  {selectedCategory.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {postData?.data?.data?.createdAt
                  ? format(new Date(postData.data.data.createdAt), 'dd/MM/yyyy', { locale: vi })
                  : format(new Date(), 'dd/MM/yyyy', { locale: vi })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {postData?.data?.data?.author?.fullName || 'Admin'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-slate-900">
              {formData.title || 'Tiêu đề bài viết'}
            </h1>

            {/* Excerpt */}
            {formData.excerpt && (
              <p className="text-lg text-slate-600 italic border-l-4 border-purple-500 pl-4">
                {formData.excerpt}
              </p>
            )}

            {/* Content */}
            <div className="prose prose-slate max-w-none">
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {formData.content || 'Nội dung bài viết sẽ hiển thị ở đây...'}
              </div>
            </div>

            {/* Keywords */}
            {formData.metaKeywords.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Từ khóa:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.metaKeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/blog/posts">
            <Button variant="ghost" size="icon" className="cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Chỉnh sửa bài viết</h1>
            <p className="mt-1 text-slate-600">Cập nhật nội dung bài viết</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsPreviewOpen(true)}
            className="cursor-pointer"
          >
            <Eye className="mr-2 h-4 w-4" />
            Xem trước
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="cursor-pointer text-red-600 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit('DRAFT')}
            disabled={updateMutation.isPending}
            className="cursor-pointer"
          >
            <Save className="mr-2 h-4 w-4" />
            Lưu nháp
          </Button>
          <Button
            onClick={() => handleSubmit('PUBLISHED')}
            disabled={updateMutation.isPending}
            className="cursor-pointer"
          >
            {updateMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật & Xuất bản'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Nội dung chính</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Tiêu đề bài viết *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Nhập tiêu đề bài viết..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  placeholder="url-bai-viet"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL: /blog/{formData.slug || 'url-bai-viet'}
                </p>
              </div>

              <div>
                <Label htmlFor="excerpt">Tóm tắt</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => handleChange('excerpt', e.target.value)}
                  placeholder="Tóm tắt ngắn gọn về bài viết (150-200 ký tự)..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="content">Nội dung bài viết *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  placeholder="Viết nội dung bài viết của bạn ở đây..."
                  rows={20}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Hỗ trợ định dạng Markdown cơ bản
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO & Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="metaTitle">Meta Title</Label>
                <Input
                  id="metaTitle"
                  value={formData.metaTitle}
                  onChange={(e) => handleChange('metaTitle', e.target.value)}
                  placeholder="Tiêu đề SEO (60-70 ký tự)"
                  className="mt-1"
                  maxLength={70}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {formData.metaTitle.length}/70 ký tự
                </p>
              </div>

              <div>
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  value={formData.metaDescription}
                  onChange={(e) => handleChange('metaDescription', e.target.value)}
                  placeholder="Mô tả SEO (150-160 ký tự)"
                  rows={3}
                  className="mt-1"
                  maxLength={160}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {formData.metaDescription.length}/160 ký tự
                </p>
              </div>

              <div>
                <Label htmlFor="keywords">Meta Keywords</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="keywords"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    placeholder="Nhập từ khóa và Enter"
                  />
                  <Button
                    type="button"
                    onClick={handleAddKeyword}
                    variant="outline"
                    className="cursor-pointer"
                  >
                    Thêm
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.metaKeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => handleRemoveKeyword(index)}
                        className="hover:text-purple-900 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Featured Image */}
          <Card>
            <CardHeader>
              <CardTitle>Ảnh đại diện</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featuredImage ? (
                <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
                  <img
                    src={formData.featuredImage}
                    alt="Featured"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleChange('featuredImage', '')}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="aspect-video bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400">
                  <Upload className="h-8 w-8 mb-2" />
                  <p className="text-sm">Chưa có ảnh</p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer"
                onClick={() => setIsMediaPickerOpen(true)}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Chọn từ thư viện
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Hoặc</span>
                </div>
              </div>
              <Input
                type="url"
                value={formData.featuredImage}
                onChange={(e) => handleChange('featuredImage', e.target.value)}
                placeholder="Nhập URL ảnh"
              />
              <p className="text-xs text-slate-500">
                Kích thước khuyến nghị: 1200×630px
              </p>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle>Danh mục</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.categoryId || undefined}
                onValueChange={(value) => handleChange('categoryId', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục (Tùy chọn)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không có danh mục</SelectItem>
                  {categories.map((cat: BlogCategory) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Publish Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Trạng thái</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.status}
                onValueChange={(value: any) => handleChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Nháp</SelectItem>
                  <SelectItem value="PUBLISHED">Đã xuất bản</SelectItem>
                  <SelectItem value="ARCHIVED">Lưu trữ</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
