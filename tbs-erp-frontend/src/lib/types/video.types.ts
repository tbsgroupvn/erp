export type VideoRoomStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED';

export interface VideoParticipantInfo {
  userId: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface VideoRoom {
  id: string;
  title: string;
  roomName: string;
  hostId: string;
  status: VideoRoomStatus;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  conversationId?: string;
  calendarEventId?: string;
  joinUrl: string;
  participants: VideoParticipantInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomToken {
  roomName: string;
  domain: string;
  token?: string;
  joinUrl: string;
  displayName: string;
}

export interface CreateRoomPayload {
  title: string;
  scheduledAt?: string;
  maxParticipants?: number;
  participantIds?: string[];
  conversationId?: string;
  calendarEventId?: string;
}
