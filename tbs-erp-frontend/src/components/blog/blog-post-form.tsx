'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Calendar, Image as ImageIcon, Tag, FileText, Save, Eye } from 'lucide-react';
import { RichTextEditor } from './rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { BlogPost } from '@/lib/api/blog';

const blogPostSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc').max(200, 'Tiêu đề quá dài'),
  slug: z
    .string()
    .min(1, 'Slug là bắt buộc')
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ chứa chữ thường, số và dấu gạch ngang'),
  excerpt: z.string().max(500, 'Mô tả ngắn quá dài').optional(),
  content: z.string().min(1, 'Nội dung là bắt buộc'),
  coverImage: z.string().url('URL ảnh không hợp lệ').optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published']),
  publishedAt: z.string().optional(),
});

type BlogPostFormValues = z.infer<typeof blogPostSchema>;

interface BlogPostFormProps {
  initialData?: BlogPost;
  onSubmit: (data: BlogPostFormValues) => void;
  isSubmitting?: boolean;
}

export function BlogPostForm({
  initialData,
  onSubmit,
  isSubmitting,
}: BlogPostFormProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialData?.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BlogPostFormValues>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      excerpt: initialData?.excerpt || '',
      content: initialData?.content || '',
      coverImage: initialData?.coverImage || '',
      tags: initialData?.tags || [],
      status: initialData?.status === 'published' ? 'published' : 'draft',
      publishedAt: initialData?.publishedAt || new Date().toISOString(),
    },
  });

  const title = watch('title');
  const slug = watch('slug');

  // Auto-generate slug from title
  useEffect(() => {
    if (title && !initialData) {
      const generatedSlug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setValue('slug', generatedSlug);
    }
  }, [title, setValue, initialData]);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag];
      setTags(newTags);
      setValue('tags', newTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    setValue('tags', newTags);
  };

  const handleFormSubmit = (data: BlogPostFormValues) => {
    onSubmit({
      ...data,
      content,
      tags,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Thông tin cơ bản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">
                  Tiêu đề <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="Nhập tiêu đề bài viết"
                  className="mt-1"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="slug">
                  Slug (URL) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  {...register('slug')}
                  placeholder="bai-viet-cua-toi"
                  className="mt-1 font-mono text-sm"
                />
                {slug && (
                  <p className="mt-1 text-xs text-slate-500">
                    URL: /tin-tuc/{slug}
                  </p>
                )}
                {errors.slug && (
                  <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="excerpt">Mô tả ngắn</Label>
                <Textarea
                  id="excerpt"
                  {...register('excerpt')}
                  placeholder="Tóm tắt ngắn gọn nội dung bài viết (tùy chọn)"
                  rows={3}
                  className="mt-1"
                />
                {errors.excerpt && (
                  <p className="mt-1 text-sm text-red-600">{errors.excerpt.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content Editor Card */}
          <Card>
            <CardHeader>
              <CardTitle>
                Nội dung <span className="text-red-500">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={content}
                onChange={(value) => {
                  setContent(value);
                  setValue('content', value);
                }}
              />
              {errors.content && (
                <p className="mt-2 text-sm text-red-600">{errors.content.message}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish Card */}
          <Card>
            <CardHeader>
              <CardTitle>Xuất bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Trạng thái</Label>
                <Select
                  defaultValue={watch('status')}
                  onValueChange={(value) => setValue('status', value as any)}
                >
                  <SelectTrigger id="status" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Bản nháp</SelectItem>
                    <SelectItem value="published">Xuất bản</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="publishedAt">Ngày xuất bản</Label>
                <Input
                  id="publishedAt"
                  type="datetime-local"
                  {...register('publishedAt')}
                  className="mt-1"
                />
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Đang lưu...' : 'Lưu bài viết'}
                </Button>
                {initialData && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(`/tin-tuc/${slug}`, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
            </CardContent>
          </Card>

          {/* Cover Image Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Ảnh bìa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="coverImage">URL ảnh bìa</Label>
                <Input
                  id="coverImage"
                  {...register('coverImage')}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1"
                />
                {errors.coverImage && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.coverImage.message}
                  </p>
                )}
                {watch('coverImage') && (
                  <div className="mt-3 overflow-hidden rounded-lg border">
                    <img
                      src={watch('coverImage')}
                      alt="Preview"
                      className="h-auto w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tags Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Thêm tag..."
                  />
                  <Button type="button" onClick={handleAddTag} variant="outline">
                    Thêm
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
