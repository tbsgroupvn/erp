import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
export async function resetApproval() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_approval_templates, tbl_approval_steps, tbl_approval_step_approvers,
     tbl_approval_branch_groups, tbl_approval_branches, tbl_approval_form_fields,
     tbl_approval_requests, tbl_approval_actions, tbl_approval_request_approvers, tbl_approval_comments,
     tbl_user, tbl_role, tbl_user_role,
     tbl_return_config, tbl_return_fields, tbl_return_state RESTART IDENTITY CASCADE`);
}
export async function seedTemplate(code: string, o: { objectType?: string } = {}) {
  return prisma.approvalTemplate.create({ data: { code, name: code, objectType: o.objectType ?? 'wallet_alloc' } });
}
export async function seedStep(templateId: number, o: {
  order: number; name?: string; nodeType?: any; branchId?: number | null; selfApprovalAction?: any;
  selfApprovalRef?: number | null; emptyApproverAction?: any; approvalMode?: any;
}) {
  return prisma.approvalStep.create({ data: {
    templateId, stepOrder: o.order, stepName: o.name ?? ('S' + o.order),
    nodeType: o.nodeType ?? 'OR', branchId: o.branchId ?? null, selfApprovalAction: o.selfApprovalAction ?? 'skip',
    selfApprovalRef: o.selfApprovalRef ?? null,
    emptyApproverAction: o.emptyApproverAction ?? 'to_admin',
    approvalMode: o.approvalMode ?? 'manual',
  }});
}
export async function seedApprover(stepId: number, type: any, ref?: number) {
  return prisma.approvalStepApprover.create({ data: { stepId, approverType: type, approverRef: ref ?? null } });
}
export async function seedBranchGroup(templateId: number) { return prisma.approvalBranchGroup.create({ data: { templateId } }); }
export async function seedBranch(groupId: number, o: { priority: number; conditionJson: string; isDefault?: boolean }) {
  return prisma.approvalBranch.create({ data: { branchGroupId: groupId, priority: o.priority, conditionJson: o.conditionJson, isDefault: o.isDefault ?? false } });
}
