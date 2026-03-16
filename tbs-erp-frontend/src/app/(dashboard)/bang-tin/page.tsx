'use client';

import { useState, type ChangeEvent } from 'react';
import { Search, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { PinnedCarousel } from '@/features/company-feed/pinned-carousel';
import { CategoryFilter } from '@/features/company-feed/category-filter';
import { PostCard } from '@/features/company-feed/post-card';
import { PostDetail } from '@/features/company-feed/post-detail';
import { CreatePostDialog } from '@/features/company-feed/create-post-dialog';
import { usePosts, usePinnedPosts } from '@/lib/hooks/use-company-feed';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { PostCategory, CompanyPost } from '@/lib/types/company-feed.types';

/** Roles được phép đăng bài */
const POSTER_ROLES = ['CEO', 'COO', 'HR_MANAGER', 'DIRECTOR_OPERATIONS', 'SALES_DIRECTOR'];

export default function BangTinPage() {
  const [category, setCategory] = useState<PostCategory | undefined>();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CompanyPost | null>(null);

  const user = useAuthStore((s) => s.user);
  const canPost = POSTER_ROLES.includes((user?.role as string) ?? '');

  const { data: pinnedPosts = [] } = usePinnedPosts();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = usePosts({ category, search: search.trim() || undefined });

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Bảng tin công ty"
        description="Tin tức, sự kiện và thông báo nội bộ"
        infoKey="bang-tin"
      >
        {canPost && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Đăng bài
          </Button>
        )}
      </PageHeader>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm kiếm bài viết..."
          value={search}
          onChange={handleSearchChange}
          className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Pinned posts */}
      {pinnedPosts.length > 0 && (
        <PinnedCarousel
          posts={pinnedPosts}
          onSelect={(post) => setSelectedPost(post)}
        />
      )}

      {/* Category filter */}
      <CategoryFilter value={category} onChange={setCategory} />

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-3 animate-pulse">
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded-full bg-muted" />
                <div className="h-5 w-24 rounded-full bg-muted" />
              </div>
              <div className="h-6 w-3/4 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="text-muted-foreground">Chưa có bài viết nào.</p>
          {canPost && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Đăng bài đầu tiên
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onViewDetail={(p) => setSelectedPost(p)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pb-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <PostDetail
        postId={selectedPost?.id ?? null}
        open={!!selectedPost}
        onOpenChange={(open) => { if (!open) setSelectedPost(null); }}
      />

      <CreatePostDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
