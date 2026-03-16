import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  OrderProjectView,
  OrderAssignment,
  OrderHandoff,
  MyAssignment,
  ReassignOrderDto,
} from '@/lib/types/order-project.types';

export const orderProjectApi = {
  /** GET /order-project/:id/overview */
  getOrderProjectView: (orderId: string) =>
    apiClient
      .get<BaseResponse<OrderProjectView>>(`/order-project/${orderId}/overview`)
      .then((r) => r.data.data),

  /** GET /order-project/:id/assignments */
  getOrderAssignments: (orderId: string) =>
    apiClient
      .get<BaseResponse<OrderAssignment[]>>(`/order-project/${orderId}/assignments`)
      .then((r) => r.data.data),

  /** GET /order-project/:id/handoffs */
  getOrderHandoffs: (orderId: string) =>
    apiClient
      .get<BaseResponse<OrderHandoff[]>>(`/order-project/${orderId}/handoffs`)
      .then((r) => r.data.data),

  /** GET /order-project/my-assignments */
  getMyAssignments: () =>
    apiClient
      .get<BaseResponse<MyAssignment[]>>('/order-project/my-assignments')
      .then((r) => r.data.data),

  /** GET /order-project/department-board */
  getDepartmentBoard: () =>
    apiClient
      .get<BaseResponse<MyAssignment[]>>('/order-project/department-board')
      .then((r) => r.data.data),

  /** PATCH /order-project/:id/assignments/:assignmentId/reassign */
  reassignOrder: (orderId: string, assignmentId: string, data: ReassignOrderDto) =>
    apiClient
      .patch<BaseResponse<OrderAssignment>>(
        `/order-project/${orderId}/assignments/${assignmentId}/reassign`,
        data,
      )
      .then((r) => r.data.data),
};
