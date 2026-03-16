'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Upload, FolderPlus, Grid, List, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FolderTree } from '@/features/drive/folder-tree';
import { FileGrid } from '@/features/drive/file-grid';
import { FileUploadZone } from '@/features/drive/file-upload-zone';
import { useFolders, useFiles, useCreateFolder, useStorageUsage } from '@/lib/hooks/use-drive';
import { cn } from '@/lib/utils/cn';

// Wiki imports
import { BookOpen } from 'lucide-react';
import { SpaceList } from '@/features/wiki/space-list';
import { WikiSearch } from '@/features/wiki/wiki-search';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'default', label: 'Tai lieu' },
  { key: 'wiki', label: 'Wiki' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Drive (Tai lieu) content
// ---------------------------------------------------------------------------

function DriveContent() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: folders = [] } = useFolders(undefined);
  const { data: filesData } = useFiles({
    folderId: selectedFolderId,
    search: search || undefined,
  });
  const { data: storageUsage } = useStorageUsage();
  const createFolder = useCreateFolder();

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(
      { name: newFolderName.trim(), parentId: selectedFolderId },
      {
        onSuccess: () => {
          setNewFolderOpen(false);
          setNewFolderName('');
        },
      },
    );
  };

  const fileItems = filesData?.data ?? [];
  const fileCount = filesData?.meta?.total ?? 0;

  return (
    <div className="flex h-[calc(100vh-64px-48px)] overflow-hidden border-t -mx-6">
      {/* Sidebar — Folder tree */}
      <div className="w-60 shrink-0 border-r bg-background overflow-y-auto p-2 flex flex-col gap-2">
        <FolderTree
          folders={folders}
          selectedId={selectedFolderId}
          onSelect={setSelectedFolderId}
        />

        {/* Storage usage */}
        {storageUsage && (
          <div className="mt-auto pt-2 border-t px-2 pb-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{storageUsage.totalGB} GB đã dùng</span>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b gap-3">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowUpload((v) => !v)}>
              <Upload className="h-4 w-4 mr-1.5" />
              {showUpload ? 'Đóng upload' : 'Tải lên'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewFolderOpen(true)}
            >
              <FolderPlus className="h-4 w-4 mr-1.5" />
              Thư mục mới
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {fileCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {fileCount} file
              </Badge>
            )}
            <Input
              className="h-8 w-48 text-sm"
              placeholder="Tìm kiếm file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
              title={viewMode === 'grid' ? 'Chuyển sang danh sách' : 'Chuyển sang lưới'}
            >
              {viewMode === 'grid' ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* File area */}
        <div className="flex-1 overflow-y-auto p-4">
          {showUpload ? (
            <FileUploadZone
              folderId={selectedFolderId}
              onDone={() => setShowUpload(false)}
            />
          ) : (
            <FileGrid files={fileItems} viewMode={viewMode} />
          )}
        </div>
      </div>

      {/* Create folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo thư mục mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tên thư mục</Label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="Nhập tên thư mục..."
              autoFocus
            />
            {selectedFolderId && (
              <p className="text-xs text-muted-foreground">
                Sẽ tạo trong thư mục hiện tại
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={createFolder.isPending || !newFolderName.trim()}
            >
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wiki content
// ---------------------------------------------------------------------------

function WikiContent() {
  return (
    <div className="flex flex-col gap-6 max-w-screen-xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Wiki</h2>
        </div>
        <p className="text-sm text-gray-500">
          Knowledge base noi bo — tai lieu quy trinh, huong dan va kien thuc chia se
        </p>
      </div>

      <WikiSearch
        placeholder="Tìm kiếm tài liệu, quy trình, hướng dẫn..."
        className="max-w-xl"
      />

      <SpaceList />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component that reads search params (must be inside Suspense)
// ---------------------------------------------------------------------------

function TaiLieuInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'default';

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'default') params.delete('tab');
    else params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6 overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 border-b px-6 bg-background shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden px-6 py-6">
        {activeTab === 'default' ? <DriveContent /> : <WikiContent />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function TaiLieuPage() {
  return (
    <Suspense>
      <TaiLieuInner />
    </Suspense>
  );
}
