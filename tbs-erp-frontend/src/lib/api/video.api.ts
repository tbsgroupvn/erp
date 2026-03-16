import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type { VideoRoom, RoomToken, CreateRoomPayload } from '@/lib/types/video.types';

export const videoApi = {
  /**
   * GET /video/rooms
   * Danh sách phòng họp đang active/scheduled của user hiện tại
   */
  getMyRooms: () =>
    apiClient
      .get<BaseResponse<VideoRoom[]>>('/video/rooms')
      .then((r) => r.data.data),

  /**
   * POST /video/rooms
   * Tạo phòng họp mới
   */
  createRoom: (payload: CreateRoomPayload) =>
    apiClient
      .post<BaseResponse<VideoRoom>>('/video/rooms', payload)
      .then((r) => r.data.data),

  /**
   * GET /video/rooms/:id
   * Chi tiết phòng họp
   */
  getRoom: (id: string) =>
    apiClient
      .get<BaseResponse<VideoRoom>>(`/video/rooms/${id}`)
      .then((r) => r.data.data),

  /**
   * GET /video/rooms/:id/token
   * Lấy token tham gia phòng họp
   */
  getRoomToken: (id: string) =>
    apiClient
      .get<BaseResponse<RoomToken>>(`/video/rooms/${id}/token`)
      .then((r) => r.data.data),

  /**
   * POST /video/rooms/:id/end
   * Kết thúc phòng họp (chỉ host)
   */
  endRoom: (id: string) =>
    apiClient
      .post<BaseResponse<VideoRoom>>(`/video/rooms/${id}/end`)
      .then((r) => r.data.data),

  /**
   * POST /video/start-dm/:conversationId
   * Bắt đầu video call từ conversation
   */
  startDMCall: (conversationId: string) =>
    apiClient
      .post<BaseResponse<VideoRoom>>(`/video/start-dm/${conversationId}`)
      .then((r) => r.data.data),
};
