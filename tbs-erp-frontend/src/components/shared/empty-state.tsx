import type { ReactNode } from 'react';
import { Inbox, SearchX, FolderOpen, PackageX, FileX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction | ReactNode;
  className?: string;
  /** Size of the icon container */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_STYLES = {
  sm: { wrapper: 'h-12 w-12', icon: 'h-6 w-6', title: 'text-base', padding: 'py-8' },
  md: { wrapper: 'h-16 w-16', icon: 'h-8 w-8', title: 'text-lg', padding: 'py-12' },
  lg: { wrapper: 'h-20 w-20', icon: 'h-10 w-10', title: 'text-xl', padding: 'py-16' },
};

function isActionObject(action: unknown): action is EmptyStateAction {
  return typeof action === 'object' && action !== null && 'label' in action && 'onClick' in action;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const s = SIZE_STYLES[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-fade-in',
        s.padding,
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-muted mb-4',
          s.wrapper
        )}
      >
        <Icon className={cn('text-muted-foreground', s.icon)} />
      </div>
      <h3 className={cn('font-semibold text-foreground', s.title)}>{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          {isActionObject(action) ? (
            <Button
              variant={action.variant ?? 'default'}
              onClick={action.onClick}
              size="sm"
            >
              {action.label}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}

// ─── Presets ──────────────────────────────────────────────────────────────────

interface PresetProps {
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

/** Shown when a search/filter returns zero results */
export function NoResults({ onAction, actionLabel = 'Xoa bo loc', className }: PresetProps) {
  return (
    <EmptyState
      icon={SearchX}
      title="Khong tim thay ket qua"
      description="Thu thay doi tu khoa tim kiem hoac dieu chinh bo loc de tim ket qua phu hop."
      action={onAction ? { label: actionLabel, onClick: onAction, variant: 'outline' } : undefined}
      className={className}
    />
  );
}

/** Shown when there is genuinely no data in the system yet */
export function NoData({ onAction, actionLabel = 'Tao moi', className }: PresetProps) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="Chua co du lieu"
      description="Hien tai chua co du lieu nao. Bat dau bang cach tao ban ghi dau tien."
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      className={className}
    />
  );
}

/** Shown for an empty list / collection */
export function EmptyList({ onAction, actionLabel = 'Them moi', className }: PresetProps) {
  return (
    <EmptyState
      icon={PackageX}
      title="Danh sach trong"
      description="Chua co muc nao trong danh sach nay. Nhan vao nut ben duoi de them muc dau tien."
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      className={className}
    />
  );
}

/** Shown when there are no documents/files */
export function NoDocuments({ onAction, actionLabel = 'Tai len', className }: PresetProps) {
  return (
    <EmptyState
      icon={FileX}
      title="Chua co tai lieu"
      description="Chua co tai lieu nao duoc dinh kem. Tai len tai lieu dau tien."
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      className={className}
    />
  );
}
