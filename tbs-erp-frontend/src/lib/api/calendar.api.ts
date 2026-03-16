import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  CalendarEvent,
  MeetingRoom,
  FreeBusy,
  CreateEventPayload,
  UpdateEventPayload,
  RoomAvailabilityResult,
  EventParticipant,
} from '@/lib/types/calendar.types';

export const calendarApi = {
  /** GET /calendar/events */
  getEvents: (params?: { from?: string; to?: string }) =>
    apiClient
      .get<BaseResponse<CalendarEvent[]>>('/calendar/events', { params })
      .then((r) => r.data.data),

  /** POST /calendar/events */
  createEvent: (data: CreateEventPayload) =>
    apiClient
      .post<BaseResponse<CalendarEvent>>('/calendar/events', data)
      .then((r) => r.data.data),

  /** GET /calendar/events/:id */
  getEventById: (id: string) =>
    apiClient
      .get<BaseResponse<CalendarEvent>>(`/calendar/events/${id}`)
      .then((r) => r.data.data),

  /** PATCH /calendar/events/:id */
  updateEvent: (id: string, data: UpdateEventPayload) =>
    apiClient
      .patch<BaseResponse<CalendarEvent>>(`/calendar/events/${id}`, data)
      .then((r) => r.data.data),

  /** DELETE /calendar/events/:id */
  deleteEvent: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean; id: string }>>(`/calendar/events/${id}`)
      .then((r) => r.data.data),

  /** POST /calendar/events/:id/respond */
  respondToEvent: (id: string, status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') =>
    apiClient
      .post<BaseResponse<EventParticipant>>(`/calendar/events/${id}/respond`, { status })
      .then((r) => r.data.data),

  /** GET /calendar/free-busy */
  getFreeBusy: (userId: string, from: string, to: string) =>
    apiClient
      .get<BaseResponse<FreeBusy[]>>('/calendar/free-busy', { params: { userId, from, to } })
      .then((r) => r.data.data),

  /** GET /calendar/rooms */
  getRooms: () =>
    apiClient
      .get<BaseResponse<MeetingRoom[]>>('/calendar/rooms')
      .then((r) => r.data.data),

  /** POST /calendar/rooms */
  createRoom: (data: { name: string; location?: string; capacity: number; features?: string[] }) =>
    apiClient
      .post<BaseResponse<MeetingRoom>>('/calendar/rooms', data)
      .then((r) => r.data.data),

  /** GET /calendar/rooms/:id/availability */
  checkRoomAvailability: (roomId: string, startAt: string, endAt: string) =>
    apiClient
      .get<BaseResponse<RoomAvailabilityResult>>(`/calendar/rooms/${roomId}/availability`, {
        params: { startAt, endAt },
      })
      .then((r) => r.data.data),
};
