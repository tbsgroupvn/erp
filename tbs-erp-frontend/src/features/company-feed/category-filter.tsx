'use client';

import { cn } from '@/lib/utils/cn';
import type { PostCategory } from '@/lib/types/company-feed.types';
import { POST_CATEGORY_LABELS } from '@/lib/types/company-feed.types';

interface CategoryFilterProps {
  value?: PostCategory;
  onChange: (category: PostCategory | undefined) => void;
}

const CATEGORIES: Array<{ value: PostCategory | undefined; label: string }> = [
  { value: undefined, label: 'Tất cả' },
  { value: 'NEWS', label: POST_CATEGORY_LABELS.NEWS },
  { value: 'PROCESS', label: POST_CATEGORY_LABELS.PROCESS },
  { value: 'EVENT', label: POST_CATEGORY_LABELS.EVENT },
  { value: 'AWARD', label: POST_CATEGORY_LABELS.AWARD },
  { value: 'GENERAL', label: POST_CATEGORY_LABELS.GENERAL },
];

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo danh mục">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value ?? 'all'}
          type="button"
          onClick={() => onChange(cat.value)}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            value === cat.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground hover:bg-muted',
          )}
          aria-pressed={value === cat.value}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
