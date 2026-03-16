'use client';

import { useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Globe, Users, Lock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWikiSpaces, useCreateSpace } from '@/lib/hooks/use-wiki';
import type { WikiSpace, WikiAccess, CreateSpaceDto } from '@/lib/types/wiki.types';

// ---------------------------------------------------------------------------
// Access badge config
// ---------------------------------------------------------------------------
const accessConfig: Record<WikiAccess, { label: string; icon: ReactNode; variant: 'default' | 'secondary' | 'outline' }> = {
  PUBLIC: { label: 'Công khai', icon: <Globe className="w-3 h-3" />, variant: 'default' },
  TEAM: { label: 'Nhóm', icon: <Users className="w-3 h-3" />, variant: 'secondary' },
  PRIVATE: { label: 'Riêng tư', icon: <Lock className="w-3 h-3" />, variant: 'outline' },
};

// ---------------------------------------------------------------------------
// SpaceCard
// ---------------------------------------------------------------------------
function SpaceCard({ space }: { space: WikiSpace }) {
  const router = useRouter();
  const access = accessConfig[space.access];
  const pageCount = space._count?.pages ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/wiki/${space.slug}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/wiki/${space.slug}`)}
      className="group relative bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      style={{ borderLeftColor: space.color ?? '#3b82f6', borderLeftWidth: 4 }}
    >
      {/* Icon + Name */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${space.color ?? '#3b82f6'}20` }}
        >
          {space.icon ?? <BookOpen className="w-5 h-5" style={{ color: space.color ?? '#3b82f6' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {space.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">/{space.slug}</p>
        </div>
      </div>

      {/* Description */}
      {space.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{space.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-xs text-gray-500">
          {pageCount} trang
        </span>
        <Badge variant={access.variant} className="flex items-center gap-1 text-xs">
          {access.icon}
          {access.label}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpaceFormDialog
// ---------------------------------------------------------------------------
interface SpaceFormDialogProps {
  open: boolean;
  onClose: () => void;
}

function SpaceFormDialog({ open, onClose }: SpaceFormDialogProps) {
  const createSpace = useCreateSpace();
  const [form, setForm] = useState<CreateSpaceDto>({
    name: '',
    slug: '',
    description: '',
    icon: '',
    color: '#3b82f6',
    access: 'PUBLIC',
  });

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);
    setForm((prev) => ({ ...prev, name, slug }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await createSpace.mutateAsync({
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description?.trim() || undefined,
      icon: form.icon?.trim() || undefined,
    });
    onClose();
    setForm({ name: '', slug: '', description: '', icon: '', color: '#3b82f6', access: 'PUBLIC' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo Space mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {/* Icon */}
            <div className="col-span-1">
              <Label>Icon (emoji)</Label>
              <Input
                placeholder="📚"
                value={form.icon}
                onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                className="text-center text-lg"
                maxLength={4}
              />
            </div>
            {/* Color */}
            <div className="col-span-1">
              <Label>Màu</Label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                className="w-full h-10 rounded border border-gray-200 cursor-pointer p-1"
              />
            </div>
            {/* Name */}
            <div className="col-span-2">
              <Label>Tên Space *</Label>
              <Input
                required
                placeholder="Hướng dẫn vận hành"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Slug *</Label>
            <Input
              required
              placeholder="huong-dan-van-hanh"
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase() }))}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            />
            <p className="text-xs text-gray-500 mt-1">URL: /wiki/{form.slug || '...'}</p>
          </div>

          <div>
            <Label>Mô tả</Label>
            <Textarea
              placeholder="Tóm tắt nội dung space này..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div>
            <Label>Quyền truy cập</Label>
            <Select
              value={form.access}
              onValueChange={(v) => setForm((p) => ({ ...p, access: v as WikiAccess }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Công khai — Tất cả mọi người</SelectItem>
                <SelectItem value="TEAM">Nhóm — Chỉ nhóm được chỉ định</SelectItem>
                <SelectItem value="PRIVATE">Riêng tư — Chỉ tôi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={createSpace.isPending}>
              {createSpace.isPending ? 'Đang tạo...' : 'Tạo Space'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SpaceList (main export)
// ---------------------------------------------------------------------------
export function SpaceList() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: spaces = [], isLoading } = useWikiSpaces();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Spaces ({spaces.length})
        </h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Tạo Space
        </Button>
      </div>

      {spaces.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium mb-1">Chưa có space nào</p>
          <p className="text-sm text-gray-500 mb-4">Tạo space đầu tiên để bắt đầu viết tài liệu</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Tạo Space đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}

      <SpaceFormDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
}
