'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, X } from 'lucide-react';
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
import { useCreateRoom } from '@/lib/hooks/use-video';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users.api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const schema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề'),
  scheduledAt: z.string().optional(),
  maxParticipants: z.coerce.number().int().min(2).optional().or(z.literal('')),
  calendarEventId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback sau khi tao phong thanh cong */
  onCreated?: (roomId: string) => void;
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  onCreated,
}: ScheduleMeetingDialogProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const createRoom = useCreateRoom();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '' },
  });

  // Fetch user list for participant selection
  const { data: usersData } = useQuery({
    queryKey: ['users', 'list', { search: userSearch, limit: 30 }],
    queryFn: () => usersApi.list({ search: userSearch || undefined, limit: 30 }),
    enabled: open,
    staleTime: 60_000,
  });

  const users = usersData?.data ?? [];

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const onSubmit = async (values: FormValues) => {
    const room = await createRoom.mutateAsync({
      title: values.title,
      scheduledAt: values.scheduledAt || undefined,
      maxParticipants:
        values.maxParticipants
          ? Number(values.maxParticipants)
          : undefined,
      participantIds: selectedUserIds,
      calendarEventId: values.calendarEventId || undefined,
    });
    reset();
    setSelectedUserIds([]);
    setUserSearch('');
    onOpenChange(false);
    onCreated?.(room.id);
  };

  const handleClose = () => {
    reset();
    setSelectedUserIds([]);
    setUserSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Tạo cuộc họp mới
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Tiêu đề cuộc họp *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="VD: Họp triển khai dự án Q2"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Scheduled At */}
          <div className="space-y-1">
            <Label htmlFor="scheduledAt">Thời gian (để trống = bắt đầu ngay)</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              {...register('scheduledAt')}
            />
          </div>

          {/* Max participants */}
          <div className="space-y-1">
            <Label htmlFor="maxParticipants">Số người tối đa</Label>
            <Input
              id="maxParticipants"
              type="number"
              min={2}
              {...register('maxParticipants')}
              placeholder="Không giới hạn nếu để trống"
            />
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label>Người tham gia</Label>

            {/* Selected badges */}
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedUserIds.map((uid) => {
                  const u = users.find((x) => x.id === uid);
                  return (
                    <Badge
                      key={uid}
                      variant="secondary"
                      className="gap-1 cursor-pointer"
                      onClick={() => toggleUser(uid)}
                    >
                      {u?.fullName ?? uid}
                      <X className="h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Search input */}
            <Input
              placeholder="Tìm tên người dùng..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />

            {/* User list dropdown */}
            {users.length > 0 && (
              <div className="border rounded-md max-h-36 overflow-y-auto divide-y">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                      selectedUserIds.includes(u.id) ? 'bg-primary/10 font-medium' : ''
                    }`}
                  >
                    <span>{u.fullName}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {u.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={createRoom.isPending}>
              {createRoom.isPending ? 'Đang tạo...' : 'Tạo cuộc họp'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
