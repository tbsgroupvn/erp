'use client';

export const dynamic = 'force-dynamic';

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Khong the bat dau thiet lap 2FA');
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
      toast.success('Da sao chep ma bi mat');
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error('Khong the sao chep');
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
      toast.success('Da bat xac thuc 2 yeu to');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ma xac thuc khong dung');
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
      toast.success('Da thiet lap SMS thanh cong');
      setShowSmsSetup(false);
      setPhoneNumber('');
      loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Khong the thiet lap SMS');
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
      toast.success('Da tao lai ma backup moi');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Khong the tao lai ma backup');
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
        <PageHeader title="Bao mat tai khoan" description="Quan ly xac thuc 2 yeu to" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Bao mat tai khoan" description="Quan ly xac thuc 2 yeu to (2FA)" />

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
                  <h3 className="text-lg font-semibold">Xac thuc 2 yeu to</h3>
                  <div className="mt-1 flex items-center gap-2">
                    {status?.is2FAEnabled ? (
                      <Badge variant="default">Da bat</Badge>
                    ) : (
                      <Badge variant="secondary">Chua bat</Badge>
                    )}
                    {status?.preferredMethod && (
                      <span className="text-sm text-muted-foreground">
                        Phuong thuc: {status.preferredMethod === 'TOTP' ? 'Ung dung xac thuc' : 'SMS'}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {status?.is2FAEnabled
                      ? 'Tai khoan cua ban duoc bao ve bang xac thuc 2 yeu to.'
                      : 'Tang cuong bao mat tai khoan bang xac thuc 2 yeu to.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              {!status?.is2FAEnabled ? (
                <Button onClick={handleStartSetup} disabled={isSettingUp}>
                  {isSettingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                  Thiet lap 2FA
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tat 2FA
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
                  <h3 className="text-lg font-semibold">Xac thuc qua SMS</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status.hasPhoneNumber
                      ? 'So dien thoai da duoc thiet lap de nhan ma OTP.'
                      : 'Them so dien thoai de nhan ma OTP qua SMS khi khong co ung dung xac thuc.'}
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
                          Xac nhan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowSmsSetup(false);
                            setPhoneNumber('');
                          }}
                        >
                          Huy
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
                      {status.hasPhoneNumber ? 'Cap nhat so dien thoai' : 'Thiet lap SMS'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Backup Codes Management (only show when 2FA is enabled) */}
          {status?.is2FAEnabled && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold">Ma backup</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ma backup dung khi ban khong the truy cap ung dung xac thuc hoac dien thoai.
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
                    Dong
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
                  Tao lai ma backup
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
            <h3 className="text-lg font-semibold">Buoc 1: Quet ma QR</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Su dung ung dung xac thuc (Google Authenticator, Authy, ...) de quet ma QR ben duoi.
            </p>

            {/* QR Code */}
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg border bg-white p-4">
                <img
                  src={setupData.qrCodeUrl}
                  alt="Ma QR thiet lap 2FA"
                  className="h-48 w-48"
                />
              </div>
            </div>

            {/* Manual secret */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Hoac nhap ma thu cong:</p>
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
                Tiep tuc
              </Button>
              <Button variant="ghost" onClick={handleFinishSetup}>
                Huy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Verify Code */}
      {setupStep === 'verify' && (
        <div className="max-w-md space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">Buoc 2: Xac minh</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhap ma 6 so tu ung dung xac thuc de hoan tat thiet lap.
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="verify-code" className="text-sm font-medium">
                  Ma xac thuc
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
                  Xac nhan va bat 2FA
                </Button>
                <Button variant="ghost" onClick={() => setSetupStep('qr')}>
                  Quay lai
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
            <h3 className="text-lg font-semibold">Buoc 3: Luu ma backup</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Luu lai cac ma backup nay. Ban se can chung khi khong the su dung ung dung xac thuc.
            </p>

            <div className="mt-4">
              <BackupCodesDisplay codes={backupCodes} />
            </div>

            <div className="mt-6">
              <Button onClick={handleFinishSetup}>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                Hoan tat
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
              Tao lai ma backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cac ma backup cu se khong con su dung duoc. Ban se nhan duoc 10 ma backup moi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>Huy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateBackupCodes}
              disabled={isRegenerating}
            >
              {isRegenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Tao lai
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
