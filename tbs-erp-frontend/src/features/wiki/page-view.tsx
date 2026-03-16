'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, History, Eye, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type { WikiPage } from '@/lib/types/wiki.types';

// ---------------------------------------------------------------------------
// TOC generator
// ---------------------------------------------------------------------------
interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(html: string): TocItem[] {
  if (typeof window === 'undefined') return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
  return headings.map((el, idx) => ({
    id: el.id || `heading-${idx}`,
    text: el.textContent ?? '',
    level: parseInt(el.tagName.charAt(1)),
  }));
}

// Inject IDs into headings so TOC anchors work
function injectHeadingIds(html: string): string {
  let counter = 0;
  return html.replace(/<(h[123])(.*?)>/gi, (_, tag, attrs) => {
    if (attrs.includes('id=')) return `<${tag}${attrs}>`;
    return `<${tag}${attrs} id="heading-${counter++}">`;
  });
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------
interface BreadcrumbProps {
  spaceName: string;
  spaceSlug: string;
  parentTitle?: string;
  currentTitle: string;
}

function WikiBreadcrumb({ spaceName, spaceSlug, parentTitle, currentTitle }: BreadcrumbProps) {
  const router = useRouter();
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
      <button
        onClick={() => router.push('/wiki')}
        className="flex items-center hover:text-gray-800 transition-colors"
      >
        <Home className="w-3.5 h-3.5 mr-1" />
        Wiki
      </button>
      <ChevronRight className="w-3.5 h-3.5" />
      <button
        onClick={() => router.push(`/wiki/${spaceSlug}`)}
        className="hover:text-gray-800 transition-colors"
      >
        {spaceName}
      </button>
      {parentTitle && (
        <>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-400">{parentTitle}</span>
        </>
      )}
      <ChevronRight className="w-3.5 h-3.5" />
      <span className="text-gray-900 font-medium">{currentTitle}</span>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// TOC sidebar
// ---------------------------------------------------------------------------
function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="sticky top-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Mục lục
      </h4>
      <nav className="space-y-1">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block text-sm text-gray-600 hover:text-blue-600 transition-colors truncate"
            style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
          >
            {item.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageView (main export)
// ---------------------------------------------------------------------------
interface PageViewProps {
  page: WikiPage;
  spaceSlug: string;
  spaceName: string;
  isOwner?: boolean;
  onEdit: () => void;
  onOpenHistory: () => void;
}

export function PageView({
  page,
  spaceSlug,
  spaceName,
  isOwner,
  onEdit,
  onOpenHistory,
}: PageViewProps) {
  const processedHtml = useMemo(() => {
    return sanitizeHtml(injectHeadingIds(page.content));
  }, [page.content]);

  const tocItems = useMemo(() => extractToc(processedHtml), [processedHtml]);

  const lastEditedText = useMemo(() => {
    const d = new Date(page.updatedAt);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [page.updatedAt]);

  return (
    <div className="flex gap-8">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <WikiBreadcrumb
          spaceName={spaceName}
          spaceSlug={spaceSlug}
          currentTitle={page.title}
        />

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {page.viewCount} lượt xem
              </span>
              <span>Cập nhật lần cuối: {lastEditedText}</span>
              {!page.isPublished && (
                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                  Draft
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onOpenHistory}>
              <History className="w-3.5 h-3.5 mr-1" />
              Lịch sử
            </Button>
            {isOwner && (
              <Button size="sm" onClick={onEdit}>
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Chỉnh sửa
              </Button>
            )}
          </div>
        </div>

        {/* Rendered content */}
        <div
          className="prose prose-sm sm:prose max-w-none"
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      </div>

      {/* TOC sidebar */}
      {tocItems.length > 0 && (
        <div className="w-48 shrink-0 hidden xl:block">
          <TableOfContents items={tocItems} />
        </div>
      )}
    </div>
  );
}
