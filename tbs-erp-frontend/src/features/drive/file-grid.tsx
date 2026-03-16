'use client';

import { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Video,
  Archive,
  File,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  FolderInput,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteFile } from '@/lib/hooks/use-drive';
import { driveApi } from '@/lib/api/drive.api';
import type { DriveFile } from '@/lib/types/drive.types';
import { FilePreview } from './file-preview';
import { ShareDialog } from './share-dialog';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-green-500" />;
  if (mimeType.startsWith('video/')) return <Video className="h-8 w-8 text-purple-500" />;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  )
    return <FileSpreadsheet className="h-8 w-8 text-emerald-600" />;
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word')
  )
    return <FileText className="h-8 w-8 text-blue-500" />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar'))
    return <Archive className="h-8 w-8 text-yellow-600" />;
  return <File className="h-8 w-8 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─────────────────────────────────────────────
// File Card (Grid mode)
// ─────────────────────────────────────────────

function FileCard({
  file,
  selected,
  onSelect,
  onPreview,
  onShare,
}: {
  file: DriveFile;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onPreview: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
}) {
  const deleteFile = useDeleteFile();

  const handleDownload = async () => {
    const { url, filename } = await driveApi.getDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card p-3 hover:shadow-md transition-shadow cursor-pointer',
        selected && 'border-primary ring-1 ring-primary',
      )}
      onDoubleClick={() => onPreview(file)}
    >
      {/* Checkbox */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(file.id, !!checked)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* File icon */}
      <div className="flex justify-center py-3">{getMimeIcon(file.mimeType)}</div>

      {/* File name */}
      <p className="text-sm font-medium truncate text-center" title={file.name}>
        {file.name}
      </p>
      <p className="text-xs text-muted-foreground text-center mt-0.5">
        {formatSize(file.size)}
      </p>
      <p className="text-xs text-muted-foreground text-center">
        {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true, locale: vi })}
      </p>

      {/* Context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPreview(file)}>
            <Eye className="h-4 w-4 mr-2" /> Xem trước
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Tải xuống
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare(file)}>
            <Share2 className="h-4 w-4 mr-2" /> Chia sẻ
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => deleteFile.mutate(file.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Xóa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────
// File Row (List mode)
// ─────────────────────────────────────────────

function FileRow({
  file,
  selected,
  onSelect,
  onPreview,
  onShare,
}: {
  file: DriveFile;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onPreview: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
}) {
  const deleteFile = useDeleteFile();

  const handleDownload = async () => {
    const { url, filename } = await driveApi.getDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent cursor-pointer',
        selected && 'bg-accent',
      )}
      onDoubleClick={() => onPreview(file)}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onSelect(file.id, !!checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="shrink-0">{getMimeIcon(file.mimeType)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        {file.folder && (
          <p className="text-xs text-muted-foreground">{file.folder.name}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
        {formatSize(file.size)}
      </span>
      <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
        {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true, locale: vi })}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-muted ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPreview(file)}>
            <Eye className="h-4 w-4 mr-2" /> Xem trước
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Tải xuống
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare(file)}>
            <Share2 className="h-4 w-4 mr-2" /> Chia sẻ
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => deleteFile.mutate(file.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Xóa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

interface FileGridProps {
  files: DriveFile[];
  viewMode: 'grid' | 'list';
}

export function FileGrid({ files, viewMode }: FileGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [shareFile, setShareFile] = useState<DriveFile | null>(null);

  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <File className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Chưa có file nào</p>
        <p className="text-xs mt-1">Kéo thả file vào đây hoặc bấm &ldquo;Tải lên&rdquo;</p>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selected={selected.has(file.id)}
              onSelect={handleSelect}
              onPreview={setPreviewFile}
              onShare={setShareFile}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {/* List header */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
            <span className="w-4" />
            <span className="w-8" />
            <span className="flex-1">Tên file</span>
            <span className="w-20 text-right">Kích thước</span>
            <span className="w-28 text-right">Ngày upload</span>
            <span className="w-6" />
          </div>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              selected={selected.has(file.id)}
              onSelect={handleSelect}
              onPreview={setPreviewFile}
              onShare={setShareFile}
            />
          ))}
        </div>
      )}

      {/* Preview panel */}
      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* Share dialog */}
      {shareFile && (
        <ShareDialog file={shareFile} open onClose={() => setShareFile(null)} />
      )}
    </>
  );
}
