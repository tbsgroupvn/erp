import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateService } from './template.service';
import { BranchEvaluator } from './branch-evaluator';
import { AStatus } from './approval.constants';

function nowSec() { return Math.floor(Date.now() / 1000); }

@Injectable()
export class RequestService {
  constructor(private prisma: PrismaService, private tpl: TemplateService, private be: BranchEvaluator) {}

  async submit(templateCode: string, objectType: string, objectId: number, objectCode: string,
               submittedBy: string, formData: Record<string, any> = {}, selfSelected?: string[]) {
    const t = await this.tpl.getByCode(templateCode);
    if (!t || !t.isactive) throw new BadRequestException('Mẫu không tồn tại/đã tắt');
    // I-2: loại phiếu lấy từ MẪU (quản trị cấu hình), KHÔNG từ lời người gửi. Hiệu ứng tiền và tiền
    // giữ đều chọn theo objectType — tin người gửi thì mẫu bất kỳ trừ/đóng băng được ví khách bất kỳ.
    // Người gọi khai loại KHÁC mẫu ⇒ từ chối thẳng (fail-closed, lộ cấu hình sai) chứ không lặng lẽ
    // đổi: phiếu mang loại khác với điều người gọi tưởng thì hiệu ứng chạy trên nhầm đối tượng.
    const claimed = (objectType ?? '').trim();
    if (claimed && claimed !== t.objectType)
      throw new BadRequestException(`Loại phiếu "${claimed}" không khớp mẫu ${t.code} (loại "${t.objectType}")`);
    objectType = t.objectType;
    const branchId = await this.be.resolveBranch(t.id, formData);
    const steps = await this.tpl.getSteps(t.id, branchId);
    if (!steps.length) throw new BadRequestException('Mẫu chưa cấu hình bước');
    const first = steps[0];
    const req = await this.prisma.approvalRequest.create({ data: {
      templateId: t.id, objectType, objectId, objectCode, currentStepOrder: first.stepOrder,
      status: AStatus.PENDING, submittedBy, submittedAt: nowSec(), pendingSince: nowSec(),
      formData: JSON.stringify({ ...formData, ...(selfSelected ? { __selfSelected: selfSelected } : {}) }),
      resolvedBranchId: branchId,
    }});
    return { requestId: req.id, currentStepOrder: first.stepOrder };
  }
}
