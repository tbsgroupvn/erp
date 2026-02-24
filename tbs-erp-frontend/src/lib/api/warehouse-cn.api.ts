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

/** Re-throw with a generic message so internal details don't leak to UI */
function handleApiError(error: unknown): never {
  console.error('Warehouse CN API error:', (error as Error)?.message || error);
  throw error;
}

export const warehouseCnApi = {
  /** POST /warehouse-cn/receive */
  receive: (data: ReceivePackageDto): Promise<Package> =>
    apiClient
      .post<BaseResponse<Package>>('/warehouse-cn/receive', data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** POST /warehouse-cn/packages/:id/measure */
  measure: (packageId: string, data: MeasurePackageDto): Promise<Package> =>
    apiClient
      .post<BaseResponse<Package>>(
        `/warehouse-cn/packages/${encodeURIComponent(packageId)}/measure`,
        data,
      )
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /warehouse-cn/packages/:id/status */
  updateStatus: (packageId: string, status: WarehouseCNStatus): Promise<Package> =>
    apiClient
      .patch<BaseResponse<Package>>(
        `/warehouse-cn/packages/${encodeURIComponent(packageId)}/status`,
        { status },
      )
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /warehouse-cn/packages */
  listPackages: (params?: CnPackageQueryParams): Promise<PaginatedResponse<Package>> =>
    apiClient
      .get<PaginatedResponse<Package>>('/warehouse-cn/packages', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  /** GET /warehouse-cn/packages/:id */
  getPackage: (id: string): Promise<Package> =>
    apiClient
      .get<BaseResponse<Package>>(`/warehouse-cn/packages/${encodeURIComponent(id)}`)
      .then((r) => r.data.data)
      .catch(handleApiError),
};
