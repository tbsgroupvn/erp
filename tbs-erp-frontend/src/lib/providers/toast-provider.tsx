'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'rounded-xl shadow-lg border font-sans text-sm',
          title: 'font-semibold',
          description: 'text-xs opacity-80',
          success: 'border-green-200 dark:border-green-900/50',
          error: 'border-red-200 dark:border-red-900/50',
          warning: 'border-amber-200 dark:border-amber-900/50',
          info: 'border-blue-200 dark:border-blue-900/50',
        },
      }}
    />
  );
}
