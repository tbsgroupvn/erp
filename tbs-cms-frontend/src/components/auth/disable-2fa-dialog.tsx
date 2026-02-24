'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { twoFactorApi } from '@/lib/api/two-factor.api';

interface Disable2FADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function Disable2FADialog({
  open,
  onOpenChange,
  onSuccess,
}: Disable2FADialogProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCode('');
      setPassword('');
      setError('');
      // Focus code input after dialog animation
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || !password) {
      setError('Vui long nhap day du thong tin');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await twoFactorApi.disable2FA(code, password);
      toast.success('Da tat xac thuc 2 yeu to');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Khong the tat xac thuc 2 yeu to';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              Tat xac thuc 2 yeu to
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tat xac thuc 2 yeu to se lam giam bao mat tai khoan. Ban can nhap
              ma xac thuc hien tai va mat khau de xac nhan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {/* 2FA Code */}
            <div className="space-y-2">
              <label htmlFor="disable-2fa-code" className="text-sm font-medium">
                Ma xac thuc (6 so)
              </label>
              <input
                ref={codeInputRef}
                id="disable-2fa-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={isSubmitting}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                aria-required="true"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="disable-2fa-password" className="text-sm font-medium">
                Mat khau tai khoan
              </label>
              <input
                id="disable-2fa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhap mat khau"
                disabled={isSubmitting}
                autoComplete="current-password"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                aria-required="true"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Huy</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting || code.length < 6 || !password}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Tat 2FA
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
