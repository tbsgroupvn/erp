// ============================================
// AUTH TYPES — Login, Token, User Profile
// ============================================

import { Branch, UserRole } from './enums';

/** Login request body */
export interface LoginDto {
  email: string;
  password: string;
}

/** Token pair returned after successful auth */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Authenticated user profile */
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branch: Branch | null;
  leaderId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}
