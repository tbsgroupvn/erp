import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { WikiAccess } from '@prisma/client';
import { WikiRepository } from './wiki.repository';
import {
  CreateSpaceDto,
  UpdateSpaceDto,
  CreatePageDto,
  UpdatePageDto,
  MovePageDto,
  WikiQueryDto,
} from './dto/index';

// ---------------------------------------------------------------------------
// Helper: build nested tree from flat list
// ---------------------------------------------------------------------------
export interface PageNode {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  position: number;
  isPublished: boolean;
  viewCount: number;
  authorId: string;
  updatedAt: Date;
  _count: { children: number };
  children: PageNode[];
}

function buildTree(flatPages: Omit<PageNode, 'children'>[]): PageNode[] {
  const map = new Map<string, PageNode>();
  const roots: PageNode[] = [];

  for (const page of flatPages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of flatPages) {
    const node = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: PageNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

// ---------------------------------------------------------------------------
// WikiService
// ---------------------------------------------------------------------------
@Injectable()
export class WikiService {
  private readonly logger = new Logger(WikiService.name);

  constructor(private readonly repo: WikiRepository) {}

  // ============================================================
  // SPACES
  // ============================================================

  async createSpace(userId: string, dto: CreateSpaceDto) {
    // Check duplicate slug
    const existing = await this.repo.findSpaceBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }

    return this.repo.createSpace({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      icon: dto.icon,
      color: dto.color ?? '#3b82f6',
      access: dto.access ?? WikiAccess.PUBLIC,
      teamScope: dto.teamScope,
      ownerId: userId,
    });
  }

  async updateSpace(userId: string, spaceId: string, dto: UpdateSpaceDto) {
    const space = await this.repo.findSpaceById(spaceId);
    if (!space) throw new NotFoundException('Space không tồn tại');
    if (space.ownerId !== userId) throw new ForbiddenException('Chỉ owner mới được chỉnh sửa space');

    // Nếu slug thay đổi, kiểm tra duplicate
    if (dto.slug && dto.slug !== space.slug) {
      const conflict = await this.repo.findSpaceBySlug(dto.slug);
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }

    return this.repo.updateSpace(spaceId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.access !== undefined && { access: dto.access }),
      ...(dto.teamScope !== undefined && { teamScope: dto.teamScope }),
    });
  }

  async deleteSpace(userId: string, spaceId: string) {
    const space = await this.repo.findSpaceById(spaceId);
    if (!space) throw new NotFoundException('Space không tồn tại');
    if (space.ownerId !== userId) throw new ForbiddenException('Chỉ owner mới được xóa space');

    await this.repo.deleteSpace(spaceId);
    return { deleted: true };
  }

  async getSpaces(userId: string) {
    return this.repo.findSpaces(userId);
  }

  async getSpaceBySlug(slug: string) {
    const space = await this.repo.findSpaceBySlug(slug);
    if (!space) throw new NotFoundException('Space không tồn tại');
    return space;
  }

  // ============================================================
  // PAGES
  // ============================================================

  async createPage(userId: string, dto: CreatePageDto) {
    // Verify space exists
    const space = await this.repo.findSpaceById(dto.spaceId);
    if (!space) throw new NotFoundException('Space không tồn tại');

    // Generate unique slug from title
    let slug = this.slugify(dto.title);
    const existing = await this.repo.findPageBySlug(dto.spaceId, slug);
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Generate excerpt from content (strip HTML)
    const excerpt = this.extractExcerpt(dto.content);

    const page = await this.repo.createPage({
      spaceId: dto.spaceId,
      title: dto.title,
      slug,
      content: dto.content,
      excerpt,
      authorId: userId,
      parentId: dto.parentId ?? null,
      position: dto.position ?? 0,
      isPublished: false,
    });

    // Auto-create version 1
    await this.repo.createPageVersion({
      pageId: page.id,
      version: 1,
      title: dto.title,
      content: dto.content,
      authorId: userId,
      changeSummary: 'Tạo trang mới',
    });

    return page;
  }

  async updatePage(userId: string, pageId: string, dto: UpdatePageDto) {
    const page = await this.repo.findPageById(pageId);
    if (!page) throw new NotFoundException('Trang không tồn tại');
    if (page.authorId !== userId) throw new ForbiddenException('Chỉ tác giả mới được chỉnh sửa trang');

    const excerpt =
      dto.content !== undefined ? this.extractExcerpt(dto.content) : undefined;

    const updated = await this.repo.updatePage(pageId, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.content !== undefined && { content: dto.content, excerpt }),
      ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      ...(dto.position !== undefined && { position: dto.position }),
    });

    // Chỉ tạo version mới khi có thay đổi nội dung hoặc tiêu đề
    if (dto.title !== undefined || dto.content !== undefined) {
      const latestVersion = await this.repo.getLatestVersion(pageId);
      await this.repo.createPageVersion({
        pageId,
        version: latestVersion + 1,
        title: updated.title,
        content: updated.content,
        authorId: userId,
        changeSummary: dto.changeSummary,
      });
    }

    return updated;
  }

  async deletePage(userId: string, pageId: string) {
    const page = await this.repo.findPageById(pageId);
    if (!page) throw new NotFoundException('Trang không tồn tại');
    if (page.authorId !== userId) throw new ForbiddenException('Chỉ tác giả mới được xóa trang');

    await this.repo.softDeletePage(pageId);
    return { deleted: true };
  }

  async getPage(userId: string, pageId: string) {
    const page = await this.repo.findPageById(pageId);
    if (!page) throw new NotFoundException('Trang không tồn tại');

    // Increment view count async (không block response)
    this.repo.incrementViewCount(pageId).catch((err) =>
      this.logger.warn(`Failed to increment view count for page ${pageId}: ${err.message}`),
    );

    return page;
  }

  async getPageTree(spaceId: string, userId: string) {
    const space = await this.repo.findSpaceById(spaceId);
    if (!space) throw new NotFoundException('Space không tồn tại');

    const flatPages = await this.repo.buildPageTree(spaceId, userId);
    return buildTree(flatPages as any);
  }

  async searchPages(userId: string, query: WikiQueryDto) {
    if (!query.search || query.search.length < 2) {
      return [];
    }

    // Lấy danh sách space user có quyền xem
    const spaces = await this.repo.findSpaces(userId);
    const accessibleIds = spaces.map((s) => s.id);

    // Filter theo spaceId nếu có
    const searchIn = query.spaceId
      ? accessibleIds.filter((id) => id === query.spaceId)
      : accessibleIds;

    if (searchIn.length === 0) return [];

    const results = await this.repo.searchPages(query.search, userId, searchIn);

    // Highlight match trong title và excerpt
    return results.map((page) => ({
      ...page,
      highlightedTitle: this.highlight(page.title, query.search!),
      highlightedExcerpt: page.excerpt
        ? this.highlight(page.excerpt, query.search!)
        : null,
    }));
  }

  async movePage(userId: string, pageId: string, dto: MovePageDto) {
    const page = await this.repo.findPageById(pageId);
    if (!page) throw new NotFoundException('Trang không tồn tại');
    if (page.authorId !== userId) throw new ForbiddenException('Chỉ tác giả mới được di chuyển trang');

    // Tránh vòng lặp: không cho page làm con của chính nó hoặc descendant
    if (dto.parentId === pageId) {
      throw new ForbiddenException('Không thể di chuyển trang thành con của chính nó');
    }

    return this.repo.updatePage(pageId, {
      parentId: dto.parentId ?? null,
      position: dto.position,
    });
  }

  async getVersions(pageId: string) {
    const page = await this.repo.findPageById(pageId);
    if (!page) throw new NotFoundException('Trang không tồn tại');
    return this.repo.findVersions(pageId);
  }

  async getVersion(pageId: string, version: number) {
    const v = await this.repo.findVersionByNumber(pageId, version);
    if (!v) throw new NotFoundException(`Phiên bản ${version} không tồn tại`);
    return v;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);
  }

  private extractExcerpt(html: string, maxLength = 200): string {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  private highlight(text: string, query: string): string {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}
