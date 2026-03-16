'use client';

import { useState } from 'react';
import { History, RotateCcw, ChevronRight, Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import { usePageVersions, usePageVersion } from '@/lib/hooks/use-wiki';
import type { WikiPage } from '@/lib/types/wiki.types';

// ---------------------------------------------------------------------------
// VersionPreviewPane
// ---------------------------------------------------------------------------
interface VersionPreviewPaneProps {
  pageId: string;
  version: number;
  onRestore: (version: number) => void;
  isOwner: boolean;
}

function VersionPreviewPane({ pageId, version, onRestore, isOwner }: VersionPreviewPaneProps) {
  const { data, isLoading } = usePageVersion(pageId, version);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        <div className="h-6 w-1/3 bg-gray-100 rounded animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex-1 overflow-auto border-l border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{data.title}</h3>
          <p className="text-xs text-gray-500">Phiên bản {data.version}</p>
        </div>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => onRestore(version)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Khôi phục
          </Button>
        )}
      </div>
      <div
        className="prose prose-sm max-w-none p-4"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content) }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VersionHistory (main export)
// ---------------------------------------------------------------------------
interface VersionHistoryProps {
  page: WikiPage;
  open: boolean;
  onClose: () => void;
  isOwner: boolean;
  onRestore: (content: string, title: string) => void;
}

export function VersionHistory({ page, open, onClose, isOwner, onRestore }: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const { data: versions = [], isLoading } = usePageVersions(page.id);
  const { data: versionData } = usePageVersion(
    page.id,
    selectedVersion ?? 0,
  );

  const handleRestore = (version: number) => {
    if (!versionData) return;
    onRestore(versionData.content, versionData.title);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-gray-200">
          <SheetTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Lịch sử phiên bản — {page.title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Version list */}
          <div className="w-64 shrink-0 overflow-y-auto border-r border-gray-100">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Chưa có lịch sử phiên bản
              </div>
            ) : (
              <ul className="py-2">
                {versions.map((v, idx) => (
                  <li key={v.id}>
                    <button
                      onClick={() => setSelectedVersion(v.version)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-2 ${
                        selectedVersion === v.version ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900">
                            v{v.version}
                          </span>
                          {idx === 0 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              Mới nhất
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {v.changeSummary || v.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(v.createdAt).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {selectedVersion === v.version && (
                        <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      )}
                    </button>
                    {idx < versions.length - 1 && <Separator />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Preview pane */}
          {selectedVersion ? (
            <VersionPreviewPane
              pageId={page.id}
              version={selectedVersion}
              onRestore={handleRestore}
              isOwner={isOwner}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chọn phiên bản để xem nội dung</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
