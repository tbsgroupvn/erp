'use client';

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sanitizeHighlight } from '@/lib/utils/sanitize-html';
import { useWikiSearch } from '@/lib/hooks/use-wiki';
import type { WikiSearchResult } from '@/lib/types/wiki.types';

const DEBOUNCE_MS = 300;

interface WikiSearchProps {
  spaceId?: string;
  placeholder?: string;
  className?: string;
  onSelect?: (result: WikiSearchResult) => void;
}

export function WikiSearch({ spaceId, placeholder = 'Tìm kiếm tài liệu...', className, onSelect }: WikiSearchProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(inputValue), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: results = [], isFetching } = useWikiSearch({
    search: debouncedQuery,
    spaceId,
  });

  // Group by space
  const grouped = results.reduce<Record<string, { spaceName: string; items: WikiSearchResult[] }>>(
    (acc, item) => {
      const key = item.spaceId;
      if (!acc[key]) {
        acc[key] = {
          spaceName: item.space?.name ?? 'Unknown',
          items: [],
        };
      }
      acc[key].items.push(item);
      return acc;
    },
    {},
  );

  const flatResults = results;

  const handleSelect = useCallback((result: WikiSearchResult) => {
    setOpen(false);
    setInputValue('');
    if (onSelect) {
      onSelect(result);
    } else {
      router.push(`/wiki/${result.space?.slug ?? ''}?page=${result.id}`);
    }
  }, [onSelect, router]);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[activeIndex]) {
        handleSelect(flatResults[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => inputValue.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {inputValue && (
          <button
            onClick={() => { setInputValue(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {isFetching && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Đang tìm...
            </div>
          )}

          {!isFetching && flatResults.length === 0 && debouncedQuery.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              Không tìm thấy kết quả cho &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {!isFetching && Object.keys(grouped).length > 0 && (
            <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
              {Object.entries(grouped).map(([spaceId, { spaceName, items }]) => (
                <li key={spaceId}>
                  {/* Group header */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    {spaceName}
                  </div>
                  {items.map((result) => {
                    const globalIdx = flatResults.findIndex((r) => r.id === result.id);
                    const isActive = globalIdx === activeIndex;
                    return (
                      <button
                        key={result.id}
                        onMouseDown={() => handleSelect(result)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors',
                          isActive && 'bg-blue-50',
                        )}
                      >
                        <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-sm font-medium text-gray-900 truncate"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHighlight(result.highlightedTitle),
                            }}
                          />
                          {result.highlightedExcerpt && (
                            <div
                              className="text-xs text-gray-500 truncate mt-0.5"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHighlight(result.highlightedExcerpt),
                              }}
                            />
                          )}
                        </div>
                        {!result.isPublished && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Draft
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
