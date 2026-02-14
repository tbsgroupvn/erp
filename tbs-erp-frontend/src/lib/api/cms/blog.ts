import { apiClient } from '../client';

// Blog Category
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  parent?: BlogCategory;
  children?: BlogCategory[];
  _count?: {
    posts: number;
  };
}

export interface CreateBlogCategoryDto {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  order?: number;
}

// Blog Post
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  views: number;
  authorId: string;
  authorName?: string;
  categoryId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  category?: BlogCategory;
  author?: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    comments: number;
  };
}

export interface CreateBlogPostDto {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
  author?: string;
}

export interface BlogPostFilters {
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Blog Comment
export interface BlogComment {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  postId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  post?: {
    id: string;
    title: string;
    slug: string;
  };
  replies?: BlogComment[];
}

export interface CreateBlogCommentDto {
  content: string;
  authorName: string;
  authorEmail: string;
  postId: string;
  parentId?: string;
}

export interface BlogCommentFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  postId?: string;
  page?: number;
  limit?: number;
}

// API Functions
export const blogCategoriesApi = {
  getAll: () => apiClient.get<{ data: BlogCategory[] }>('/cms/blog/categories'),

  getById: (id: string) =>
    apiClient.get<{ data: BlogCategory }>(`/cms/blog/categories/${id}`),

  create: (data: CreateBlogCategoryDto) =>
    apiClient.post<{ data: BlogCategory }>('/cms/blog/categories', data),

  update: (id: string, data: Partial<CreateBlogCategoryDto>) =>
    apiClient.patch<{ data: BlogCategory }>(`/cms/blog/categories/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/cms/blog/categories/${id}`),
};

export const blogPostsApi = {
  getAll: (filters?: BlogPostFilters) =>
    apiClient.get<{ data: BlogPost[]; total: number }>('/cms/blog/posts', { params: filters }),

  getById: (id: string) =>
    apiClient.get<{ data: BlogPost }>(`/cms/blog/posts/${id}`),

  create: (data: CreateBlogPostDto) =>
    apiClient.post<{ data: BlogPost }>('/cms/blog/posts', data),

  update: (id: string, data: Partial<CreateBlogPostDto>) =>
    apiClient.patch<{ data: BlogPost }>(`/cms/blog/posts/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/cms/blog/posts/${id}`),

  duplicate: (id: string) =>
    apiClient.post<{ data: BlogPost }>(`/cms/blog/posts/${id}/duplicate`),
};

export const blogCommentsApi = {
  getAll: (filters?: BlogCommentFilters) =>
    apiClient.get<{ data: BlogComment[]; total: number }>('/cms/blog/comments', { params: filters }),

  getById: (id: string) =>
    apiClient.get<{ data: BlogComment }>(`/cms/blog/comments/${id}`),

  approve: (id: string) =>
    apiClient.patch<{ data: BlogComment }>(`/cms/blog/comments/${id}/approve`),

  reject: (id: string) =>
    apiClient.patch<{ data: BlogComment }>(`/cms/blog/comments/${id}/reject`),

  delete: (id: string) =>
    apiClient.delete(`/cms/blog/comments/${id}`),
};
