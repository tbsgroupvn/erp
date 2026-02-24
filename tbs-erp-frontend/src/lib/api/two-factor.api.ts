import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// 2FA Response Types
// ---------------------------------------------------------------------------
export interface TwoFactorSetupResponse {
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

export interface TwoFactorStatusResponse {
  is2FAEnabled: boolean;
  preferredMethod: string | null;
  hasPhoneNumber: boolean;
}

export interface TwoFactorVerifyResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    branch: string | null;
    leaderId: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
  };
}

export interface BackupCodesResponse {
  backupCodes: string[];
}

// ---------------------------------------------------------------------------
// 2FA API
// ---------------------------------------------------------------------------
export const twoFactorApi = {
  /** POST /auth/2fa/setup - Start 2FA setup, returns QR code and secret */
  setup2FA: () =>
    apiClient
      .post<BaseResponse<TwoFactorSetupResponse>>('/auth/2fa/setup')
      .then((r) => r.data.data),

  /** POST /auth/2fa/enable - Enable 2FA with verification code */
  enable2FA: (code: string) =>
    apiClient
      .post<BaseResponse<{ backupCodes: string[] }>>('/auth/2fa/enable', { code })
      .then((r) => r.data.data),

  /** POST /auth/2fa/disable - Disable 2FA (requires code + password) */
  disable2FA: (code: string, password: string) =>
    apiClient
      .post<BaseResponse<null>>('/auth/2fa/disable', { code, password })
      .then((r) => r.data),

  /** POST /auth/2fa/verify - Verify 2FA during login */
  verify2FA: (userId: string, code: string, tempToken: string, method?: string) =>
    apiClient
      .post<BaseResponse<TwoFactorVerifyResponse>>(
        '/auth/2fa/verify',
        { userId, code, method },
        { headers: { 'x-2fa-token': tempToken } },
      )
      .then((r) => r.data.data),

  /** POST /auth/2fa/sms/setup - Setup SMS-based 2FA */
  setupSms: (phoneNumber: string) =>
    apiClient
      .post<BaseResponse<null>>('/auth/2fa/sms/setup', { phoneNumber })
      .then((r) => r.data),

  /** POST /auth/2fa/sms/send - Send SMS OTP code */
  sendSmsOtp: (userId: string) =>
    apiClient
      .post<BaseResponse<null>>('/auth/2fa/sms/send', { userId })
      .then((r) => r.data),

  /** GET /auth/2fa/status - Get current 2FA status */
  getStatus: () =>
    apiClient
      .get<BaseResponse<TwoFactorStatusResponse>>('/auth/2fa/status')
      .then((r) => r.data.data),

  /** POST /auth/2fa/backup-codes - Regenerate backup codes */
  regenerateBackupCodes: () =>
    apiClient
      .post<BaseResponse<BackupCodesResponse>>('/auth/2fa/backup-codes')
      .then((r) => r.data.data),
};
