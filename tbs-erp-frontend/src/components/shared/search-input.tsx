'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  delay = 300,
  className,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = React.useState(value);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync external value changes
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  };

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Xóa tìm kiếm"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
