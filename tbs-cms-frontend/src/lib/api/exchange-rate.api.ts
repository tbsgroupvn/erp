import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type { ExchangeRate } from '@/lib/types/finance.types';
import type { Currency } from '@/lib/types/enums';

export interface SetExchangeRateDto {
  from: Currency;
  to: Currency;
  rate: number;
  source?: string;
}

export interface ConvertResult {
  from: Currency;
  to: Currency;
  rate: number;
  amount: number;
  result: number;
}

export interface ExchangeRateQueryParams {
  from?: Currency;
  to?: Currency;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const exchangeRateApi = {
  /** POST /exchange-rate — set rate */
  setRate: (data: SetExchangeRateDto) =>
    apiClient
      .post<BaseResponse<ExchangeRate>>('/exchange-rate', data)
      .then((r) => r.data.data),

  /** GET /exchange-rate/current?from=&to= */
  getCurrentRate: (from: Currency, to: Currency) =>
    apiClient
      .get<BaseResponse<ExchangeRate>>('/exchange-rate/current', {
        params: { from, to },
      })
      .then((r) => r.data.data),

  /** GET /exchange-rate/history */
  getHistory: (params?: ExchangeRateQueryParams) =>
    apiClient
      .get<BaseResponse<ExchangeRate[]>>('/exchange-rate/history', { params })
      .then((r) => r.data.data),

  /** POST /exchange-rate/convert */
  convert: (from: Currency, to: Currency, amount: number) =>
    apiClient
      .post<BaseResponse<ConvertResult>>('/exchange-rate/convert', {
        from,
        to,
        amount,
      })
      .then((r) => r.data.data),

  /** POST /exchange-rate/sync-vcb — sync from Vietcombank */
  syncVietcombank: () =>
    apiClient
      .post<BaseResponse<ExchangeRate[]>>('/exchange-rate/sync-vcb')
      .then((r) => r.data.data),

  /** GET /exchange-rate/active */
  getActive: () =>
    apiClient
      .get<BaseResponse<ExchangeRate[]>>('/exchange-rate/active')
      .then((r) => r.data.data),
};
