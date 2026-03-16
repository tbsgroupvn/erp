'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link,
  Code,
  Quote,
  Eye,
  Edit2,
  Save,
  Globe,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type { WikiPage, UpdatePageDto } from '@/lib/types/wiki.types';

const AUTOSAVE_KEY_PREFIX = 'wiki_draft_';
const AUTOSAVE_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Toolbar helpers
// ---------------------------------------------------------------------------
interface ToolbarAction {
  icon: ReactNode;
  label: string;
  action: (textarea: HTMLTextAreaElement) => void;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string = before,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const replacement = before + (selected || 'text') + after;
  const newValue =
    textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
  textarea.value = newValue;
  // Trigger React onChange
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  nativeInputValueSetter?.call(textarea, newValue);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.setSelectionRange(start + before.length, start + before.length + (selected || 'text').length);
  textarea.focus();
}

function prependLine(textarea: HTMLTextAreaElement, prefix: string) {
  const start = textarea.selectionStart;
  const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
  const newValue =
    textarea.value.slice(0, lineStart) + prefix + textarea.value.slice(lineStart);
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  nativeInputValueSetter?.call(textarea, newValue);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

const toolbarActions: ToolbarAction[] = [
  {
    icon: <Bold className="w-4 h-4" />,
    label: 'In đậm',
    action: (ta) => wrapSelection(ta, '<strong>', '</strong>'),
  },
  {
    icon: <Italic className="w-4 h-4" />,
    label: 'In nghiêng',
    action: (ta) => wrapSelection(ta, '<em>', '</em>'),
  },
  {
    icon: <Heading1 className="w-4 h-4" />,
    label: 'Tiêu đề H1',
    action: (ta) => prependLine(ta, '<h1>'),
  },
  {
    icon: <Heading2 className="w-4 h-4" />,
    label: 'Tiêu đề H2',
    action: (ta) => prependLine(ta, '<h2>'),
  },
  {
    icon: <Heading3 className="w-4 h-4" />,
    label: 'Tiêu đề H3',
    action: (ta) => prependLine(ta, '<h3>'),
  },
  {
    icon: <List className="w-4 h-4" />,
    label: 'Danh sách',
    action: (ta) => prependLine(ta, '<ul>\n  <li>'),
  },
  {
    icon: <ListOrdered className="w-4 h-4" />,
    label: 'Danh sách số',
    action: (ta) => prependLine(ta, '<ol>\n  <li>'),
  },
  {
    icon: <Link className="w-4 h-4" />,
    label: 'Liên kết',
    action: (ta) => wrapSelection(ta, '<a href="URL">', '</a>'),
  },
  {
    icon: <Code className="w-4 h-4" />,
    label: 'Code block',
    action: (ta) => wrapSelection(ta, '<pre><code>', '</code></pre>'),
  },
  {
    icon: <Quote className="w-4 h-4" />,
    label: 'Trích dẫn',
    action: (ta) => prependLine(ta, '<blockquote>'),
  },
];

// ---------------------------------------------------------------------------
// Word count helper
// ---------------------------------------------------------------------------
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

// ---------------------------------------------------------------------------
// PageEditor
// ---------------------------------------------------------------------------
interface PageEditorProps {
  page?: WikiPage;
  spaceId: string;
  parentId?: string;
  onSave: (dto: UpdatePageDto & { title: string }) => Promise<void>;
  isSaving?: boolean;
}

export function PageEditor({ page, spaceId, parentId, onSave, isSaving }: PageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [title, setTitle] = useState(page?.title ?? '');
  const [content, setContent] = useState(page?.content ?? '');
  const [isPublished, setIsPublished] = useState(page?.isPublished ?? false);
  const [changeSummary, setChangeSummary] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const draftKey = `${AUTOSAVE_KEY_PREFIX}${page?.id ?? 'new'}`;

  // Khôi phục draft từ localStorage
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved) as { title: string; content: string; ts: number };
        // Chỉ khôi phục nếu draft mới hơn page.updatedAt
        const pageUpdated = page?.updatedAt ? new Date(page.updatedAt).getTime() : 0;
        if (draft.ts > pageUpdated) {
          setTitle(draft.title);
          setContent(draft.content);
          setHasDraft(true);
        }
      } catch {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Auto-save mỗi 30 giây
  useEffect(() => {
    autosaveTimerRef.current = setInterval(() => {
      if (title || content) {
        localStorage.setItem(draftKey, JSON.stringify({ title, content, ts: Date.now() }));
        setLastSaved(new Date());
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, [title, content, draftKey]);

  const wordCount = countWords(content);

  const handleSave = async () => {
    if (!title.trim()) return;
    await onSave({
      title: title.trim(),
      content,
      isPublished,
      changeSummary: changeSummary.trim() || undefined,
      parentId,
    });
    // Xóa draft sau khi lưu thành công
    localStorage.removeItem(draftKey);
    setHasDraft(false);
    setChangeSummary('');
    setLastSaved(new Date());
  };

  const handleToolbarAction = useCallback((action: (ta: HTMLTextAreaElement) => void) => {
    if (textareaRef.current) {
      action(textareaRef.current);
      setContent(textareaRef.current.value);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề trang..."
          className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0 flex-1"
        />
        <div className="flex items-center gap-2 shrink-0">
          {hasDraft && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
              Draft chưa lưu
            </Badge>
          )}
          {lastSaved && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {/* Publish toggle */}
          <Button
            variant={isPublished ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsPublished(!isPublished)}
            className="text-xs"
          >
            <Globe className="w-3.5 h-3.5 mr-1" />
            {isPublished ? 'Đã publish' : 'Draft'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !title.trim()}>
            <Save className="w-3.5 h-3.5 mr-1" />
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-100 px-4 py-1.5 flex items-center gap-1 bg-gray-50">
        {toolbarActions.map((action) => (
          <button
            key={action.label}
            title={action.label}
            disabled={mode === 'preview'}
            onClick={() => handleToolbarAction(action.action)}
            className={cn(
              'p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors',
              mode === 'preview' && 'opacity-40 cursor-not-allowed',
            )}
          >
            {action.icon}
          </button>
        ))}
        <Separator orientation="vertical" className="h-5 mx-1" />
        {/* Mode toggle */}
        <button
          onClick={() => setMode('edit')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            mode === 'edit' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-200',
          )}
        >
          <Edit2 className="w-3.5 h-3.5" />
          Chỉnh sửa
        </button>
        <button
          onClick={() => setMode('preview')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            mode === 'preview' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-200',
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          Xem trước
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {wordCount} từ
        </span>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nhập nội dung HTML ở đây... Dùng toolbar để chèn định dạng."
            className="w-full h-full min-h-[400px] p-4 resize-none outline-none font-mono text-sm text-gray-800 leading-relaxed"
          />
        ) : (
          <div
            className="prose prose-sm max-w-none p-6"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content || '<p class="text-gray-400">Chưa có nội dung...</p>') }}
          />
        )}
      </div>

      {/* Change summary */}
      <div className="border-t border-gray-100 px-4 py-2 bg-gray-50 flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Ghi chú thay đổi:</span>
        <Input
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="Tùy chọn — mô tả ngắn gọn thay đổi lần này..."
          className="h-7 text-xs border-gray-200"
        />
      </div>
    </div>
  );
}
