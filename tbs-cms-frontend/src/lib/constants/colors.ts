/**
 * Color constants for consistent UI styling across the application
 */

export const BADGE_COLORS = {
  // Status badges
  NEW: 'bg-blue-100 text-blue-700',
  READ: 'bg-yellow-100 text-yellow-700',
  REPLIED: 'bg-green-100 text-green-700',
  RESOLVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-blue-100 text-blue-700',

  // Publication status
  PUBLISHED: 'bg-green-100 text-green-700',
  DRAFT: 'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-gray-100 text-gray-700',

  // Active status
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
} as const;

export const CARD_COLORS = {
  // Stats card variants
  DEFAULT: 'border-slate-200',
  PRIMARY: 'border-blue-200 bg-blue-50',
  SUCCESS: 'border-green-200 bg-green-50',
  WARNING: 'border-yellow-200 bg-yellow-50',
  PURPLE: 'border-purple-200 bg-purple-50',
  INFO: 'bg-purple-50 border-purple-200',
} as const;

export const ICON_COLORS = {
  // Icon color variants
  DEFAULT: 'text-slate-400',
  PRIMARY: 'text-blue-400',
  SUCCESS: 'text-green-400',
  WARNING: 'text-yellow-400',
  PURPLE: 'text-purple-400',
  DANGER: 'text-red-600',
} as const;

export const TEXT_COLORS = {
  // Text color variants
  HEADING: 'text-slate-900',
  BODY: 'text-slate-600',
  MUTED: 'text-slate-500',
  PRIMARY: 'text-blue-600',
  SUCCESS: 'text-green-600',
  WARNING: 'text-yellow-600',
  PURPLE: 'text-purple-600',
  DANGER: 'text-red-600',
} as const;

export const BG_COLORS = {
  // Background color variants
  HOVER: 'hover:bg-slate-50',
  DANGER_HOVER: 'hover:bg-red-50',
  PRIMARY_HOVER: 'hover:bg-blue-50',
} as const;
