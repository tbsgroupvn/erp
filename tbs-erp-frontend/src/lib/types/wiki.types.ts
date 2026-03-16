// ============================================
// WIKI — Knowledge Base Types
// ============================================

export type WikiAccess = 'PUBLIC' | 'TEAM' | 'PRIVATE';

export interface WikiSpace {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  ownerId: string;
  teamScope?: string | null;
  access: WikiAccess;
  createdAt: string;
  updatedAt: string;
  _count?: {
    pages: number;
  };
}

export interface WikiPageVersionSummary {
  id: string;
  version: number;
  title: string;
  authorId: string;
  changeSummary?: string | null;
  createdAt: string;
}

export interface WikiPageVersion {
  id: string;
  pageId: string;
  version: number;
  title: string;
  content: string;
  authorId: string;
  changeSummary?: string | null;
  createdAt: string;
}

export interface WikiPageNode {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  position: number;
  isPublished: boolean;
  viewCount: number;
  authorId: string;
  updatedAt: string;
  _count: { children: number };
  children: WikiPageNode[];
}

export interface WikiPage {
  id: string;
  spaceId: string;
  space?: Pick<WikiSpace, 'id' | 'name' | 'slug' | 'color' | 'icon'>;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  authorId: string;
  parentId?: string | null;
  position: number;
  isPublished: boolean;
  viewCount: number;
  versions?: WikiPageVersionSummary[];
  _count?: { children: number };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface WikiSearchResult extends WikiPage {
  highlightedTitle: string;
  highlightedExcerpt: string | null;
}

// ============================================================
// DTOs
// ============================================================

export interface CreateSpaceDto {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  access?: WikiAccess;
  teamScope?: string;
}

export interface UpdateSpaceDto extends Partial<CreateSpaceDto> {}

export interface CreatePageDto {
  spaceId: string;
  title: string;
  content: string;
  parentId?: string;
  position?: number;
}

export interface UpdatePageDto {
  title?: string;
  content?: string;
  isPublished?: boolean;
  parentId?: string;
  position?: number;
  changeSummary?: string;
}

export interface MovePageDto {
  parentId?: string;
  position: number;
}

export interface WikiQueryDto {
  search?: string;
  spaceId?: string;
  authorId?: string;
}
