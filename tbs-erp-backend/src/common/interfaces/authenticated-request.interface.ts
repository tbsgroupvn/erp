import { Request } from 'express';
import { UserRole, Branch } from '@prisma/client';

/**
 * JWT payload attached to request after authentication
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  sessionId: string;
  type: 'access' | 'refresh';
  iat?: number; // Issued at
  exp?: number; // Expiration
}

/**
 * User object attached to request after authentication
 * Contains full user profile information
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branch: Branch | null;
  sessionId: string;
  isActive: boolean;
}

/**
 * Express Request with authenticated user attached
 * Use this instead of `Request` with `req.user as any`
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return req.user !== undefined && typeof (req.user as any).id === 'string';
}
