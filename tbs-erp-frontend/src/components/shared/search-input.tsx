'use client';

import * as React from 'react';
import { Search, X, Clock, CornerDownLeft } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/input';

const STORAGE_KEY = 'tbs_recent_searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  try {
    const prev = getRecentSearches().filter((s) => s !== term);
    const next = [term, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function removeRecentSearch(term: string) {
  try {
    const next = getRecentSearches().filter((s) => s !== term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  /** Show recent searches dropdown when focused with empty input */
  showRecent?: boolean;
  /** Storage key to namespace recent searches per context */
  recentKey?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  delay = 300,
  className,
  showRecent = true,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = React.useState(value);
  const [recentItems, setRecentItems] = React.useState<string[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Sync external value changes
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K or / to focus
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select';

      if ((e.ctrlKey && e.key === 'k') || (!isEditable && e.key === '/')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onChange(newValue);
      if (newValue.trim().length >= 2) {
        saveRecentSearch(newValue.trim());
      }
    }, delay);
  };

  const handleClear = () => {
    setInternalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (showRecent) {
      setRecentItems(getRecentSearches());
      setShowDropdown(true);
    }
  };

  const handleSelectRecent = (term: string) => {
    setInternalValue(term);
    onChange(term);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentItems((prev) => prev.filter((s) => s !== term));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const shouldShowDropdown =
    showDropdown && showRecent && !internalValue && recentItems.length > 0;

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={shouldShowDropdown}
        aria-haspopup="listbox"
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Xoa tim kiem"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {!internalValue && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground/60 pointer-events-none">
          /
        </kbd>
      )}

      {/* Recent searches dropdown */}
      {shouldShowDropdown && (
        <div
          role="listbox"
          aria-label="Tim kiem gan day"
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5 w-full min-w-[200px]',
            'rounded-lg border bg-popover shadow-lg overflow-hidden',
            'animate-slide-down'
          )}
        >
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
            Tim kiem gan day
          </div>
          <ul className="py-1">
            {recentItems.map((term) => (
              <li key={term} className="flex items-center group/item">
                {/* Use a div row so we can have two separate interactive elements (button inside button is invalid HTML) */}
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelectRecent(term)}
                  className="flex flex-1 items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left min-w-0"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{term}</span>
                  <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRemoveRecent(e, term)}
                  className="pr-3 py-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
                  aria-label={`Xoa "${term}" khoi tim kiem gan day`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
