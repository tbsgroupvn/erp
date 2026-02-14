import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Package,
  Container,
  ContainerQueryParams,
} from '@/lib/types';
import type { QueryParams } from '@/lib/types';

export const warehouseApi = {
  // Packages (CN warehouse)
  listPackagesCN(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Package>>('/warehouse/cn/packages', { params });
  },
  // Packages (VN warehouse)
  listPackagesVN(params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Package>>('/warehouse/vn/packages', { params });
  },
  // Containers
  listContainers(params?: ContainerQueryParams) {
    return apiClient.get<PaginatedResponse<Container>>('/containers', { params });
  },
  getContainer(id: string) {
    return apiClient.get<BaseResponse<Container>>(`/containers/${id}`);
  },
};
