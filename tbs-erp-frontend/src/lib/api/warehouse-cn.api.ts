import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Package,
  ReceivePackageDto,
  MeasurePackageDto,
  WarehouseCNStatus,
  QueryParams,
} from '@/lib/types';

export interface CnPackageQueryParams extends QueryParams {
  status?: WarehouseCNStatus;
  orderId?: string;
  containerId?: string;
}

export const warehouseCnApi = {
  /** POST /warehouse/cn/receive */
  receive: (data: ReceivePackageDto) =>
    apiClient
      .post<BaseResponse<Package>>('/warehouse/cn/receive', data)
      .then((r) => r.data.data),

  /** PATCH /warehouse/cn/packages/:id/measure */
  measure: (packageId: string, data: MeasurePackageDto) =>
    apiClient
      .patch<BaseResponse<Package>>(
        `/warehouse/cn/packages/${packageId}/measure`,
        data,
      )
      .then((r) => r.data.data),

  /** PATCH /warehouse/cn/packages/:id/status */
  updateStatus: (packageId: string, status: WarehouseCNStatus) =>
    apiClient
      .patch<BaseResponse<Package>>(
        `/warehouse/cn/packages/${packageId}/status`,
        { status },
      )
      .then((r) => r.data.data),

  /** GET /warehouse/cn/packages */
  listPackages: (params?: CnPackageQueryParams) =>
    apiClient
      .get<PaginatedResponse<Package>>('/warehouse/cn/packages', { params })
      .then((r) => r.data),

  /** GET /warehouse/cn/packages/:id */
  getPackage: (id: string) =>
    apiClient
      .get<BaseResponse<Package>>(`/warehouse/cn/packages/${id}`)
      .then((r) => r.data.data),
};
