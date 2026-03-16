import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { WikiAccess, Prisma } from '@prisma/client';

@Injectable()
export class WikiRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // SPACES
  // ============================================================

  /**
   * Trả về danh sách spaces mà userId có quyền xem:
   * - PUBLIC: tất cả
   * - PRIVATE: chỉ chính owner
   * - TEAM: owner + cùng teamScope (role-based filtering xử lý ở service)
   */
  async findSpaces(userId: string) {
    return this.prisma.wikiSpace.findMany({
      where: {
        OR: [
          { access: WikiAccess.PUBLIC },
          { ownerId: userId },
        ],
      },
      include: {
        _count: { select: { pages: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findSpaceById(id: string) {
    return this.prisma.wikiSpace.findUnique({
      where: { id },
      include: {
        _count: { select: { pages: { where: { deletedAt: null } } } },
      },
    });
  }

  async findSpaceBySlug(slug: string) {
    return this.prisma.wikiSpace.findUnique({
      where: { slug },
      include: {
        _count: { select: { pages: { where: { deletedAt: null } } } },
      },
    });
  }

  async createSpace(data: Prisma.WikiSpaceUncheckedCreateInput) {
    return this.prisma.wikiSpace.create({ data });
  }

  async updateSpace(id: string, data: Prisma.WikiSpaceUpdateInput) {
    return this.prisma.wikiSpace.update({ where: { id }, data });
  }

  async deleteSpace(id: string) {
    return this.prisma.wikiSpace.delete({ where: { id } });
  }

  // ============================================================
  // PAGES
  // ============================================================

  /**
   * Trả về tất cả pages trong một space:
   * - Published: tất cả user có quyền xem space
   * - Draft (isPublished = false): chỉ author
   */
  async findPages(spaceId: string, userId: string) {
    return this.prisma.wikiPage.findMany({
      where: {
        spaceId,
        deletedAt: null,
        OR: [
          { isPublished: true },
          { authorId: userId },
        ],
      },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
  }

  async findPageById(id: string) {
    return this.prisma.wikiPage.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 20,
          select: {
            id: true,
            version: true,
            title: true,
            authorId: true,
            changeSummary: true,
            createdAt: true,
          },
        },
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
  }

  async findPageBySlug(spaceId: string, slug: string) {
    return this.prisma.wikiPage.findFirst({
      where: { spaceId, slug, deletedAt: null },
    });
  }

  async createPage(data: Prisma.WikiPageUncheckedCreateInput) {
    return this.prisma.wikiPage.create({ data });
  }

  async updatePage(id: string, data: Prisma.WikiPageUncheckedUpdateInput) {
    return this.prisma.wikiPage.update({ where: { id }, data });
  }

  async softDeletePage(id: string) {
    return this.prisma.wikiPage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async incrementViewCount(id: string) {
    return this.prisma.wikiPage.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  // ============================================================
  // PAGE VERSIONS
  // ============================================================

  async getLatestVersion(pageId: string): Promise<number> {
    const latest = await this.prisma.wikiPageVersion.findFirst({
      where: { pageId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  async createPageVersion(data: Prisma.WikiPageVersionUncheckedCreateInput) {
    return this.prisma.wikiPageVersion.create({ data });
  }

  async findVersions(pageId: string) {
    return this.prisma.wikiPageVersion.findMany({
      where: { pageId },
      orderBy: { version: 'desc' },
    });
  }

  async findVersionByNumber(pageId: string, version: number) {
    return this.prisma.wikiPageVersion.findUnique({
      where: { pageId_version: { pageId, version } },
    });
  }

  // ============================================================
  // SEARCH
  // ============================================================

  /**
   * Full text search đơn giản trên title và excerpt.
   * Kết hợp published filter + draft của chính user.
   */
  async searchPages(query: string, userId: string, accessibleSpaceIds: string[]) {
    return this.prisma.wikiPage.findMany({
      where: {
        deletedAt: null,
        spaceId: { in: accessibleSpaceIds },
        OR: [
          { isPublished: true },
          { authorId: userId },
        ],
        AND: [
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { excerpt: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        space: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
  }

  // ============================================================
  // PAGE TREE
  // ============================================================

  /**
   * Lấy toàn bộ pages flat trong space để build tree ở service layer.
   */
  async buildPageTree(spaceId: string, userId: string) {
    return this.prisma.wikiPage.findMany({
      where: {
        spaceId,
        deletedAt: null,
        OR: [
          { isPublished: true },
          { authorId: userId },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
        position: true,
        isPublished: true,
        viewCount: true,
        authorId: true,
        updatedAt: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
