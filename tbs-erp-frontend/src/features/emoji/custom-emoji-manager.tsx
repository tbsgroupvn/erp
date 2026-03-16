'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { emojiApi } from '@/lib/api/emoji.api';
import type { CustomEmoji } from '@/lib/api/emoji.api';

// ─── Upload Form Dialog ───────────────────────────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UploadEmojiDialog({ open, onOpenChange }: UploadDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [category, setCategory] = React.useState('general');

  const createMutation = useMutation({
    mutationFn: () => emojiApi.create({ name, imageUrl, category }),
    onSuccess: () => {
      toast.success('Emoji đã được tạo');
      queryClient.invalidateQueries({ queryKey: ['custom-emojis'] });
      onOpenChange(false);
      setName('');
      setImageUrl('');
      setCategory('general');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Tạo emoji thất bại';
      toast.error(msg);
    },
  });

  // Validate tên emoji :abc:
  const nameValid = /^:[a-z0-9_]+:$/.test(name);
  const urlValid = imageUrl.startsWith('http');
  const canSubmit = nameValid && urlValid && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Upload Custom Emoji</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="emoji-name">
              Tên emoji <span className="text-destructive">*</span>
            </Label>
            <Input
              id="emoji-name"
              placeholder=":tbs_logo:"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
            {name && !nameValid && (
              <p className="text-xs text-destructive">
                Định dạng: :ten_emoji: (chữ thường, số, dấu gạch dưới)
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="emoji-url">
              URL ảnh (MinIO) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="emoji-url"
              placeholder="https://minio.tbslogistics.com/tbs-media/emojis/..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Upload file PNG/WebP (max 128x128px) lên MinIO trước, sau đó dán URL vào đây.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="emoji-category">Danh mục</Label>
            <Input
              id="emoji-category"
              placeholder="general"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Preview */}
          {imageUrl && urlValid && (
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={name || 'preview'}
                className="h-12 w-12 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div>
                <p className="text-sm font-medium">{name || '(chưa đặt tên)'}</p>
                <p className="text-xs text-muted-foreground">Danh mục: {category}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Manager ─────────────────────────────────────────────────────────────

export function CustomEmojiManager() {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CustomEmoji | null>(null);

  const { data: emojis = [], isLoading } = useQuery({
    queryKey: ['custom-emojis'],
    queryFn: () => emojiApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emojiApi.remove(id),
    onSuccess: () => {
      toast.success('Emoji đã được xóa');
      queryClient.invalidateQueries({ queryKey: ['custom-emojis'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Xóa emoji thất bại');
    },
  });

  // Group by category
  const groupedEmojis = React.useMemo(() => {
    const groups: Record<string, CustomEmoji[]> = {};
    for (const emoji of emojis) {
      const cat = emoji.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(emoji);
    }
    return groups;
  }, [emojis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom Emoji Công ty</h2>
          <p className="text-sm text-muted-foreground">
            Quản lý emoji riêng của TBS sử dụng trong chat và bình luận.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Thêm Emoji
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : emojis.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground text-sm">Chưa có emoji công ty nào.</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="mt-1"
          >
            Upload emoji đầu tiên
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEmojis).map(([category, categoryEmojis]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-medium capitalize">{category}</h3>
                <Badge variant="secondary" className="text-xs">
                  {categoryEmojis.length}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {categoryEmojis.map((emoji) => (
                  <div
                    key={emoji.id}
                    className="group relative flex flex-col items-center gap-2 rounded-lg border p-3 bg-card hover:border-primary transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={emoji.imageUrl}
                      alt={emoji.name}
                      className="h-12 w-12 object-contain"
                      loading="lazy"
                    />
                    <p className="text-xs text-center font-mono text-muted-foreground truncate w-full">
                      {emoji.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dùng {emoji.usageCount} lần
                    </p>

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteTarget(emoji)}
                      className={[
                        'absolute top-1.5 right-1.5 p-1 rounded-md',
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        'hover:bg-destructive/10 text-destructive',
                      ].join(' ')}
                      title="Xóa emoji"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <UploadEmojiDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa emoji?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa emoji{' '}
              <strong>{deleteTarget?.name}</strong>? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                'Xóa'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
