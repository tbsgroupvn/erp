'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, File } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { driveApi } from '@/lib/api/drive.api';
import { useQueryClient } from '@tanstack/react-query';
import { driveKeys } from '@/lib/hooks/use-drive';

type UploadStatus = 'pending' | 'requesting' | 'uploading' | 'confirming' | 'done' | 'error';

interface FileUploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface FileUploadZoneProps {
  folderId?: string;
  onDone?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUploadZone({ folderId, onDone }: FileUploadZoneProps) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const updateItem = (id: string, updates: Partial<FileUploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const uploadFile = useCallback(
    async (item: FileUploadItem) => {
      try {
        // Step 1: Request presigned URL
        updateItem(item.id, { status: 'requesting', progress: 5 });

        const { uploadUrl, storageKey } = await driveApi.requestUpload({
          filename: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          size: item.file.size,
          folderId,
        });

        // Step 2: Upload directly to MinIO with progress tracking
        updateItem(item.id, { status: 'uploading', progress: 10 });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 80) + 10; // 10-90%
              updateItem(item.id, { progress: pct });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
          xhr.send(item.file);
        });

        // Step 3: Confirm upload
        updateItem(item.id, { status: 'confirming', progress: 92 });

        await driveApi.confirmUpload({
          storageKey,
          filename: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          size: item.file.size,
          folderId,
        });

        updateItem(item.id, { status: 'done', progress: 100 });

        // Refresh file list
        qc.invalidateQueries({ queryKey: driveKeys.files() });
        qc.invalidateQueries({ queryKey: driveKeys.usage() });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload that bai';
        updateItem(item.id, { status: 'error', error: message });
      }
    },
    [folderId, qc],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newItems: FileUploadItem[] = fileArray.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'pending',
        progress: 0,
      }));

      setItems((prev) => [...prev, ...newItems]);

      // Start uploading each file
      newItems.forEach((item) => uploadFile(item));
    },
    [uploadFile],
  );

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const allDone = items.length > 0 && items.every((item) => item.status === 'done' || item.status === 'error');
  const hasActive = items.some((item) => ['requesting', 'uploading', 'confirming'].includes(item.status));

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleBrowse()}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Keo tha file vao day</p>
        <p className="text-xs text-muted-foreground mt-1">hoac bam de chon file (toi da 500 MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Upload list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <File className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">{item.file.name}</p>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {formatSize(item.file.size)}
                  </span>
                </div>
                {item.status !== 'done' && item.status !== 'error' && (
                  <Progress value={item.progress} className="h-1.5" />
                )}
                {item.status === 'error' && (
                  <p className="text-xs text-destructive mt-0.5">{item.error}</p>
                )}
              </div>

              {/* Status icon */}
              <div className="shrink-0">
                {item.status === 'done' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {item.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                {['requesting', 'uploading', 'confirming'].includes(item.status) && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {item.status === 'pending' && (
                  <Loader2 className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* Remove button */}
              {(item.status === 'done' || item.status === 'error') && (
                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleRemove(item.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {items.filter((i) => i.status === 'done').length} / {items.length} file hoan thanh
          </p>
          <div className="flex gap-2">
            {allDone && onDone && (
              <Button size="sm" onClick={onDone}>
                Xong
              </Button>
            )}
            {!hasActive && (
              <Button size="sm" variant="outline" onClick={() => setItems([])}>
                Xoa tat ca
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
