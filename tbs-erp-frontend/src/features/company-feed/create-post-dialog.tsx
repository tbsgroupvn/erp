'use client';

import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCreatePost } from '@/lib/hooks/use-company-feed';
import type { PostCategory, CreatePostPayload } from '@/lib/types/company-feed.types';
import { POST_CATEGORY_LABELS } from '@/lib/types/company-feed.types';

const CATEGORIES: PostCategory[] = ['NEWS', 'PROCESS', 'EVENT', 'AWARD', 'GENERAL'];

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  title: string;
  content: string;
  excerpt: string;
  category: PostCategory;
  coverImage: string;
  isPinned: boolean;
  publishNow: boolean;
}

const INITIAL_STATE: FormState = {
  title: '',
  content: '',
  excerpt: '',
  category: 'GENERAL',
  coverImage: '',
  isPinned: false,
  publishNow: true,
};

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const createPost = useCreatePost();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!form.title.trim() || !form.content.trim()) return;

    const payload: CreatePostPayload = {
      title: form.title.trim(),
      content: form.content.trim(),
      excerpt: form.excerpt.trim() || undefined,
      category: form.category,
      coverImage: form.coverImage.trim() || undefined,
      isPinned: form.isPinned,
      publishNow: form.publishNow,
    };

    await createPost.mutateAsync(payload);
    setForm(INITIAL_STATE);
    onOpenChange(false);
  }

  function handleClose() {
    setForm(INITIAL_STATE);
    onOpenChange(false);
  }

  const isValid = form.title.trim().length > 0 && form.content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle>Đăng bài viết mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="post-title">
              Tiêu đề <span className="text-destructive">*</span>
            </Label>
            <Input
              id="post-title"
              placeholder="Nhập tiêu đề bài viết..."
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              maxLength={500}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="post-category">Danh mục</Label>
            <select
              id="post-category"
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value as PostCategory)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {POST_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Excerpt */}
          <div className="space-y-1.5">
            <Label htmlFor="post-excerpt">
              Tóm tắt{' '}
              <span className="text-muted-foreground text-xs">(hiển thị ở danh sách)</span>
            </Label>
            <Textarea
              id="post-excerpt"
              placeholder="Mô tả ngắn về bài viết..."
              value={form.excerpt}
              onChange={(e) => handleChange('excerpt', e.target.value)}
              maxLength={1000}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="post-content">
              Nội dung <span className="text-destructive">*</span>
              <span className="text-muted-foreground text-xs ml-1">
                (có thể dùng HTML cơ bản)
              </span>
            </Label>
            <Textarea
              id="post-content"
              placeholder="Nội dung bài viết..."
              value={form.content}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={10}
              className="resize-y font-mono text-sm"
              required
            />
          </div>

          {/* Cover Image */}
          <div className="space-y-1.5">
            <Label htmlFor="post-cover">URL ảnh bìa</Label>
            <Input
              id="post-cover"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={form.coverImage}
              onChange={(e) => handleChange('coverImage', e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => handleChange('isPinned', e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">Ghim bài viết lên đầu</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(e) => handleChange('publishNow', e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">
                Đăng ngay{' '}
                <span className="font-normal text-muted-foreground">
                  (bỏ chọn để lưu nháp)
                </span>
              </span>
            </label>
          </div>
        </form>

        <DialogFooter className="px-6 py-4 border-t border-border/60 gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
          </DialogClose>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!isValid || createPost.isPending}
          >
            {createPost.isPending
              ? 'Đang đăng...'
              : form.publishNow
              ? 'Đăng bài'
              : 'Lưu nháp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
