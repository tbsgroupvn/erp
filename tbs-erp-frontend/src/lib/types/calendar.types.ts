export type EventVisibility = 'PUBLIC' | 'TEAM' | 'PRIVATE';
export type ParticipantStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
export type RoomStatus = 'AVAILABLE' | 'MAINTENANCE' | 'DEACTIVATED';

export interface CalendarEventUser {
  id: string;
  email: string;
  fullName: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  user: CalendarEventUser;
  status: ParticipantStatus;
  respondedAt?: string | null;
}

export interface EventReminder {
  id: string;
  eventId: string;
  minutesBefore: number;
  sent: boolean;
}

export interface MeetingRoom {
  id: string;
  name: string;
  location?: string | null;
  capacity: number;
  features: string[];
  status: RoomStatus;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  color: string;
  allDay: boolean;
  startAt: string; // ISO datetime
  endAt: string;   // ISO datetime
  recurrence?: string | null;
  visibility: EventVisibility;
  organizerId: string;
  organizer: CalendarEventUser;
  roomId?: string | null;
  room?: MeetingRoom | null;
  participants: EventParticipant[];
  reminders: EventReminder[];
  createdAt: string;
  updatedAt: string;
}

export interface FreeBusy {
  startAt: string;
  endAt: string;
  allDay: boolean;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  location?: string;
  color?: string;
  allDay?: boolean;
  startAt: string;
  endAt: string;
  recurrence?: string;
  visibility?: EventVisibility;
  roomId?: string;
  participantIds?: string[];
  reminderMinutes?: number[];
}

export interface UpdateEventPayload {
  title?: string;
  description?: string;
  location?: string;
  color?: string;
  allDay?: boolean;
  startAt?: string;
  endAt?: string;
  visibility?: EventVisibility;
  roomId?: string;
}

export interface RoomAvailabilityResult {
  available: boolean;
  conflict: {
    eventId: string;
    title: string;
    startAt: string;
    endAt: string;
  } | null;
}
