import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Package,
  Container,
  ContainerQueryParams,
} from '@/lib/types';
import type { QueryParams } from '@/lib/types';

/** Log and re-throw API errors */
function handleApiError(error: unknown): never {
  console.error('Warehouse API error:', (error as Error)?.message || error);
  throw error;
}

export const warehouseApi = {
  // Packages (CN warehouse)
  listPackagesCN(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Package>>('/warehouse-cn/packages', { params })
      .catch(handleApiError);
  },
  // Packages (VN warehouse)
  listPackagesVN(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Package>>('/warehouse-vn/packages', { params })
      .catch(handleApiError);
  },
  // Containers
  listContainers(params?: ContainerQueryParams) {
    return apiClient.get<PaginatedResponse<Container>>('/containers', { params })
      .catch(handleApiError);
  },
  getContainer(id: string) {
    return apiClient.get<BaseResponse<Container>>(`/containers/${encodeURIComponent(id)}`)
      .catch(handleApiError);
  },
};
