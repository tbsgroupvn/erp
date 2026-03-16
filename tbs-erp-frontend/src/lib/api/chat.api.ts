import { apiClient } from './client';
import type {
  Conversation,
  MessagePage,
  ChatMessage,
  ChatUser,
  CreateDMDto,
  CreateGroupDto,
  SendMessageDto,
  EditMessageDto,
} from '@/lib/types';

export const chatApi = {
  /** GET /chat/conversations */
  listConversations: (search?: string): Promise<Conversation[]> =>
    apiClient
      .get('/chat/conversations', { params: search ? { search } : undefined })
      .then((r) => r.data.data),

  /** POST /chat/conversations/dm */
  createDM: (dto: CreateDMDto): Promise<Conversation> =>
    apiClient.post('/chat/conversations/dm', dto).then((r) => r.data.data),

  /** POST /chat/conversations/group */
  createGroup: (dto: CreateGroupDto): Promise<Conversation> =>
    apiClient.post('/chat/conversations/group', dto).then((r) => r.data.data),

  /** PATCH /chat/conversations/:id */
  updateConversation: (id: string, name: string): Promise<Conversation> =>
    apiClient.patch(`/chat/conversations/${id}`, { name }).then((r) => r.data.data),

  /** GET /chat/conversations/:id/messages */
  getMessages: (id: string, cursor?: string, limit = 30): Promise<MessagePage> =>
    apiClient
      .get(`/chat/conversations/${id}/messages`, { params: { cursor, limit } })
      .then((r) => r.data.data),

  /** POST /chat/conversations/:id/messages */
  sendMessage: (id: string, dto: SendMessageDto): Promise<ChatMessage> =>
    apiClient.post(`/chat/conversations/${id}/messages`, dto).then((r) => r.data.data),

  /** POST /chat/conversations/:id/read */
  markAsRead: (id: string): Promise<void> =>
    apiClient.post(`/chat/conversations/${id}/read`).then(() => undefined),

  /** PATCH /chat/messages/:id */
  editMessage: (id: string, dto: EditMessageDto): Promise<ChatMessage> =>
    apiClient.patch(`/chat/messages/${id}`, dto).then((r) => r.data.data),

  /** DELETE /chat/messages/:id */
  deleteMessage: (id: string): Promise<ChatMessage> =>
    apiClient.delete(`/chat/messages/${id}`).then((r) => r.data.data),

  /** POST /chat/conversations/:id/participants */
  addParticipants: (id: string, userIds: string[]): Promise<Conversation> =>
    apiClient.post(`/chat/conversations/${id}/participants`, { userIds }).then((r) => r.data.data),

  /** DELETE /chat/conversations/:id/participants/:userId */
  removeParticipant: (id: string, userId: string): Promise<void> =>
    apiClient.delete(`/chat/conversations/${id}/participants/${userId}`).then(() => undefined),

  /** POST /chat/conversations/:id/leave */
  leaveConversation: (id: string): Promise<void> =>
    apiClient.post(`/chat/conversations/${id}/leave`).then(() => undefined),

  /** GET /chat/users/search */
  searchUsers: (q: string, limit = 10): Promise<ChatUser[]> =>
    apiClient.get('/chat/users/search', { params: { q, limit } }).then((r) => r.data.data),

  /** GET /chat/users/online */
  getOnlineUsers: (): Promise<string[]> =>
    apiClient.get('/chat/users/online').then((r) => r.data.data),

  /** GET /chat/unread-count */
  getTotalUnread: (): Promise<{ total: number }> =>
    apiClient.get('/chat/unread-count').then((r) => r.data.data),

  /** POST /chat/messages/:id/react */
  reactToMessage: (messageId: string, emoji: string): Promise<any> =>
    apiClient.post(`/chat/messages/${messageId}/react`, { emoji }).then((r) => r.data.data),

  /** PATCH /chat/conversations/:id/pin */
  pinMessage: (conversationId: string, messageId: string | null): Promise<any> =>
    apiClient
      .patch(`/chat/conversations/${conversationId}/pin`, { messageId })
      .then((r) => r.data.data),
};
