'use client';

import { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Phone,
  Mail,
  Clock,
  User,
  Briefcase,
  X,
  ExternalLink,
  Trash2,
  Edit3,
  ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useRecruitmentBoard,
  useRecruitmentStats,
  useCreateCandidate,
  useUpdateCandidate,
  useUpdateCandidateStatus,
  useDeleteCandidate,
} from '@/lib/hooks/use-recruitment';
import {
  CandidateStatus,
  CandidateSource,
  type Candidate,
  type CreateCandidateDto,
} from '@/lib/api/recruitment.api';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { cn } from '@/lib/utils/cn';

// ─── Hằng số giao diện ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CandidateStatus,
  { label: string; color: string; headerColor: string; dot: string }
> = {
  [CandidateStatus.NEW]: {
    label: 'Mới',
    color: 'border-slate-200 bg-slate-50',
    headerColor: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  },
  [CandidateStatus.SCREENING]: {
    label: 'Sàng lọc',
    color: 'border-blue-200 bg-blue-50',
    headerColor: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  [CandidateStatus.INTERVIEW]: {
    label: 'Phỏng vấn',
    color: 'border-violet-200 bg-violet-50',
    headerColor: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
  },
  [CandidateStatus.OFFERED]: {
    label: 'Đề xuất',
    color: 'border-amber-200 bg-amber-50',
    headerColor: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  [CandidateStatus.HIRED]: {
    label: 'Tuyển dụng',
    color: 'border-emerald-200 bg-emerald-50',
    headerColor: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  [CandidateStatus.REJECTED]: {
    label: 'Từ chối',
    color: 'border-red-200 bg-red-50',
    headerColor: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
};

const SOURCE_LABELS: Record<CandidateSource, string> = {
  [CandidateSource.WEBSITE]: 'Website',
  [CandidateSource.REFERRAL]: 'Giới thiệu',
  [CandidateSource.JOB_BOARD]: 'Job board',
  [CandidateSource.LINKEDIN]: 'LinkedIn',
  [CandidateSource.HEADHUNT]: 'Headhunt',
};

const SOURCE_COLORS: Record<CandidateSource, string> = {
  [CandidateSource.WEBSITE]: 'bg-blue-100 text-blue-700',
  [CandidateSource.REFERRAL]: 'bg-green-100 text-green-700',
  [CandidateSource.JOB_BOARD]: 'bg-orange-100 text-orange-700',
  [CandidateSource.LINKEDIN]: 'bg-sky-100 text-sky-700',
  [CandidateSource.HEADHUNT]: 'bg-purple-100 text-purple-700',
};

// Các chuyển trạng thái hợp lệ (dùng cho dropdown)
const NEXT_STATUSES: Record<CandidateStatus, CandidateStatus[]> = {
  [CandidateStatus.NEW]: [CandidateStatus.SCREENING, CandidateStatus.REJECTED],
  [CandidateStatus.SCREENING]: [CandidateStatus.INTERVIEW, CandidateStatus.REJECTED],
  [CandidateStatus.INTERVIEW]: [CandidateStatus.OFFERED, CandidateStatus.REJECTED],
  [CandidateStatus.OFFERED]: [CandidateStatus.HIRED, CandidateStatus.REJECTED],
  [CandidateStatus.HIRED]: [],
  [CandidateStatus.REJECTED]: [],
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ─── Form thêm / sửa ứng viên ────────────────────────────────────────────────

interface CandidateFormProps {
  initial?: Partial<CreateCandidateDto>;
  onSubmit: (data: CreateCandidateDto) => void;
  isLoading?: boolean;
  onCancel: () => void;
  submitLabel?: string;
}

function CandidateForm({
  initial,
  onSubmit,
  isLoading,
  onCancel,
  submitLabel = 'Thêm ứng viên',
}: CandidateFormProps) {
  const [form, setForm] = useState<CreateCandidateDto>({
    fullName: initial?.fullName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    position: initial?.position ?? '',
    source: initial?.source,
    resumeUrl: initial?.resumeUrl ?? '',
    notes: initial?.notes ?? '',
  });

  const set = (key: keyof CreateCandidateDto, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val || undefined }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.position.trim()) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="fullName">
            Họ và tên <span className="text-red-500">*</span>
          </Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Nguyễn Văn A"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            placeholder="nguyenvana@gmail.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input
            id="phone"
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="0901234567"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="position">
            Vị trí ứng tuyển <span className="text-red-500">*</span>
          </Label>
          <Input
            id="position"
            value={form.position}
            onChange={(e) => set('position', e.target.value)}
            placeholder="Nhân viên kinh doanh"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source">Nguồn ứng viên</Label>
          <Select
            value={form.source ?? ''}
            onValueChange={(v) => setForm((p) => ({ ...p, source: v as CandidateSource || undefined }))}
          >
            <SelectTrigger id="source">
              <SelectValue placeholder="Chọn nguồn" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resumeUrl">Link CV / Hồ sơ</Label>
          <Input
            id="resumeUrl"
            value={form.resumeUrl ?? ''}
            onChange={(e) => set('resumeUrl', e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Ghi chú</Label>
          <textarea
            id="notes"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Ghi chú về ứng viên..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={isLoading || !form.fullName.trim() || !form.position.trim()}>
          {isLoading ? 'Đang lưu...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Dialog chi tiết ứng viên ─────────────────────────────────────────────────

interface CandidateDetailDialogProps {
  candidate: Candidate;
  onClose: () => void;
}

function CandidateDetailDialog({ candidate, onClose }: CandidateDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [statusReason, setStatusReason] = useState('');

  const updateCandidate = useUpdateCandidate();
  const updateStatus = useUpdateCandidateStatus();
  const deleteCandidate = useDeleteCandidate();

  const nextStatuses = NEXT_STATUSES[candidate.status as CandidateStatus] ?? [];
  const cfg = STATUS_CONFIG[candidate.status as CandidateStatus];

  const handleStatusChange = (newStatus: CandidateStatus) => {
    updateStatus.mutate(
      { id: candidate.id, data: { status: newStatus, reason: statusReason || undefined } },
      {
        onSuccess: () => {
          setStatusReason('');
          onClose();
        },
      },
    );
  };

  const handleUpdate = (data: CreateCandidateDto) => {
    updateCandidate.mutate(
      { id: candidate.id, data },
      { onSuccess: () => { setIsEditing(false); onClose(); } },
    );
  };

  const handleDelete = () => {
    if (!confirm(`Xác nhận xóa ứng viên "${candidate.fullName}"?`)) return;
    deleteCandidate.mutate(candidate.id, { onSuccess: onClose });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
            {getInitials(candidate.fullName)}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{candidate.fullName}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {candidate.position}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            cfg?.headerColor,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg?.dot)} />
          {cfg?.label}
        </span>
      </div>

      {!isEditing ? (
        <>
          {/* Thông tin liên hệ */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {candidate.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{candidate.email}</span>
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{candidate.phone}</span>
              </div>
            )}
            {candidate.source && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    SOURCE_COLORS[candidate.source as CandidateSource],
                  )}
                >
                  {SOURCE_LABELS[candidate.source as CandidateSource] ?? candidate.source}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{timeAgo(candidate.createdAt)}</span>
            </div>
          </div>

          {/* CV link */}
          {candidate.resumeUrl && (
            <a
              href={candidate.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Xem CV / Hồ sơ
            </a>
          )}

          {/* Ghi chú */}
          {candidate.notes && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {candidate.notes}
            </div>
          )}

          {/* Chuyển trạng thái */}
          {nextStatuses.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Chuyển trạng thái</p>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Lý do / ghi chú (tùy chọn)..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px] resize-none"
              />
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((ns) => {
                  const nsCfg = STATUS_CONFIG[ns];
                  return (
                    <button
                      key={ns}
                      onClick={() => handleStatusChange(ns)}
                      disabled={updateStatus.isPending}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50',
                        nsCfg.headerColor,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', nsCfg.dot)} />
                      {ns === CandidateStatus.REJECTED ? 'Từ chối' : `Chuyển sang ${nsCfg.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleteCandidate.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Xóa
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4 mr-1.5" />
              Chỉnh sửa
            </Button>
          </div>
        </>
      ) : (
        <CandidateForm
          initial={{
            fullName: candidate.fullName,
            email: candidate.email ?? '',
            phone: candidate.phone ?? '',
            position: candidate.position,
            source: candidate.source as CandidateSource | undefined,
            resumeUrl: candidate.resumeUrl ?? '',
            notes: candidate.notes ?? '',
          }}
          onSubmit={handleUpdate}
          isLoading={updateCandidate.isPending}
          onCancel={() => setIsEditing(false)}
          submitLabel="Lưu thay đổi"
        />
      )}
    </div>
  );
}

// ─── Card ứng viên trong Kanban ────────────────────────────────────────────────

interface CandidateCardProps {
  candidate: Candidate;
  onClick: () => void;
}

function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-white p-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-150 space-y-2.5"
    >
      {/* Tên + vị trí */}
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {getInitials(candidate.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate leading-tight">{candidate.fullName}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{candidate.position}</p>
        </div>
      </div>

      {/* Source badge */}
      {candidate.source && (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            SOURCE_COLORS[candidate.source as CandidateSource] ?? 'bg-gray-100 text-gray-600',
          )}
        >
          {SOURCE_LABELS[candidate.source as CandidateSource] ?? candidate.source}
        </span>
      )}

      {/* Liên hệ */}
      <div className="space-y-1">
        {candidate.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{candidate.email}</span>
          </div>
        )}
        {candidate.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{candidate.phone}</span>
          </div>
        )}
      </div>

      {/* Thời gian */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{timeAgo(candidate.createdAt)}</span>
      </div>
    </button>
  );
}

// ─── Cột Kanban ───────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: CandidateStatus;
  count: number;
  candidates: Candidate[];
  onCardClick: (c: Candidate) => void;
}

function KanbanColumnCard({ status, count, candidates, onCardClick }: KanbanColumnProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className={cn('flex flex-col rounded-xl border-2 min-h-[400px]', cfg.color)}>
      {/* Header cột */}
      <div className={cn('flex items-center justify-between rounded-t-lg px-3 py-2.5', cfg.headerColor)}>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
          <span className="text-sm font-semibold">{cfg.label}</span>
        </div>
        <span className="text-xs font-bold bg-white/60 rounded-full px-2 py-0.5 min-w-[22px] text-center">
          {count}
        </span>
      </div>

      {/* Danh sách cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-340px)]">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
            <User className="h-8 w-8 mb-2" />
            <p className="text-xs">Không có ứng viên</p>
          </div>
        ) : (
          candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} onClick={() => onCardClick(c)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Trang chính ─────────────────────────────────────────────────────────────

export default function TuyenDungPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const { data: boardData, isLoading } = useRecruitmentBoard(debouncedSearch || undefined);
  const { data: statsData } = useRecruitmentStats();
  const createCandidate = useCreateCandidate();

  const handleCreate = (data: CreateCandidateDto) => {
    createCandidate.mutate(data, { onSuccess: () => setIsAddOpen(false) });
  };

  const orderedStatuses = [
    CandidateStatus.NEW,
    CandidateStatus.SCREENING,
    CandidateStatus.INTERVIEW,
    CandidateStatus.OFFERED,
    CandidateStatus.HIRED,
    CandidateStatus.REJECTED,
  ];

  const stats = statsData as any;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tuyển dụng"
        description="Quản lý ứng viên theo quy trình tuyển dụng"
        infoKey="tuyen-dung"
      >
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Thêm ứng viên
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Thêm ứng viên mới</DialogTitle>
            </DialogHeader>
            <CandidateForm
              onSubmit={handleCreate}
              isLoading={createCandidate.isPending}
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Thống kê tổng quan */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {orderedStatuses.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const count = stats.byStatus?.[status] ?? 0;
            return (
              <div
                key={status}
                className={cn(
                  'rounded-lg border-2 p-3 text-center transition-colors',
                  cfg.color,
                )}
              >
                <p className={cn('text-xl font-bold', cfg.headerColor.split(' ')[1])}>{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Thanh tìm kiếm */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, email, vị trí..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {stats?.total > 0 && (
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            Tổng cộng: <span className="font-semibold text-foreground">{stats.total}</span> ứng viên
          </p>
        )}
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-6 gap-3">
          {orderedStatuses.map((s) => (
            <div
              key={s}
              className={cn('rounded-xl border-2 min-h-[300px] animate-pulse', STATUS_CONFIG[s].color)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 overflow-x-auto pb-4">
          {orderedStatuses.map((status) => {
            const col = boardData?.[status];
            return (
              <KanbanColumnCard
                key={status}
                status={status}
                count={col?.count ?? 0}
                candidates={col?.items ?? []}
                onCardClick={setSelectedCandidate}
              />
            );
          })}
        </div>
      )}

      {/* Dialog chi tiết ứng viên */}
      <Dialog
        open={!!selectedCandidate}
        onOpenChange={(open) => { if (!open) setSelectedCandidate(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thông tin ứng viên</DialogTitle>
          </DialogHeader>
          {selectedCandidate && (
            <CandidateDetailDialog
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidate(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
