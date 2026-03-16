'use client';

import { useState, useEffect } from 'react';
import { X, Download, Clock, ChevronDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { driveApi } from '@/lib/api/drive.api';
import { useFileVersions } from '@/lib/hooks/use-drive';
import type { DriveFile, DriveFileVersion } from '@/lib/types/drive.types';

interface FilePreviewProps {
  file: DriveFile;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PreviewContent({ file, downloadUrl }: { file: DriveFile; downloadUrl: string }) {
  const mime = file.mimeType;

  if (mime.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={downloadUrl}
          alt={file.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  if (mime.startsWith('video/')) {
    return (
      <div className="flex items-center justify-center h-full bg-black rounded-lg overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={downloadUrl}
          controls
          className="max-w-full max-h-full"
        />
      </div>
    );
  }

  if (mime === 'application/pdf') {
    return (
      <iframe
        src={downloadUrl}
        className="w-full h-full rounded-lg border"
        title={file.name}
      />
    );
  }

  // Office files — use Microsoft Online Viewer
  const officeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
  ];

  if (officeTypes.includes(mime)) {
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadUrl)}`;
    return (
      <iframe
        src={viewerUrl}
        className="w-full h-full rounded-lg border"
        title={file.name}
      />
    );
  }

  // Fallback: file info + download
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs mt-1">{mime}</p>
        <p className="text-xs">{formatSize(file.size)}</p>
      </div>
      <Button asChild>
        <a href={downloadUrl} download={file.name} target="_blank" rel="noreferrer">
          <Download className="h-4 w-4 mr-2" />
          Tải xuống để xem
        </a>
      </Button>
    </div>
  );
}

function VersionRow({ version, onDownload }: { version: DriveFileVersion; onDownload: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">Phiên bản {version.version}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(version.createdAt), 'dd/MM/yyyy HH:mm')}
        </p>
        {version.changeNote && (
          <p className="text-xs text-muted-foreground italic">{version.changeNote}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{formatSize(version.size)}</span>
        <Button size="sm" variant="ghost" onClick={onDownload}>
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const { data: versions = [] } = useFileVersions(file.id);

  useEffect(() => {
    let mounted = true;
    setLoadingUrl(true);
    driveApi
      .getDownloadUrl(file.id)
      .then(({ url }) => {
        if (mounted) {
          setDownloadUrl(url);
          setLoadingUrl(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingUrl(false);
      });
    return () => {
      mounted = false;
    };
  }, [file.id]);

  const handleDownload = async () => {
    const { url, filename } = await driveApi.getDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  const handleVersionDownload = async (version: DriveFileVersion) => {
    // For older versions, we need to generate a URL for the version storageKey
    // For now, redirect to the main download
    const { url } = await driveApi.getDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v${version.version}_${file.name}`;
    a.target = '_blank';
    a.click();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[600px] sm:w-[700px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="truncate max-w-[400px] text-base">{file.name}</SheetTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Tải xuống
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="preview" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-4 mt-2 w-auto self-start">
            <TabsTrigger value="preview">Xem trước</TabsTrigger>
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="versions">
              Phiên bản
              {versions.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                  {versions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Preview tab */}
          <TabsContent value="preview" className="flex-1 overflow-hidden px-4 pb-4 mt-2">
            {loadingUrl ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Đang tải...
              </div>
            ) : downloadUrl ? (
              <PreviewContent file={file} downloadUrl={downloadUrl} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Không thể tải preview
              </div>
            )}
          </TabsContent>

          {/* Info tab */}
          <TabsContent value="info" className="px-4 pb-4 mt-2 overflow-y-auto">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tên file</dt>
                <dd className="font-medium text-right max-w-[280px] truncate">{file.name}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Loại</dt>
                <dd>{file.mimeType}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Kích thước</dt>
                <dd>{formatSize(file.size)}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Thư mục</dt>
                <dd>{file.folder?.name ?? 'Root'}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ngày upload</dt>
                <dd>{format(new Date(file.createdAt), 'dd/MM/yyyy HH:mm')}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Cập nhật lần cuối</dt>
                <dd>
                  {formatDistanceToNow(new Date(file.updatedAt), {
                    addSuffix: true,
                    locale: vi,
                  })}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phiên bản hiện tại</dt>
                <dd>v{file.currentVersion}</dd>
              </div>
              {file.tags && file.tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <dt className="text-muted-foreground mb-2">Tags</dt>
                    <dd className="flex flex-wrap gap-1">
                      {file.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                </>
              )}
              {file.description && (
                <>
                  <Separator />
                  <div>
                    <dt className="text-muted-foreground mb-1">Mô tả</dt>
                    <dd className="text-sm">{file.description}</dd>
                  </div>
                </>
              )}
            </dl>
          </TabsContent>

          {/* Versions tab */}
          <TabsContent value="versions" className="px-4 pb-4 mt-2 overflow-y-auto">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chưa có lịch sử phiên bản
              </p>
            ) : (
              <div>
                {versions.map((v) => (
                  <VersionRow
                    key={v.id}
                    version={v}
                    onDownload={() => handleVersionDownload(v)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
