export type PostCategory = 'NEWS' | 'PROCESS' | 'EVENT' | 'AWARD' | 'GENERAL';
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ReactionType = 'LIKE' | 'CLAP' | 'CELEBRATE' | 'HEART' | 'INSIGHTFUL';

export interface CompanyPost {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  category: PostCategory;
  status: PostStatus;
  isPinned: boolean;
  coverImage?: string;
  authorId: string;
  viewCount: number;
  publishedAt?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  _count: { reactions: number; comments: number };
  reactions: { type: ReactionType; userId: string }[];
  comments?: PostComment[];
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string;
  replies?: PostComment[];
  createdAt: string;
  updatedAt: string;
}

export interface PostsResponse {
  items: CompanyPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreatePostPayload {
  title: string;
  content: string;
  excerpt?: string;
  category?: PostCategory;
  isPinned?: boolean;
  coverImage?: string;
  scheduledAt?: string;
  publishNow?: boolean;
}

export interface UpdatePostPayload {
  title?: string;
  content?: string;
  excerpt?: string;
  category?: PostCategory;
  isPinned?: boolean;
  coverImage?: string;
  status?: PostStatus;
}

export interface CreateCommentPayload {
  content: string;
  parentId?: string;
}

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  NEWS: 'Tin tức',
  PROCESS: 'Quy trình',
  EVENT: 'Sự kiện',
  AWARD: 'Khen thưởng',
  GENERAL: 'Chung',
};

export const POST_CATEGORY_COLORS: Record<PostCategory, string> = {
  NEWS: 'bg-blue-100 text-blue-700',
  PROCESS: 'bg-purple-100 text-purple-700',
  EVENT: 'bg-green-100 text-green-700',
  AWARD: 'bg-yellow-100 text-yellow-700',
  GENERAL: 'bg-gray-100 text-gray-700',
};

export const REACTION_EMOJI: Record<ReactionType, string> = {
  LIKE: '👍',
  CLAP: '👏',
  CELEBRATE: '🎉',
  HEART: '❤️',
  INSIGHTFUL: '💡',
};

export const REACTION_LABEL: Record<ReactionType, string> = {
  LIKE: 'Thích',
  CLAP: 'Tán thưởng',
  CELEBRATE: 'Chúc mừng',
  HEART: 'Yêu thích',
  INSIGHTFUL: 'Bổ ích',
};
