import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse, QueryParams } from '@/lib/types';

export interface RecordCODCollectionDto {
  deliveryId: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  photoUrl?: string;
}

export interface CODRecord {
  id: string;
  deliveryId: string;
  driverId: string;
  amount: number;
  paymentMethod: string | null;
  notes: string | null;
  photoUrl: string | null;
  status: string;
  collectedAt: string;
  remittedAt: string | null;
  createdAt: string;
}

export interface CODQueryParams extends QueryParams {
  driverId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const codApi = {
  /** POST /cod/collect */
  recordCollection: (data: RecordCODCollectionDto) =>
    apiClient
      .post<BaseResponse<CODRecord>>('/cod/collect', data)
      .then((r) => r.data.data),

  /** GET /cod/driver/:driverId?date=... */
  getDriverCollections: (driverId: string, date: string) =>
    apiClient
      .get<BaseResponse<CODRecord[]>>(`/cod/driver/${driverId}`, { params: { date } })
      .then((r) => r.data.data),

  /** POST /cod/remittance */
  confirmRemittance: (driverId: string, date: string, amount: number) =>
    apiClient
      .post<BaseResponse<unknown>>('/cod/remittance', { driverId, date, amount })
      .then((r) => r.data.data),

  /** GET /cod */
  list: (params?: CODQueryParams) =>
    apiClient
      .get<PaginatedResponse<CODRecord>>('/cod', { params })
      .then((r) => r.data),

  /** GET /cod/reconciliation */
  getReconciliation: (startDate: string, endDate: string) =>
    apiClient
      .get<BaseResponse<unknown>>('/cod/reconciliation', { params: { startDate, endDate } })
      .then((r) => r.data.data),

  /** POST /cod/:id/shortage */
  flagShortage: (id: string, shortageAmount: number, reason: string) =>
    apiClient
      .post<BaseResponse<unknown>>(`/cod/${id}/shortage`, { shortageAmount, reason })
      .then((r) => r.data.data),
};
