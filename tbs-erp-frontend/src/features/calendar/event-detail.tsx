'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Clock,
  Users,
  Building2,
  Pencil,
  Trash2,
  Check,
  X,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { useRespondToEvent, useDeleteEvent } from '@/lib/hooks/use-calendar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { EventForm } from './event-form';
import type { CalendarEvent, ParticipantStatus } from '@/lib/types/calendar.types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const startStr = start.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    if (
      start.toDateString() === end.toDateString()
    ) {
      return `Ca ngay, ${startStr}`;
    }
    const endStr = end.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Ca ngay, ${startStr} — ${endStr}`;
  }

  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  const start = new Date(event.startAt).toLocaleString('vi-VN', opts);
  const end = new Date(event.endAt).toLocaleString('vi-VN', opts);
  return `${start} — ${end}`;
}

const PARTICIPANT_STATUS_CONFIG: Record<
  ParticipantStatus,
  { label: string; className: string }
> = {
  INVITED: { label: 'Cho phan hoi', className: 'border-yellow-300 text-yellow-700 bg-yellow-50' },
  ACCEPTED: { label: 'Tham du', className: 'border-green-300 text-green-700 bg-green-50' },
  DECLINED: { label: 'Tu choi', className: 'border-red-300 text-red-700 bg-red-50' },
  TENTATIVE: { label: 'Co the', className: 'border-blue-300 text-blue-700 bg-blue-50' },
};

const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: 'Cong khai',
  TEAM: 'Team',
  PRIVATE: 'Rieng tu',
};

// ─── Props ─────────────────────────────────────────────────────────────────

interface EventDetailProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function EventDetail({ event, onClose }: EventDetailProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const respondMutation = useRespondToEvent();
  const deleteMutation = useDeleteEvent();

  const { user } = useAuthStore();
  const currentUserId = user?.id ?? '';

  if (!event) return null;

  const isOrganizer = event.organizerId === currentUserId;
  const myParticipation = event.participants.find((p) => p.userId === currentUserId);

  const handleRespond = async (status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') => {
    await respondMutation.mutateAsync({ id: event.id, status });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(event.id);
    onClose();
  };

  const open = !!event;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className="mt-1 h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: event.color }}
              />
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg leading-snug">{event.title}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {VISIBILITY_LABEL[event.visibility] ?? event.visibility}
                  {event.recurrence && (
                    <span className="ml-2 inline-flex items-center gap-0.5">
                      <RefreshCw className="h-3 w-3" /> Lap lai
                    </span>
                  )}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Time */}
            <div className="flex items-start gap-2 text-sm">
              <Clock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{formatEventTime(event)}</span>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            )}

            {/* Room */}
            {event.room && (
              <div className="flex items-start gap-2 text-sm">
                <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  {event.room.name}
                  {event.room.location && (
                    <span className="text-muted-foreground"> — {event.room.location}</span>
                  )}
                  <span className="text-muted-foreground"> ({event.room.capacity} nguoi)</span>
                </span>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
                {event.description}
              </div>
            )}

            {/* Organizer */}
            <div className="text-sm">
              <span className="text-muted-foreground">Nguoi to chuc: </span>
              <span className="font-medium">{event.organizer.fullName}</span>
              <span className="text-muted-foreground"> ({event.organizer.email})</span>
            </div>

            {/* Participants */}
            {event.participants.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Nguoi tham gia ({event.participants.length})
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {event.participants.map((p) => {
                    const cfg = PARTICIPANT_STATUS_CONFIG[p.status];
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                            {p.user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{p.user.fullName}</span>
                        </div>
                        <Badge
                          className={`shrink-0 border text-xs ${cfg.className}`}
                          variant="outline"
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RSVP buttons (for non-organizer participants) */}
            {!isOrganizer && myParticipation && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Phan hoi loi moi</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={myParticipation.status === 'ACCEPTED' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => handleRespond('ACCEPTED')}
                    disabled={respondMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Tham du
                  </Button>
                  <Button
                    size="sm"
                    variant={myParticipation.status === 'TENTATIVE' ? 'secondary' : 'outline'}
                    className="gap-1.5"
                    onClick={() => handleRespond('TENTATIVE')}
                    disabled={respondMutation.isPending}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Co the
                  </Button>
                  <Button
                    size="sm"
                    variant={myParticipation.status === 'DECLINED' ? 'destructive' : 'outline'}
                    className="gap-1.5"
                    onClick={() => handleRespond('DECLINED')}
                    disabled={respondMutation.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                    Tu choi
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isOrganizer && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-destructive">Xac nhan xoa?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Dang xoa...' : 'Xoa'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Huy
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xoa
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        onClose();
                        setShowEdit(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Chinh sua
                    </Button>
                  </>
                )}
              </>
            )}
            <Button variant="outline" onClick={onClose}>
              Dong
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit form */}
      <EventForm
        open={showEdit}
        onOpenChange={setShowEdit}
        event={event}
      />
    </>
  );
}
