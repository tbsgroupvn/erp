'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { mediaApi, Media } from '@/lib/api/cms';
import { Image as ImageIcon, FileText, Film, Music, Check } from 'lucide-react';
import Image from 'next/image';

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: Media) => void;
  type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
}

export function MediaPicker({ open, onOpenChange, onSelect, type }: MediaPickerProps) {
  const [selected, setSelected] = useState<Media | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['media', { type, search }],
    queryFn: () => mediaApi.list({ type, search, limit: 50 }),
    enabled: open,
  });

  const handleSelect = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
      setSelected(null);
    }
  };

  const getIcon = (media: Media) => {
    switch (media.type) {
      case 'IMAGE':
        return <ImageIcon className="h-8 w-8" />;
      case 'VIDEO':
        return <Film className="h-8 w-8" />;
      case 'AUDIO':
        return <Music className="h-8 w-8" />;
      default:
        return <FileText className="h-8 w-8" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn Media</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <Input
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Loading" />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {data?.data.data.map((media) => (
                  <div
                    key={media.id}
                    onClick={() => setSelected(media)}
                    className={`
                      relative group cursor-pointer rounded-lg border-2 overflow-hidden
                      transition-all hover:border-primary
                      ${selected?.id === media.id ? 'border-primary ring-2 ring-primary' : 'border-border'}
                    `}
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center relative">
                      {media.type === 'IMAGE' ? (
                        <Image
                          src={media.thumbnailUrl || media.url}
                          alt={media.alt || media.originalName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="text-muted-foreground">
                          {getIcon(media)}
                        </div>
                      )}
                      {selected?.id === media.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-8 w-8 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-background">
                      <p className="text-xs truncate" title={media.originalName}>
                        {media.originalName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSelect} disabled={!selected}>
            Chọn
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
