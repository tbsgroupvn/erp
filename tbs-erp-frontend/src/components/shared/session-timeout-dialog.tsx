'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { UseIdleTimeoutReturn } from '@/lib/hooks/use-idle-timeout';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m > 0) {
    return `${m} phut ${s.toString().padStart(2, '0')} giay`;
  }
  return `${s} giay`;
}

interface SessionTimeoutDialogProps {
  showWarning: UseIdleTimeoutReturn['showWarning'];
  secondsLeft: UseIdleTimeoutReturn['secondsLeft'];
  stayLoggedIn: UseIdleTimeoutReturn['stayLoggedIn'];
}

export function SessionTimeoutDialog({
  showWarning,
  secondsLeft,
  stayLoggedIn,
}: SessionTimeoutDialogProps) {
  return (
    <Dialog open={showWarning} onOpenChange={(open) => { if (!open) stayLoggedIn(); }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Phien lam viec sap het han</DialogTitle>
          <DialogDescription>
            Ban se tu dong bi dang xuat sau{' '}
            <span className="font-semibold text-destructive">
              {formatTime(secondsLeft)}
            </span>{' '}
            do khong co hoat dong. Nhan &quot;Tiep tuc&quot; de duy tri phien lam viec.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="default" onClick={stayLoggedIn} autoFocus>
            Tiep tuc lam viec
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
