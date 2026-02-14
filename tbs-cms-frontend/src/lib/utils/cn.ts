import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names using clsx and tailwind-merge.
 * Handles conditional classes and resolves Tailwind conflicts.
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
