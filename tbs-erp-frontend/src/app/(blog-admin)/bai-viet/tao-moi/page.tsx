'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useCreateBlogPost } from '@/lib/hooks/use-blog-posts';
import { BlogPostForm } from '@/components/blog/blog-post-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { CreateBlogPostDto } from '@/lib/api/blog';

export default function CreateBlogPostPage() {
  const router = useRouter();
  const createMutation = useCreateBlogPost();

  const handleSubmit = (data: CreateBlogPostDto) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        router.push('/bai-viet');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/bai-viet"
            className="mb-2 inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Tạo bài viết mới</h1>
          <p className="mt-1 text-sm text-slate-600">
            Viết bài viết blog mới cho website của bạn
          </p>
        </div>
      </div>

      {/* Form */}
      <BlogPostForm
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
