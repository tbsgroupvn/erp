// ============================================
// CHAT TYPES
// ============================================

export type ConversationType = 'DIRECT' | 'GROUP';
export type MessageStatus = 'SENT' | 'EDITED' | 'DELETED';

export interface ChatUser {
  id: string;
  fullName: string;
  role: string;
}

export interface ChatParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  lastReadAt: string | null;
  joinedAt: string;
  leftAt: string | null;
  isMuted: boolean;
}

export interface ChatMessageReply {
  id: string;
  content: string;
  senderId: string;
  status: MessageStatus;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: ChatUser | null;
  content: string;
  status: MessageStatus;
  replyToId: string | null;
  replyTo: ChatMessageReply | null;
  reactions?: ChatReaction[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  displayName: string | null;      // computed: group name or DM target fullName
  dmTargetUser: ChatUser | null;   // DM only
  createdBy: string;
  referenceType: string | null;
  referenceId: string | null;
  pinnedMessageId?: string | null;
  participants: ChatParticipant[];
  messages: ChatMessage[];         // last 1 message for preview
  createdAt: string;
  updatedAt: string;
  // enriched
  unreadCount?: number;
}

export interface MessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

// DTOs
export interface CreateDMDto {
  targetUserId: string;
}

export interface CreateGroupDto {
  name: string;
  participantIds: string[];
  referenceType?: string;
  referenceId?: string;
}

export interface SendMessageDto {
  content: string;
  replyToId?: string;
}

export interface EditMessageDto {
  content: string;
}

// WS Events
export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}
