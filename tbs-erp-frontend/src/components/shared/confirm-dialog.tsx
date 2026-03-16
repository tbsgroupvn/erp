'use client';

import * as React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Info, AlertCircle, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

export type ConfirmDialogVariant = 'default' | 'destructive' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
}

const VARIANT_CONFIG: Record<
  ConfirmDialogVariant,
  {
    icon: React.ComponentType<{ className?: string }> | null;
    iconBg: string;
    iconColor: string;
    confirmClass: string;
    buttonVariant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  }
> = {
  default: {
    icon: null,
    iconBg: '',
    iconColor: '',
    confirmClass: '',
    buttonVariant: 'default',
  },
  destructive: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    confirmClass: '',
    buttonVariant: 'destructive',
  },
  warning: {
    icon: AlertCircle,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    confirmClass:
      'bg-amber-500 hover:bg-amber-600 text-white focus-visible:ring-amber-500',
    buttonVariant: 'default',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    confirmClass: '',
    buttonVariant: 'default',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  // Keyboard: Enter => confirm, Escape handled by Radix automatically
  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!open || loading) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Only trigger if focus is not inside a textarea/input to avoid form conflicts
        const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'textarea' && tag !== 'input') {
          e.preventDefault();
          onConfirm();
        }
      }
    },
    [open, loading, onConfirm]
  );

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'sm:rounded-xl'
          )}
        >
          {/* Icon */}
          {Icon && (
            <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-full', config.iconBg)}>
              <Icon className={cn('h-6 w-6', config.iconColor)} />
            </div>
          )}

          <div className={cn('flex flex-col space-y-2', Icon ? 'text-center' : 'text-left')}>
            <AlertDialog.Title id="confirm-dialog-title" className="text-lg font-semibold">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description id="confirm-dialog-description" className="text-sm text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={loading}>
                {cancelText}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={config.buttonVariant}
                onClick={onConfirm}
                disabled={loading}
                aria-busy={loading}
                className={config.confirmClass || undefined}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  confirmText
                )}
              </Button>
            </AlertDialog.Action>
          </div>

          {/* Keyboard hint */}
          <p className="text-center text-xs text-muted-foreground/60">
            Nhấn{' '}
            <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px]">
              Enter
            </kbd>
            {' '}để xác nhận,{' '}
            <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[10px]">
              Esc
            </kbd>
            {' '}để hủy
          </p>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
