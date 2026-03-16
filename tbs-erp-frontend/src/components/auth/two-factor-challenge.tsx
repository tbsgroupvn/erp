'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Loader2, ArrowLeft, Smartphone, Shield, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { twoFactorApi } from '@/lib/api/two-factor.api';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserProfile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TwoFactorChallengeProps {
  userId: string;
  methods: string[];
  tempToken: string;
  onSuccess: (user: UserProfile, accessToken: string) => void;
  onBack: () => void;
}

type InputMode = 'TOTP' | 'SMS' | 'BACKUP';

const CODE_LENGTH = 6;
const BACKUP_CODE_LENGTH = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TwoFactorChallenge({
  userId,
  methods,
  tempToken,
  onSuccess,
  onBack,
}: TwoFactorChallengeProps) {
  const [mode, setMode] = useState<InputMode>(
    methods.includes('TOTP') ? 'TOTP' : 'SMS',
  );
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [error, setError] = useState('');
  const [smsCooldown, setSmsCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const currentLength = mode === 'BACKUP' ? BACKUP_CODE_LENGTH : CODE_LENGTH;

  // ---- Auto-submit when code is complete ----
  const handleVerify = useCallback(
    async (verifyCode: string) => {
      if (isVerifying) return;

      setIsVerifying(true);
      setError('');

      try {
        const methodParam = mode === 'BACKUP' ? 'BACKUP' : mode;
        const result = await twoFactorApi.verify2FA(
          userId,
          verifyCode,
          tempToken,
          methodParam,
        );

        const user = result.user as unknown as UserProfile;
        onSuccess(user, result.accessToken);
      } catch (err: any) {
        const message =
          err.response?.data?.message || 'Mã xác thực không đúng';
        setError(message);
        toast.error(message);
        // Clear the code on error
        setCode('');
        // Re-focus first input
        if (mode !== 'BACKUP') {
          inputRefs.current[0]?.focus();
        } else {
          backupInputRef.current?.focus();
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, mode, userId, tempToken, onSuccess],
  );

  // ---- Handle individual digit input ----
  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    setCode((prev) => {
      const chars = prev.split('');
      chars[index] = digit;
      const newCode = chars.join('').slice(0, currentLength);

      // Auto-submit when complete
      if (newCode.length === currentLength && digit) {
        // Defer to allow state to update
        setTimeout(() => handleVerify(newCode), 0);
      }

      return newCode;
    });

    // Auto-advance to next input
    if (digit && index < currentLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && code.length === currentLength) {
      handleVerify(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, currentLength);
    if (pasted.length > 0) {
      setCode(pasted);
      const lastIndex = Math.min(pasted.length, currentLength) - 1;
      inputRefs.current[lastIndex]?.focus();
      if (pasted.length === currentLength) {
        setTimeout(() => handleVerify(pasted), 0);
      }
    }
  };

  // ---- SMS cooldown timer ----
  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = setInterval(() => {
      setSmsCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [smsCooldown]);

  // ---- Send SMS OTP ----
  const handleSendSms = async () => {
    if (isSendingSms || smsCooldown > 0) return;

    setIsSendingSms(true);
    try {
      await twoFactorApi.sendSmsOtp(userId);
      toast.success('Mã OTP đã được gửi qua SMS');
      setSmsCooldown(60);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gửi SMS');
    } finally {
      setIsSendingSms(false);
    }
  };

  // ---- Switch mode ----
  const switchMode = (newMode: InputMode) => {
    setMode(newMode);
    setCode('');
    setError('');
  };

  // ---- Auto-focus first input ----
  useEffect(() => {
    if (mode !== 'BACKUP') {
      inputRefs.current[0]?.focus();
    } else {
      backupInputRef.current?.focus();
    }
  }, [mode]);

  // ---- Auto-send SMS when switching to SMS mode ----
  useEffect(() => {
    if (mode === 'SMS' && smsCooldown === 0) {
      handleSendSms();
    }
    // Only run when mode changes to SMS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="space-y-6" role="region" aria-label="Xác thực 2 yếu tố">
      {/* Header */}
      <div className="text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Shield className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Xác thực 2 yếu tố</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'TOTP' && 'Nhập mã từ ứng dụng xác thực của bạn'}
          {mode === 'SMS' && 'Nhập mã OTP đã gửi tới điện thoại của bạn'}
          {mode === 'BACKUP' && 'Nhập một trong các mã backup của bạn'}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Code input - OTP style */}
      {mode !== 'BACKUP' ? (
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {Array.from({ length: currentLength }).map((_, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={code[index] || ''}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isVerifying}
              aria-label={`Số thứ ${index + 1}`}
              className="h-12 w-10 rounded-md border bg-background text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            />
          ))}
        </div>
      ) : (
        /* Backup code input */
        <div className="space-y-2">
          <input
            ref={backupInputRef}
            type="text"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, BACKUP_CODE_LENGTH);
              setCode(val);
              if (val.length === BACKUP_CODE_LENGTH) {
                setTimeout(() => handleVerify(val), 0);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === BACKUP_CODE_LENGTH) {
                handleVerify(code);
              }
            }}
            disabled={isVerifying}
            placeholder="Nhập mã backup"
            className="flex h-12 w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            aria-label="Mã backup"
          />
        </div>
      )}

      {/* Loading indicator */}
      {isVerifying && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang xác thực...
        </div>
      )}

      {/* SMS resend button */}
      {mode === 'SMS' && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleSendSms}
            disabled={isSendingSms || smsCooldown > 0}
            className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {isSendingSms ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Đang gửi...
              </span>
            ) : smsCooldown > 0 ? (
              `Gửi lại sau ${smsCooldown}s`
            ) : (
              'Gửi mã SMS'
            )}
          </button>
        </div>
      )}

      {/* Method switchers */}
      <div className="space-y-2">
        {/* Toggle TOTP/SMS */}
        {methods.includes('TOTP') && methods.includes('SMS') && mode !== 'BACKUP' && (
          <button
            type="button"
            onClick={() => switchMode(mode === 'TOTP' ? 'SMS' : 'TOTP')}
            className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            {mode === 'TOTP' ? (
              <>
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                Dùng mã SMS
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" aria-hidden="true" />
                Dùng ứng dụng xác thực
              </>
            )}
          </button>
        )}

        {/* Backup code link */}
        {mode !== 'BACKUP' ? (
          <button
            type="button"
            onClick={() => switchMode('BACKUP')}
            className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Dùng mã backup
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode(methods.includes('TOTP') ? 'TOTP' : 'SMS')}
            className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shield className="h-4 w-4" aria-hidden="true" />
            Quay lại xác thực thường
          </button>
        )}
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Quay lại
      </button>
    </div>
  );
}
