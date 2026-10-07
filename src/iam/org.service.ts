import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const SAU_TOI_DA = 6;

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  async recomputePath(rootId: number): Promise<void> {
    // BFS từ rootId, tính duongDan = parent.duongDan + id + '/'
    const queue: number[] = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      const node = await this.prisma.department.findUnique({ where: { id } });
      if (!node) continue;
      let path: string;
      if (node.parentId) {
        const parent = await this.prisma.department.findUnique({ where: { id: node.parentId } });
        const base = parent?.duongDan ?? `/${node.parentId}/`;
        path = `${base}${id}/`;
      } else { path = `/${id}/`; }
      await this.prisma.department.update({ where: { id }, data: { duongDan: path } });
      const children = await this.prisma.department.findMany({ where: { parentId: id }, select: { id: true } });
      for (const c of children) queue.push(c.id);
    }
  }

  async branchIds(deptIds: number[]): Promise<number[]> {
    const out = new Set<number>();
    for (const pid of deptIds) {
      const self = await this.prisma.department.findUnique({ where: { id: pid } });
      if (!self) continue;
      out.add(pid);
      if (self.duongDan) {
        const kids = await this.prisma.department.findMany({ where: { duongDan: { startsWith: self.duongDan } }, select: { id: true } });
        for (const k of kids) out.add(k.id);
      }
    }
    return [...out];
  }

  async canSetParent(id: number, parentId: number): Promise<boolean> {
    if (id === parentId) return false;
    // leo từ parentId lên gốc; nếu gặp id -> vòng tròn; nếu sâu quá SAU_TOI_DA -> chặn
    let cur: number | null = parentId; let depth = 1;
    while (cur) {
      if (cur === id) return false;
      if (++depth > SAU_TOI_DA) return false;
      const p: { parentId: number | null } | null = await this.prisma.department.findUnique({ where: { id: cur }, select: { parentId: true } });
      cur = p?.parentId ?? null;
    }
    return true;
  }
}
