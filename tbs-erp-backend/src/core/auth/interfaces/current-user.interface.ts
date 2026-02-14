import { UserRole, Branch } from '@prisma/client';

/**
 * Represents the authenticated user extracted from the JWT token.
 * This interface is used throughout the application to type the
 * user object attached to requests by the JWT strategy.
 */
export interface ICurrentUser {
  /** Unique user identifier (cuid) */
  id: string;

  /** User's email address */
  email: string;

  /** User's role in the system */
  role: UserRole;

  /** User's assigned branch (HN or HCM) */
  branch: Branch | null;

  /** Leader's user ID for sales hierarchy (Sale -> Leader -> Director) */
  leaderId: string | null;
}
