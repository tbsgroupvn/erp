export interface AISession {
  id: string;
  userId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages?: AIMessage[];
}

export interface AIMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  createdAt: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  tokensUsed: number;
}

export interface StreamChunk {
  type: 'session' | 'text' | 'done';
  sessionId?: string;
  text?: string;
  tokensUsed?: number;
}

export interface ChatDto {
  sessionId?: string;
  message: string;
}
