'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface SlugInputProps {
  title: string;
  slug: string;
  onSlugChange: (slug: string) => void;
  label?: string;
}

export function SlugInput({ title, slug, onSlugChange, label = 'Slug' }: SlugInputProps) {
  const generateSlug = () => {
    const newSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    onSlugChange(newSlug);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="slug">{label}</Label>
      <div className="flex gap-2">
        <Input
          id="slug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="url-slug"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={generateSlug}
          disabled={!title}
          title="Tạo slug từ tiêu đề"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        URL: /{slug || 'url-slug'}
      </p>
    </div>
  );
}
