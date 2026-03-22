'use client';

import { AlertCircle } from 'lucide-react';
import type { FieldErrors } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface FormErrorSummaryProps {
  errors: FieldErrors;
  className?: string;
}

/**
 * Displays a compact error count banner for react-hook-form errors.
 * Recursively counts all nested errors including field arrays.
 */
export function FormErrorSummary({ errors, className }: FormErrorSummaryProps) {
  const errorCount = countErrors(errors);
  if (errorCount === 0) return null;

  const flatErrors = flattenErrors(errors);
  const displayErrors = flatErrors.slice(0, 5);

  return (
    <div
      className={cn(
        'rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">
            {`C\u00f3 ${errorCount} l\u1ed7i c\u1ea7n s\u1eeda`}
          </p>
          {displayErrors.length > 0 && (
            <ul className="list-disc list-inside text-xs space-y-0.5 text-destructive/80">
              {displayErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
              {flatErrors.length > 5 && (
                <li>{`...v\u00e0 ${flatErrors.length - 5} l\u1ed7i kh\u00e1c`}</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function countErrors(errors: FieldErrors): number {
  let count = 0;
  for (const key of Object.keys(errors)) {
    const value = errors[key];
    if (!value) continue;
    // Leaf error node has a `message` property
    if (typeof value.message === 'string') {
      count += 1;
    } else if (Array.isArray(value)) {
      // Field array — recurse into each element
      for (const item of value) {
        if (item && typeof item === 'object') {
          count += countErrors(item as FieldErrors);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      // Nested object errors (e.g. nested field groups)
      count += countErrors(value as FieldErrors);
    }
  }
  return count;
}

function flattenErrors(errors: FieldErrors, prefix = ''): string[] {
  const messages: string[] = [];
  for (const key of Object.keys(errors)) {
    const value = errors[key];
    if (!value) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value.message === 'string' && value.message) {
      messages.push(value.message);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item && typeof item === 'object') {
          messages.push(...flattenErrors(item as FieldErrors, `${path}[${i}]`));
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      messages.push(...flattenErrors(value as FieldErrors, path));
    }
  }
  return messages;
}
