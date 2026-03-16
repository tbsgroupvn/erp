'use client';

import { useState } from 'react';
import { Copy, Check, Link, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useShareFile, useFileShares, useRemoveShare } from '@/lib/hooks/use-drive';
import type { DriveFile, DriveFileShare, DrivePermission } from '@/lib/types/drive.types';
import { toast } from 'sonner';

const PERMISSION_LABELS: Record<DrivePermission, string> = {
  VIEW: 'Xem',
  DOWNLOAD: 'Tải xuống',
  EDIT: 'Chỉnh sửa',
  MANAGE: 'Quản lý',
};

interface ShareDialogProps {
  file: DriveFile;
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ file, open, onClose }: ShareDialogProps) {
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState<DrivePermission>('VIEW');
  const [expiresAt, setExpiresAt] = useState('');
  const [generateLink, setGenerateLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: shares = [], isLoading } = useFileShares(file.id, open);
  const shareFile = useShareFile();
  const removeShare = useRemoveShare();

  const handleShare = () => {
    if (!userId.trim() && !generateLink) {
      toast.error('Nhập ID user hoặc bật "Tạo link chia sẻ"');
      return;
    }

    shareFile.mutate(
      {
        id: file.id,
        dto: {
          userId: userId.trim() || undefined,
          permission,
          expiresAt: expiresAt || undefined,
          generateLink,
        },
      },
      {
        onSuccess: () => {
          setUserId('');
          setExpiresAt('');
          setGenerateLink(false);
        },
      },
    );
  };

  const handleCopyLink = (share: DriveFileShare) => {
    if (!share.shareToken) return;
    const link = `${window.location.origin}/drive/shared/${share.shareToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Đã sao chép link');
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Chia sẻ: {file.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share with user */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>ID người dùng</Label>
              <Input
                placeholder="Nhap user ID..."
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Quyền truy cập</Label>
              <Select
                value={permission}
                onValueChange={(v) => setPermission(v as DrivePermission)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERMISSION_LABELS) as DrivePermission[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERMISSION_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Ngày hết hạn (tùy chọn)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            {/* Public link toggle */}
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Tạo link chia sẻ công khai</span>
              </div>
              <Switch checked={generateLink} onCheckedChange={setGenerateLink} />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleShare}
            disabled={shareFile.isPending}
          >
            {shareFile.isPending ? 'Đang xử lý...' : 'Chia sẻ'}
          </Button>

          {/* Existing shares */}
          {shares.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Đang chia sẻ với</p>
                <div className="space-y-2">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          {share.userId ? share.userId : 'Liên kết công khai'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-xs py-0">
                            {PERMISSION_LABELS[share.permission]}
                          </Badge>
                          {share.expiresAt && (
                            <span className="text-xs text-muted-foreground">
                              Hết hạn {new Date(share.expiresAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {share.shareToken && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyLink(share)}
                          >
                            {copiedId === share.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeShare.mutate(share.id)}
                          disabled={removeShare.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
