import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
}

export interface SendToRecipientPayload {
  to: string;
}

export const emailApi = {
  /** POST /emails/send — gửi email tùy chỉnh */
  send: (payload: SendEmailPayload) =>
    apiClient
      .post<BaseResponse<null>>('/emails/send', payload)
      .then((r) => r.data),

  /** POST /emails/quotation/:id — gửi email báo giá */
  sendQuotation: (quotationId: string, payload: SendToRecipientPayload) =>
    apiClient
      .post<BaseResponse<null>>(`/emails/quotation/${quotationId}`, payload)
      .then((r) => r.data),

  /** POST /emails/invoice/:id — gửi email hóa đơn */
  sendInvoice: (invoiceId: string, payload: SendToRecipientPayload) =>
    apiClient
      .post<BaseResponse<null>>(`/emails/invoice/${invoiceId}`, payload)
      .then((r) => r.data),
};
