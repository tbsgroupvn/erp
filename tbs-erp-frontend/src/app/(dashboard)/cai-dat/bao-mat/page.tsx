'use client';

export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BackupCodesDisplay } from '@/components/auth/backup-codes-display';
import { Disable2FADialog } from '@/components/auth/disable-2fa-dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  twoFactorApi,
  type TwoFactorStatusResponse,
  type TwoFactorSetupResponse,
} from '@/lib/api/two-factor.api';

// ---------------------------------------------------------------------------
// Setup Steps
// ---------------------------------------------------------------------------
type SetupStep = 'idle' | 'qr' | 'verify' | 'backup' | 'done';

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function BaoMatPage() {
  // Status state
  const [status, setStatus] = useState<TwoFactorStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Setup flow state
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [secretCopied, setSecretCopied] = useState(false);

  // SMS Setup state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSettingUpSms, setIsSettingUpSms] = useState(false);
  const [showSmsSetup, setShowSmsSetup] = useState(false);

  // Disable dialog state
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  // Regenerate backup codes state
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);

  const verifyInputRef = useRef<HTMLInputElement>(null);

  // ---- Load 2FA Status ----
  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await twoFactorApi.getStatus();
      setStatus(data);
    } catch {
      // Silently fail — user might not have permission or endpoint might not exist yet
      setStatus({ is2FAEnabled: false, preferredMethod: null, hasPhoneNumber: false });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // ---- Start Setup ----
  const handleStartSetup = async () => {
    setIsSettingUp(true);
    try {
      const data = await twoFactorApi.setup2FA();
      setSetupData(data);
      setSetupStep('qr');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể bắt đầu thiết lập 2FA');
    } finally {
      setIsSettingUp(false);
    }
  };

  // ---- Copy Secret Key ----
  const handleCopySecret = async () => {
    if (!setupData?.secret) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setSecretCopied(true);
      toast.success('Đã sao chép mã bí mật');
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // ---- Verify Code & Enable ----
  const handleVerifyAndEnable = async () => {
    if (verifyCode.length !== 6) return;

    setIsVerifying(true);
    try {
      const result = await twoFactorApi.enable2FA(verifyCode);
      setBackupCodes(result.backupCodes);
      setSetupStep('backup');
      toast.success('Đã bật xác thực 2 yếu tố');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Mã xác thực không đúng');
      setVerifyCode('');
      verifyInputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  // ---- Setup SMS ----
  const handleSetupSms = async () => {
    if (!phoneNumber.trim()) return;

    setIsSettingUpSms(true);
    try {
      await twoFactorApi.setupSms(phoneNumber);
      toast.success('Đã thiết lập SMS thành công');
      setShowSmsSetup(false);
      setPhoneNumber('');
      loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể thiết lập SMS');
    } finally {
      setIsSettingUpSms(false);
    }
  };

  // ---- Regenerate Backup Codes ----
  const handleRegenerateBackupCodes = async () => {
    setIsRegenerating(true);
    try {
      const result = await twoFactorApi.regenerateBackupCodes();
      setRegeneratedCodes(result.backupCodes);
      setShowRegenerateDialog(false);
      toast.success('Đã tạo lại mã backup mới');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tạo lại mã backup');
    } finally {
      setIsRegenerating(false);
    }
  };

  // ---- Finish setup / reset ----
  const handleFinishSetup = () => {
    setSetupStep('idle');
    setSetupData(null);
    setVerifyCode('');
    setBackupCodes([]);
    loadStatus();
  };

  // ---- Disable success handler ----
  const handleDisableSuccess = () => {
    setRegeneratedCodes(null);
    loadStatus();
  };

  // ---- Focus verify input ----
  useEffect(() => {
    if (setupStep === 'verify') {
      verifyInputRef.current?.focus();
    }
  }, [setupStep]);

  // ---- Loading state ----
  if (isLoadingStatus) {
    return (
      <div>
        <PageHeader title="Bảo mật tài khoản" description="Quản lý xác thực 2 yếu tố" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Bảo mật tài khoản" description="Quản lý xác thực 2 yếu tố (2FA)" />

      {/* ================================================================== */}
      {/* Section 1: Current 2FA Status                                       */}
      {/* ================================================================== */}
      {setupStep === 'idle' && (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  {status?.is2FAEnabled ? (
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  ) : (
                    <ShieldOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Xác thực 2 yếu tố</h3>
                  <div className="mt-1 flex items-center gap-2">
                    {status?.is2FAEnabled ? (
                      <Badge variant="default">Đã bật</Badge>
                    ) : (
                      <Badge variant="secondary">Chưa bật</Badge>
                    )}
                    {status?.preferredMethod && (
                      <span className="text-sm text-muted-foreground">
                        Phương thức: {status.preferredMethod === 'TOTP' ? 'Ứng dụng xác thực' : 'SMS'}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {status?.is2FAEnabled
                      ? 'Tài khoản của bạn được bảo vệ bằng xác thực 2 yếu tố.'
                      : 'Tăng cường bảo mật tài khoản bằng xác thực 2 yếu tố.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              {!status?.is2FAEnabled ? (
                <Button onClick={handleStartSetup} disabled={isSettingUp}>
                  {isSettingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                  Thiết lập 2FA
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tắt 2FA
                </Button>
              )}
            </div>
          </div>

          {/* SMS Setup Section (only show when 2FA is enabled) */}
          {status?.is2FAEnabled && (
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Xác thực qua SMS</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status.hasPhoneNumber
                      ? 'Số điện thoại đã được thiết lập để nhận mã OTP.'
                      : 'Thêm số điện thoại để nhận mã OTP qua SMS khi không có ứng dụng xác thực.'}
                  </p>

                  {showSmsSetup ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+84 xxx xxx xxx"
                          className="flex h-10 w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                        <Button
                          onClick={handleSetupSms}
                          disabled={isSettingUpSms || !phoneNumber.trim()}
                          size="sm"
                        >
                          {isSettingUpSms && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                          Xác nhận
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowSmsSetup(false);
                            setPhoneNumber('');
                          }}
                        >
                          Huỷ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowSmsSetup(true)}
                    >
                      <Smartphone className="mr-2 h-4 w-4" aria-hidden="true" />
                      {status.hasPhoneNumber ? 'Cập nhật số điện thoại' : 'Thiết lập SMS'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Backup Codes Management (only show when 2FA is enabled) */}
          {status?.is2FAEnabled && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold">Mã backup</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mã backup dùng khi bạn không thể truy cập ứng dụng xác thực hoặc điện thoại.
              </p>

              {regeneratedCodes ? (
                <div className="mt-4">
                  <BackupCodesDisplay codes={regeneratedCodes} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setRegeneratedCodes(null)}
                  >
                    Đóng
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowRegenerateDialog(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tạo lại mã backup
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 2: Setup Flow                                               */}
      {/* ================================================================== */}

      {/* Step 1: QR Code */}
      {setupStep === 'qr' && setupData && (
        <div className="max-w-md space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">Bước 1: Quét mã QR</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sử dụng ứng dụng xác thực (Google Authenticator, Authy, ...) để quét mã QR bên dưới.
            </p>

            {/* QR Code */}
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg border bg-white p-4">
                <Image
                  src={setupData.qrCodeUrl}
                  alt="Mã QR thiết lập 2FA"
                  width={192}
                  height={192}
                  unoptimized
                />
              </div>
            </div>

            {/* Manual secret */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Hoặc nhập mã thủ công:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                  {setupData.secret}
                </code>
                <Button variant="ghost" size="icon" onClick={handleCopySecret}>
                  {secretCopied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={() => setSetupStep('verify')}>
                Tiếp tục
              </Button>
              <Button variant="ghost" onClick={handleFinishSetup}>
                Huỷ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Verify Code */}
      {setupStep === 'verify' && (
        <div className="max-w-md space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">Bước 2: Xác minh</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhập mã 6 số từ ứng dụng xác thực để hoàn tất thiết lập.
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="verify-code" className="text-sm font-medium">
                  Mã xác thực
                </label>
                <input
                  ref={verifyInputRef}
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && verifyCode.length === 6) {
                      handleVerifyAndEnable();
                    }
                  }}
                  placeholder="000000"
                  disabled={isVerifying}
                  className="flex h-12 w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                  aria-required="true"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleVerifyAndEnable}
                  disabled={isVerifying || verifyCode.length !== 6}
                >
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Xác nhận và bật 2FA
                </Button>
                <Button variant="ghost" onClick={() => setSetupStep('qr')}>
                  Quay lại
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Backup Codes */}
      {setupStep === 'backup' && backupCodes.length > 0 && (
        <div className="max-w-md space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">Bước 3: Lưu mã backup</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lưu lại các mã backup này. Bạn sẽ cần chúng khi không thể sử dụng ứng dụng xác thực.
            </p>

            <div className="mt-4">
              <BackupCodesDisplay codes={backupCodes} />
            </div>

            <div className="mt-6">
              <Button onClick={handleFinishSetup}>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                Hoàn tất
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Dialogs                                                             */}
      {/* ================================================================== */}

      {/* Disable 2FA Dialog */}
      <Disable2FADialog
        open={showDisableDialog}
        onOpenChange={setShowDisableDialog}
        onSuccess={handleDisableSuccess}
      />

      {/* Regenerate Backup Codes Confirmation */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              Tạo lại mã backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              Các mã backup cũ sẽ không còn sử dụng được. Bạn sẽ nhận được 10 mã backup mới.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateBackupCodes}
              disabled={isRegenerating}
            >
              {isRegenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Tạo lại
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
