'use client';

import type { ComponentType } from 'react';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

type ErrorVariant = 'inline' | 'fullpage';
type ErrorType = 'generic' | 'network' | 'server' | 'permission';

interface ErrorStateProps {
  error?: Error | string | null;
  onRetry?: () => void;
  variant?: ErrorVariant;
  type?: ErrorType;
  className?: string;
}

const TYPE_CONFIG: Record<ErrorType, { icon: ComponentType<{ className?: string }>; title: string; description: string }> = {
  generic: {
    icon: AlertTriangle,
    title: 'Đã xảy ra lỗi',
    description: 'Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.',
  },
  network: {
    icon: WifiOff,
    title: 'Lỗi kết nối',
    description: 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng và thử lại.',
  },
  server: {
    icon: ServerCrash,
    title: 'Lỗi máy chủ',
    description: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.',
  },
  permission: {
    icon: ShieldAlert,
    title: 'Không có quyền truy cập',
    description: 'Bạn không có quyền xem nội dung này. Liên hệ quản trị viên nếu cần.',
  },
};

function getErrorMessage(error?: Error | string | null): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  return error.message || null;
}

export function ErrorState({
  error,
  onRetry,
  variant = 'inline',
  type = 'generic',
  className,
}: ErrorStateProps) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  const errorMessage = getErrorMessage(error);

  if (variant === 'fullpage') {
    return (
      <div
        className={cn(
          'flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center',
          className
        )}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
          <Icon className="h-10 w-10 text-red-500" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold text-foreground">{config.title}</h2>
          <p className="text-muted-foreground">{config.description}</p>
          {errorMessage && process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-red-500 font-mono bg-red-50 dark:bg-red-950/30 rounded px-3 py-2 mt-3">
              {errorMessage}
            </p>
          )}
        </div>
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  // inline variant
  return (
    <div
      className={cn(
        'rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-6',
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
          <Icon className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-900 dark:text-red-200">{config.title}</p>
          <p className="mt-0.5 text-sm text-red-700 dark:text-red-300">{config.description}</p>
          {errorMessage && process.env.NODE_ENV === 'development' && (
            <p className="mt-2 text-xs font-mono text-red-600 dark:text-red-400 truncate">
              {errorMessage}
            </p>
          )}
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0 gap-1.5 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}
