'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { BookOpen, Plus, Settings, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useWikiSpace,
  useWikiPage,
  useCreatePage,
  useUpdatePage,
} from '@/lib/hooks/use-wiki';
import { PageTree } from '@/features/wiki/page-tree';
import { PageView } from '@/features/wiki/page-view';
import { PageEditor } from '@/features/wiki/page-editor';
import { VersionHistory } from '@/features/wiki/version-history';
import { WikiSearch } from '@/features/wiki/wiki-search';
import type { UpdatePageDto } from '@/lib/types/wiki.types';

// ---------------------------------------------------------------------------
// Placeholder when no page is selected
// ---------------------------------------------------------------------------
function SpaceOverview({ spaceName, spaceIcon, description, onCreatePage }: {
  spaceName: string;
  spaceIcon?: string | null;
  description?: string | null;
  onCreatePage: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <div className="text-5xl mb-4">{spaceIcon ?? '📚'}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{spaceName}</h2>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
      )}
      <Button onClick={onCreatePage}>
        <Plus className="w-4 h-4 mr-1" />
        Tạo trang đầu tiên
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function WikiSpacePage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug as string;
  const pageId = searchParams.get('page');

  const { data: space, isLoading: spaceLoading } = useWikiSpace(slug);

  // Active page
  const { data: currentPage, isLoading: pageLoading } = useWikiPage(pageId ?? '');

  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const authUserId = useAuthStore((s) => s.user?.id);

  // Determine if current user owns the page
  const isOwner = !!(authUserId && currentPage && (currentPage as any).createdById === authUserId);

  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Navigate to new page after creation
  const handleCreatePage = (parentId?: string) => {
    setCreateParentId(parentId);
    setShowCreateDialog(true);
  };

  const handleNewPageSave = async (dto: UpdatePageDto & { title: string }) => {
    if (!space) return;
    const newPage = await createPage.mutateAsync({
      spaceId: space.id,
      title: dto.title,
      content: dto.content ?? '',
      parentId: createParentId,
    });
    setShowCreateDialog(false);
    router.push(`/wiki/${slug}?page=${newPage.id}`);
  };

  const handleSavePage = async (dto: UpdatePageDto & { title: string }) => {
    if (!pageId) return;
    await updatePage.mutateAsync({ id: pageId, dto });
    setIsEditing(false);
  };

  const handleRestoreVersion = async (content: string, title: string) => {
    if (!pageId) return;
    await updatePage.mutateAsync({
      id: pageId,
      dto: { content, title, changeSummary: 'Khôi phục từ phiên bản cũ' },
    });
  };

  if (spaceLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Đang tải space...</p>
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <BookOpen className="w-12 h-12 text-gray-300" />
        <p className="text-gray-600 font-medium">Space không tồn tại</p>
        <Button variant="outline" onClick={() => router.push('/wiki')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Quay lại Wiki
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-50">
        {/* Space header */}
        <div
          className="px-3 py-3 border-b border-gray-200 flex items-center gap-2"
          style={{ borderBottomColor: space.color ?? '#3b82f6' }}
        >
          <span className="text-lg">{space.icon ?? '📚'}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{space.name}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => router.push('/wiki')}
            title="Quay lại danh sách space"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Search in space */}
        <div className="px-2 py-2 border-b border-gray-100">
          <WikiSearch
            spaceId={space.id}
            placeholder="Tìm trong space..."
            className="w-full"
            onSelect={(result) => router.push(`/wiki/${slug}?page=${result.id}`)}
          />
        </div>

        {/* Page tree */}
        <div className="flex-1 overflow-y-auto p-2">
          <PageTree
            spaceId={space.id}
            spaceSlug={slug}
            onCreatePage={handleCreatePage}
          />
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 overflow-auto">
        {isEditing && currentPage ? (
          // Edit mode
          <div className="h-full flex flex-col">
            <PageEditor
              page={currentPage}
              spaceId={space.id}
              onSave={handleSavePage}
              isSaving={updatePage.isPending}
            />
          </div>
        ) : currentPage && !pageLoading ? (
          // View mode
          <div className="p-6 max-w-4xl mx-auto">
            <PageView
              page={currentPage}
              spaceSlug={slug}
              spaceName={space.name}
              isOwner={isOwner}
              onEdit={() => setIsEditing(true)}
              onOpenHistory={() => setShowHistory(true)}
            />
          </div>
        ) : pageId && pageLoading ? (
          // Loading
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Đang tải trang...</p>
            </div>
          </div>
        ) : (
          // No page selected — space overview
          <SpaceOverview
            spaceName={space.name}
            spaceIcon={space.icon}
            description={space.description}
            onCreatePage={() => handleCreatePage()}
          />
        )}
      </main>

      {/* Version history sheet */}
      {currentPage && (
        <VersionHistory
          page={currentPage}
          open={showHistory}
          onClose={() => setShowHistory(false)}
          isOwner={isOwner}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Create page dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Tạo trang mới</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <PageEditor
              spaceId={space.id}
              parentId={createParentId}
              onSave={handleNewPageSave}
              isSaving={createPage.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
