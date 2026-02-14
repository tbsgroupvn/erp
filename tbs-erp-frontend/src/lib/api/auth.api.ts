import { apiClient } from './client';
import type {
  BaseResponse,
  LoginDto,
  TokenResponse,
  UserProfile,
} from '@/lib/types';

export const authApi = {
  /** POST /auth/login */
  login: (data: LoginDto) =>
    apiClient
      .post<BaseResponse<{ user: UserProfile; tokens: TokenResponse }>>('/auth/login', data)
      .then((r) => r.data.data),

  /** POST /auth/refresh - Refresh token is read from HttpOnly cookie */
  refreshToken: () =>
    apiClient
      .post<BaseResponse<TokenResponse>>('/auth/refresh', {}) // Empty body - token in cookie
      .then((r) => r.data.data),

  /** POST /auth/logout */
  logout: () => apiClient.post('/auth/logout'),

  /** GET /auth/profile */
  getProfile: () =>
    apiClient
      .get<BaseResponse<UserProfile>>('/auth/profile')
      .then((r) => r.data.data),

  /** PATCH /auth/change-password */
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient
      .patch<BaseResponse<null>>('/auth/change-password', data)
      .then((r) => r.data),
};
