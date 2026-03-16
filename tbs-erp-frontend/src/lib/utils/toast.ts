/**
 * Toast helper — thin wrapper around sonner with Vietnamese defaults.
 *
 * @example
 * import { toast } from '@/lib/utils/toast';
 * toast.success('Luu thanh cong');
 * toast.error('Co loi xay ra', 'Vui long thu lai sau.');
 * toast.loading('Dang xu ly...');
 * toast.promise(apiCall(), { loading: 'Dang luu...', success: 'Da luu!', error: 'Loi khi luu.' });
 */

import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),

  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),

  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),

  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description }),

  loading: (message: string) =>
    sonnerToast.loading(message),

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) => sonnerToast.promise(promise, messages),

  dismiss: (id?: string | number) =>
    sonnerToast.dismiss(id),
} as const;
