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

export const warehouseVnApi = {
  /** POST /warehouse/vn/receive — receive packages from a container */
  receiveFromContainer: (data: {
    containerId: string;
    packageIds: string[];
    notes?: string;
  }) =>
    apiClient
      .post<BaseResponse<Package[]>>('/warehouse/vn/receive', data)
      .then((r) => r.data.data),

  /** GET /warehouse/vn/packages */
  listPackages: (params?: VnPackageQueryParams) =>
    apiClient
      .get<PaginatedResponse<Package>>('/warehouse/vn/packages', { params })
      .then((r) => r.data),

  /** POST /warehouse/vn/packages/sort */
  sortPackages: (ids: string[], status: WarehouseVNStatus) =>
    apiClient
      .post<BaseResponse<Package[]>>('/warehouse/vn/packages/sort', {
        ids,
        status,
      })
      .then((r) => r.data.data),

  /** POST /warehouse/vn/dispatch */
  dispatch: (data: DispatchDto) =>
    apiClient
      .post<BaseResponse<Delivery>>('/warehouse/vn/dispatch', data)
      .then((r) => r.data.data),

  /** PATCH /warehouse/vn/deliveries/:id/confirm */
  confirmDelivery: (
    deliveryId: string,
    data: {
      receivedBy: string;
      signature?: string;
      notes?: string;
      photos?: string[];
    },
  ) =>
    apiClient
      .patch<BaseResponse<Delivery>>(
        `/warehouse/vn/deliveries/${deliveryId}/confirm`,
        data,
      )
      .then((r) => r.data.data),

  /** GET /warehouse/vn/delivery-plan?branch=:branch */
  getDeliveryPlan: (branch: Branch) =>
    apiClient
      .get<
        BaseResponse<{
          branch: Branch;
          packages: Package[];
          totalPackages: number;
          totalWeight: number;
        }>
      >('/warehouse/vn/delivery-plan', { params: { branch } })
      .then((r) => r.data.data),
};
