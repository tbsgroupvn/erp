'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
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
import { Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function CreatePagePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreatePageDto>({
    slug: '',
    title: '',
    content: '',
    excerpt: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [],
    featuredImage: '',
    status: 'DRAFT',
    template: 'default',
  });

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: pagesApi.create,
    onSuccess: () => {
      toast.success('Đã tạo trang thành công');
      router.push('/cms/pages');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Không thể tạo trang');
    },
  });

  const handleSubmit = (status: 'DRAFT' | 'PUBLISHED') => {
    createMutation.mutate({ ...formData, status });
  };

  return (
    <div>
      <PageHeader title="Tạo trang mới" description="Tạo trang tĩnh mới">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit('DRAFT')}
            disabled={createMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Lưu nháp
          </Button>
          <Button
            onClick={() => handleSubmit('PUBLISHED')}
            disabled={createMutation.isPending}
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
              <p className="text-sm font-medium leading-none">Nội dung *</p>
              <Editor
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                placeholder="Nhập nội dung trang..."
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <p className="text-sm font-medium leading-none">Ảnh đại diện</p>
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
