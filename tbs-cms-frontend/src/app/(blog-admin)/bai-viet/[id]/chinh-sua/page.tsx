'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useBlogPost, useUpdateBlogPost } from '@/lib/hooks/use-blog-posts';
import { BlogPostForm } from '@/components/blog/blog-post-form';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { Button } from '@/components/ui/button';
import type { UpdateBlogPostDto } from '@/lib/api/blog';

export default function EditBlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: post, isLoading, error } = useBlogPost(id);
  const updateMutation = useUpdateBlogPost();

  const handleSubmit = (data: UpdateBlogPostDto) => {
    updateMutation.mutate(
      { id, data },
      {
        onSuccess: () => {
          router.push('/bai-viet');
        },
      }
    );
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (error || !post) {
    return (
      <div className="py-20 text-center">
        <h2 className="mb-4 text-2xl font-bold text-slate-900">
          Không tìm thấy bài viết
        </h2>
        <p className="mb-6 text-slate-600">
          Bài viết bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        <Button onClick={() => router.push('/bai-viet')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách
        </Button>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-slate-900">Chỉnh sửa bài viết</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cập nhật nội dung và thông tin bài viết
          </p>
        </div>
      </div>

      {/* Form */}
      <BlogPostForm
        initialData={post}
        onSubmit={handleSubmit}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}
