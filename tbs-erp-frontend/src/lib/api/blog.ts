import { apiClient, extractData } from './client';
import type { AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
}

export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
  createdAt: string;
  viewCount?: number;
}

export interface BlogPostQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  status?: 'draft' | 'published' | 'archived';
  sortBy?: 'publishedAt' | 'viewCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedBlogResponse {
  items: BlogPostListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateBlogPostDto {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  tags: string[];
  status: 'draft' | 'published';
  publishedAt?: string;
}

export interface UpdateBlogPostDto {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  publishedAt?: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export const blogApi = {
  /**
   * Get paginated list of blog posts (public)
   */
  list: async (params?: BlogPostQueryParams): Promise<PaginatedBlogResponse> => {
    const response: AxiosResponse<{ data: PaginatedBlogResponse }> =
      await apiClient.get('/blog-posts', { params });
    return extractData(response);
  },

  /**
   * Get blog post by slug (public)
   */
  getBySlug: async (slug: string): Promise<BlogPost> => {
    const response: AxiosResponse<{ data: BlogPost }> = await apiClient.get(
      `/blog-posts/slug/${slug}`,
    );
    return extractData(response);
  },

  /**
   * Get blog post by ID (admin)
   */
  getById: async (id: string): Promise<BlogPost> => {
    const response: AxiosResponse<{ data: BlogPost }> = await apiClient.get(
      `/blog-posts/${id}`,
    );
    return extractData(response);
  },

  /**
   * Create new blog post (admin)
   */
  create: async (data: CreateBlogPostDto): Promise<BlogPost> => {
    const response: AxiosResponse<{ data: BlogPost }> = await apiClient.post(
      '/blog-posts',
      data,
    );
    return extractData(response);
  },

  /**
   * Update blog post (admin)
   */
  update: async (id: string, data: UpdateBlogPostDto): Promise<BlogPost> => {
    const response: AxiosResponse<{ data: BlogPost }> = await apiClient.patch(
      `/blog-posts/${id}`,
      data,
    );
    return extractData(response);
  },

  /**
   * Delete blog post (admin)
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/blog-posts/${id}`);
  },

  /**
   * Get all unique tags
   */
  getTags: async (): Promise<string[]> => {
    const response: AxiosResponse<{ data: string[] }> = await apiClient.get(
      '/blog-posts/tags',
    );
    return extractData(response);
  },

  /**
   * Increment view count
   */
  incrementView: async (slug: string): Promise<void> => {
    await apiClient.post(`/blog-posts/slug/${slug}/view`);
  },
};
