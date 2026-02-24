import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Package,
  Delivery,
  DispatchDto,
  Branch,
  WarehouseVNStatus,
  QueryParams,
} from '@/lib/types';

export interface VnPackageQueryParams extends QueryParams {
  status?: WarehouseVNStatus;
  orderId?: string;
  containerId?: string;
}

/** Re-throw with error logged so internal details don't leak to UI */
function handleApiError(error: unknown): never {
  console.error('Warehouse VN API error:', (error as Error)?.message || error);
  throw error;
}

export const warehouseVnApi = {
  /** POST /warehouse-vn/receive -- receive packages from a container */
  receiveFromContainer: (data: {
    containerId: string;
    packageIds: string[];
    notes?: string;
  }): Promise<Package[]> =>
    apiClient
      .post<BaseResponse<Package[]>>('/warehouse-vn/receive', data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /warehouse-vn/packages */
  listPackages: (params?: VnPackageQueryParams): Promise<PaginatedResponse<Package>> =>
    apiClient
      .get<PaginatedResponse<Package>>('/warehouse-vn/packages', { params })
      .then((r) => r.data)
      .catch(handleApiError),

  /** POST /warehouse-vn/packages/sort */
  sortPackages: (ids: string[], status: WarehouseVNStatus): Promise<Package[]> =>
    apiClient
      .post<BaseResponse<Package[]>>('/warehouse-vn/packages/sort', {
        ids,
        status,
      })
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** POST /warehouse-vn/dispatch */
  dispatch: (data: DispatchDto): Promise<Delivery> =>
    apiClient
      .post<BaseResponse<Delivery>>('/warehouse-vn/dispatch', data)
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** PATCH /warehouse-vn/deliveries/:id/confirm */
  confirmDelivery: (
    deliveryId: string,
    data: {
      receivedBy: string;
      signature?: string;
      notes?: string;
      photos?: string[];
    },
  ): Promise<Delivery> =>
    apiClient
      .patch<BaseResponse<Delivery>>(
        `/warehouse-vn/deliveries/${encodeURIComponent(deliveryId)}/confirm`,
        data,
      )
      .then((r) => r.data.data)
      .catch(handleApiError),

  /** GET /warehouse-vn/delivery-plan?branch=:branch */
  getDeliveryPlan: (branch: Branch): Promise<{
    branch: Branch;
    packages: Package[];
    totalPackages: number;
    totalWeight: number;
  }> =>
    apiClient
      .get<
        BaseResponse<{
          branch: Branch;
          packages: Package[];
          totalPackages: number;
          totalWeight: number;
        }>
      >('/warehouse-vn/delivery-plan', { params: { branch } })
      .then((r) => r.data.data)
      .catch(handleApiError),
};
