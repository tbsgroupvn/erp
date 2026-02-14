'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { pagesApi, CreatePageDto } from '@/lib/api/cms';
import { PageHeader } from '@/components/shared/page-header';
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
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Editor, SlugInput, SEOFields, MediaPicker } from '@/components/cms';
import { Save, Eye, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';

export default function EditPagePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: page, isLoading } = useQuery({
    queryKey: ['page', id],
    queryFn: () => pagesApi.get(id),
  });

  const [formData, setFormData] = useState<CreatePageDto | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  useEffect(() => {
    if (page?.data) {
      setFormData({
        slug: page.data.slug,
        title: page.data.title,
        content: page.data.content,
        excerpt: page.data.excerpt || '',
        metaTitle: page.data.metaTitle || '',
        metaDescription: page.data.metaDescription || '',
        metaKeywords: page.data.metaKeywords || [],
        featuredImage: page.data.featuredImage || '',
        status: page.data.status,
        template: page.data.template || 'default',
      });
    }
  }, [page]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreatePageDto>) => pagesApi.update(id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật trang thành công');
      router.push('/cms/pages');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật trang');
    },
  });

  const handleSubmit = (status: 'DRAFT' | 'PUBLISHED') => {
    if (!formData) return;
    updateMutation.mutate({ ...formData, status });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground">Không tìm thấy trang</p>
        <Button asChild>
          <Link href="/cms/pages">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Chỉnh sửa trang"
        description={`Chỉnh sửa: ${page?.data.title || ''}`}
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            asChild
          >
            <Link href="/cms/pages">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit('DRAFT')}
            disabled={updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Lưu nháp
          </Button>
          <Button
            onClick={() => handleSubmit('PUBLISHED')}
            disabled={updateMutation.isPending}
          >
            <Eye className="mr-2 h-4 w-4" />
            Xuất bản
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="content" className="space-y-6">
        <TabsList>
          <TabsTrigger value="content">Nội dung</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="settings">Cài đặt</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Tiêu đề *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Nhập tiêu đề trang"
                required
              />
            </div>

            <SlugInput
              title={formData.title}
              slug={formData.slug}
              onSlugChange={(slug) => setFormData({ ...formData, slug })}
            />

            <div className="space-y-2">
              <Label htmlFor="excerpt">Trích dẫn</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                placeholder="Mô tả ngắn về trang này"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Nội dung *</Label>
              <Editor
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                placeholder="Nhập nội dung trang..."
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <Label>Ảnh đại diện</Label>
            {formData.featuredImage ? (
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <Image
                  src={formData.featuredImage}
                  alt="Featured"
                  fill
                  className="object-cover"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setFormData({ ...formData, featuredImage: '' })}
                >
                  Xóa
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setMediaPickerOpen(true)}>
                Chọn ảnh
              </Button>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <SEOFields
            metaTitle={formData.metaTitle || ''}
            metaDescription={formData.metaDescription || ''}
            metaKeywords={formData.metaKeywords || []}
            onMetaTitleChange={(value) =>
              setFormData({ ...formData, metaTitle: value })
            }
            onMetaDescriptionChange={(value) =>
              setFormData({ ...formData, metaDescription: value })
            }
            onMetaKeywordsChange={(value) =>
              setFormData({ ...formData, metaKeywords: value })
            }
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select
                value={formData.template}
                onValueChange={(value) =>
                  setFormData({ ...formData, template: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Mặc định</SelectItem>
                  <SelectItem value="full-width">Full Width</SelectItem>
                  <SelectItem value="sidebar">Có Sidebar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Trạng thái</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, status: value })
                }
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
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <MediaPicker
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        onSelect={(media) => setFormData({ ...formData, featuredImage: media.url })}
        type="IMAGE"
      />
    </div>
  );
}
