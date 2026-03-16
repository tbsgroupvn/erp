'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Clock, X } from 'lucide-react';
import { useSearch, useRecentItems } from '@/lib/hooks/use-search';
import { cn } from '@/lib/utils';

// Type-based color mapping
const TYPE_COLORS: Record<string, string> = {
  order: 'text-blue-600 bg-blue-50',
  customer: 'text-green-600 bg-green-50',
  task: 'text-purple-600 bg-purple-50',
  wiki: 'text-amber-600 bg-amber-50',
  complaint: 'text-red-600 bg-red-50',
  quotation: 'text-cyan-600 bg-cyan-50',
  employee: 'text-pink-600 bg-pink-50',
};

const TYPE_LABELS: Record<string, string> = {
  order: 'Đơn hàng',
  customer: 'Khách hàng',
  task: 'Công việc',
  wiki: 'Wiki',
  complaint: 'Khiếu nại',
  quotation: 'Báo giá',
  employee: 'Nhân sự',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: results = [], isFetching } = useSearch(query);
  const { data: recent = [] } = useRecentItems();

  const items = query.trim().length >= 2 ? results : recent;

  // Open on Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus trap: keep Tab / Shift+Tab within the palette while it is open
  useEffect(() => {
    if (!open) return;

    const handleFocusTrap = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab' || !paletteRef.current) return;

      const focusable = Array.from(
        paletteRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router],
  );

  const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && items[selectedIndex]) {
      navigate(items[selectedIndex].href);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div
        ref={paletteRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm"
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm đơn hàng, khách hàng, wiki..."
            aria-label="Tìm kiếm"
            aria-autocomplete="list"
            aria-controls="command-palette-listbox"
            aria-activedescendant={items.length > 0 ? `palette-item-${selectedIndex}` : undefined}
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
          />
          {isFetching && (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border px-1.5 text-xs text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} id="command-palette-listbox" role="listbox" aria-label="Kết quả tìm kiếm" className="max-h-96 overflow-y-auto py-2">
          {/* Empty state: query typed but no results */}
          {items.length === 0 && query.trim().length >= 2 && !isFetching && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Không tìm thấy kết quả cho &quot;{query}&quot;
            </p>
          )}

          {/* Empty state: no query — show "Recent" label */}
          {items.length === 0 && query.trim().length < 2 && (
            <p className="text-xs text-muted-foreground px-4 py-2 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Gần đây
            </p>
          )}

          {/* Recent label when showing recent items */}
          {items.length > 0 && query.trim().length < 2 && (
            <p className="text-xs text-muted-foreground px-4 pt-1 pb-2 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Gần đây
            </p>
          )}

          {/* Result items */}
          {items.map((item, i) => (
            <button
              key={`${item.type}-${item.id}`}
              id={`palette-item-${i}`}
              data-index={i}
              type="button"
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => navigate(item.href)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors',
                i === selectedIndex && 'bg-accent',
              )}
            >
              {/* Type badge */}
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                  TYPE_COLORS[item.type] ?? 'text-gray-600 bg-gray-100',
                )}
              >
                {TYPE_LABELS[item.type]?.[0]?.toUpperCase() ?? '?'}
              </span>

              {/* Title + subtitle */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                )}
              </div>

              {/* Type label pill */}
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full shrink-0 font-medium',
                  TYPE_COLORS[item.type] ?? 'text-gray-600 bg-gray-100',
                )}
              >
                {TYPE_LABELS[item.type] ?? item.type}
              </span>

              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <span>điều hướng · Enter chọn</span>
          <span>Ctrl+K để mở / đóng</span>
        </div>
      </div>
    </div>
  );
}
