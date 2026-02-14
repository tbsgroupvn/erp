import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface LoadingOverlayProps {
  className?: string;
  text?: string;
}

export function LoadingOverlay({ className, text = 'Đang tải...' }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'flex h-screen w-full flex-col items-center justify-center gap-4',
        className,
      )}
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
