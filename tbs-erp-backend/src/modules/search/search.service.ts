import { Injectable } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';

export interface SearchResult {
  type: 'order' | 'customer' | 'task' | 'wiki' | 'complaint' | 'quotation' | 'employee';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: string; // lucide icon name
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, userId: string, limit = 20): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();
    const results: SearchResult[] = [];

    const [orders, customers, tasks, wikis, complaints, quotations, employees] = await Promise.all([
      this.searchOrders(q, limit),
      this.searchCustomers(q, limit),
      this.searchTasks(q, limit),
      this.searchWiki(q, limit),
      this.searchComplaints(q, limit),
      this.searchQuotations(q, limit),
      this.searchEmployees(q, limit),
    ]);

    results.push(...orders, ...customers, ...tasks, ...wikis, ...complaints, ...quotations, ...employees);

    // Sort by relevance: exact match first
    const lower = q.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(lower) ? 1 : 0;
      const bExact = b.title.toLowerCase().includes(lower) ? 1 : 0;
      return bExact - aExact;
    });

    return results.slice(0, limit);
  }

  private async searchOrders(q: string, limit: number): Promise<SearchResult[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        code: { contains: q, mode: 'insensitive' },
      },
      take: Math.ceil(limit / 5),
      select: { id: true, code: true, status: true, serviceType: true },
    });
    return orders.map((o) => ({
      type: 'order' as const,
      id: o.id,
      title: o.code,
      subtitle: `${o.status} · ${o.serviceType}`,
      href: `/don-hang/${o.id}`,
      icon: 'ShoppingCart',
    }));
  }

  private async searchCustomers(q: string, limit: number): Promise<SearchResult[]> {
    const customers = await this.prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: Math.ceil(limit / 5),
      select: { id: true, fullName: true, code: true, tier: true },
    });
    return customers.map((c) => ({
      type: 'customer' as const,
      id: c.id,
      title: c.fullName,
      subtitle: `${c.code} · ${c.tier}`,
      href: `/khach-hang/${c.id}`,
      icon: 'Users',
    }));
  }

  private async searchTasks(q: string, limit: number): Promise<SearchResult[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' },
      },
      take: Math.ceil(limit / 5),
      select: { id: true, title: true, status: true, priority: true },
    });
    return tasks.map((t) => ({
      type: 'task' as const,
      id: t.id,
      title: t.title,
      subtitle: `${t.status} · ${t.priority}`,
      href: `/cong-viec/${t.id}`,
      icon: 'ListTodo',
    }));
  }

  private async searchWiki(q: string, limit: number): Promise<SearchResult[]> {
    const pages = await this.prisma.wikiPage.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: Math.ceil(limit / 5),
      select: {
        id: true,
        title: true,
        excerpt: true,
        space: { select: { name: true, slug: true } },
      },
    });
    return pages.map((p) => ({
      type: 'wiki' as const,
      id: p.id,
      title: p.title,
      subtitle: p.space?.name,
      href: `/wiki/${p.space?.slug}?page=${p.id}`,
      icon: 'BookOpen',
    }));
  }

  private async searchComplaints(q: string, limit: number): Promise<SearchResult[]> {
    const items = await this.prisma.complaint.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: Math.ceil(limit / 5),
      select: { id: true, code: true, status: true, type: true },
    });
    return items.map((c) => ({
      type: 'complaint' as const,
      id: c.id,
      title: c.code,
      subtitle: `${c.status} · ${c.type}`,
      href: `/khieu-nai/${c.id}`,
      icon: 'AlertCircle',
    }));
  }

  private async searchQuotations(q: string, limit: number): Promise<SearchResult[]> {
    const items = await this.prisma.quotation.findMany({
      where: {
        code: { contains: q, mode: 'insensitive' },
      },
      take: Math.ceil(limit / 5),
      select: { id: true, code: true, status: true },
    });
    return items.map((item) => ({
      type: 'quotation' as const,
      id: item.id,
      title: item.code,
      subtitle: item.status,
      href: `/bao-gia/${item.id}`,
      icon: 'FileText',
    }));
  }

  private async searchEmployees(q: string, limit: number): Promise<SearchResult[]> {
    const items = await this.prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: Math.ceil(limit / 5),
      select: { id: true, fullName: true, code: true, departmentCode: true },
    });
    return items.map((e) => ({
      type: 'employee' as const,
      id: e.id,
      title: e.fullName,
      subtitle: `${e.code} · ${e.departmentCode ?? ''}`,
      href: `/nhan-su/${e.id}`,
      icon: 'UserCheck',
    }));
  }

  async getRecentItems(userId: string): Promise<SearchResult[]> {
    const [orders, tasks] = await Promise.all([
      this.prisma.order.findMany({
        where: { saleId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, code: true, status: true },
      }),
      this.prisma.task.findMany({
        where: { createdBy: userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, title: true, status: true },
      }),
    ]);

    return [
      ...orders.map((o) => ({
        type: 'order' as const,
        id: o.id,
        title: o.code,
        subtitle: o.status,
        href: `/don-hang/${o.id}`,
        icon: 'ShoppingCart',
      })),
      ...tasks.map((t) => ({
        type: 'task' as const,
        id: t.id,
        title: t.title,
        subtitle: t.status,
        href: `/cong-viec/${t.id}`,
        icon: 'ListTodo',
      })),
    ];
  }
}
