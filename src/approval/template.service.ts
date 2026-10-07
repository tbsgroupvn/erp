import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}
  getByCode(code: string) { return this.prisma.approvalTemplate.findUnique({ where: { code } }); }
  getSteps(templateId: number, branchId: number | null) {
    return this.prisma.approvalStep.findMany({
      where: { templateId, branchId: branchId ?? null },
      orderBy: { stepOrder: 'asc' }, include: { approvers: true },
    });
  }
  getFormFields(templateId: number) {
    return this.prisma.approvalFormField.findMany({ where: { templateId }, orderBy: { sortOrder: 'asc' } });
  }
}
