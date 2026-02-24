import { PrismaClient, ApprovalCategory } from '@prisma/client';

/**
 * Seed 15 default approval flow definitions.
 * Uses createMany/create in a transaction to build nodes + edges for each flow.
 */
export async function seedApprovalFlows(prisma: PrismaClient) {
  console.log('  📋 Seeding approval flow definitions...');

  const existingCount = await prisma.approvalFlowDefinition.count();
  if (existingCount > 0) {
    console.log('  ⏭️  Approval flows already exist, skipping...');
    return;
  }

  const systemUserId = 'system';

  // Helper to create a flow with nodes and edges
  async function createFlow(flow: {
    name: string;
    description: string;
    category: string;
    triggerType: string;
    nodes: Array<{
      nodeKey: string;
      nodeType: string;
      label?: string;
      approverType?: string;
      approverRole?: string;
      approvalMode?: string;
      conditionField?: string;
      conditionOperator?: string;
      conditionValue?: string;
      deadlineHours?: number;
      positionX?: number;
      positionY?: number;
    }>;
    edges: Array<{
      sourceKey: string;
      targetKey: string;
      label?: string;
      conditionExpression?: string;
      sortOrder?: number;
    }>;
  }) {
    const flowDef = await prisma.approvalFlowDefinition.create({
      data: {
        name: flow.name,
        description: flow.description,
        category: flow.category as ApprovalCategory,
        triggerType: flow.triggerType,
        isActive: true,
        version: 1,
        createdBy: systemUserId,
      },
    });

    const nodeIdMap = new Map<string, string>();

    for (const node of flow.nodes) {
      const created = await prisma.approvalFlowNode.create({
        data: {
          flowDefinitionId: flowDef.id,
          nodeKey: node.nodeKey,
          nodeType: node.nodeType as any,
          label: node.label,
          approverType: node.approverType as any,
          approverRole: node.approverRole as any,
          approvalMode: node.approvalMode as any,
          conditionField: node.conditionField,
          conditionOperator: node.conditionOperator,
          conditionValue: node.conditionValue,
          deadlineHours: node.deadlineHours,
          positionX: node.positionX ?? 0,
          positionY: node.positionY ?? 0,
        },
      });
      nodeIdMap.set(node.nodeKey, created.id);
    }

    for (const edge of flow.edges) {
      const sourceId = nodeIdMap.get(edge.sourceKey);
      const targetId = nodeIdMap.get(edge.targetKey);
      if (sourceId && targetId) {
        await prisma.approvalFlowEdge.create({
          data: {
            flowDefinitionId: flowDef.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            label: edge.label,
            conditionExpression: edge.conditionExpression,
            sortOrder: edge.sortOrder ?? 0,
          },
        });
      }
    }

    console.log(`    ✅ ${flow.name}`);
    return flowDef;
  }

  // ==========================================
  // SALES FLOWS (1-4)
  // ==========================================

  // 1. Giảm giá (có điều kiện theo %)
  await createFlow({
    name: 'Giảm giá',
    description: 'Quy trình duyệt giảm giá theo mức % và số tiền',
    category: 'SALES',
    triggerType: 'DISCOUNT',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'cond_percent', nodeType: 'CONDITION', label: 'Mức giảm giá?', conditionField: 'discountPercent', positionX: 250, positionY: 100 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Trưởng nhóm KD', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 24, positionX: 100, positionY: 200 },
      { nodeKey: 'accountant_ar', nodeType: 'APPROVER', label: 'Kế toán TT', approverType: 'ROLE', approverRole: 'ACCOUNTANT_AR', deadlineHours: 24, positionX: 100, positionY: 300 },
      { nodeKey: 'sales_director', nodeType: 'APPROVER', label: 'GĐ Kinh doanh', approverType: 'ROLE', approverRole: 'SALES_DIRECTOR', deadlineHours: 24, positionX: 250, positionY: 300 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 400, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 450 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_percent' },
      { sourceKey: 'cond_percent', targetKey: 'sales_leader', conditionExpression: 'discountPercent <= 3', sortOrder: 1, label: '≤ 3%' },
      { sourceKey: 'cond_percent', targetKey: 'sales_director', conditionExpression: 'discountPercent > 3 && discountPercent <= 5', sortOrder: 2, label: '3-5%' },
      { sourceKey: 'cond_percent', targetKey: 'coo', conditionExpression: 'discountPercent > 5', sortOrder: 3, label: '> 5%' },
      { sourceKey: 'sales_leader', targetKey: 'accountant_ar' },
      { sourceKey: 'accountant_ar', targetKey: 'end' },
      { sourceKey: 'sales_director', targetKey: 'accountant_ar' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // 2. Hủy đơn (theo giai đoạn)
  await createFlow({
    name: 'Hủy đơn hàng',
    description: 'Quy trình duyệt hủy đơn theo giai đoạn đơn hàng',
    category: 'SALES',
    triggerType: 'ORDER_CANCEL',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'cond_stage', nodeType: 'CONDITION', label: 'Giai đoạn?', conditionField: 'cancelStage', positionX: 250, positionY: 100 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Trưởng nhóm KD', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 24, positionX: 100, positionY: 200 },
      { nodeKey: 'sales_director', nodeType: 'APPROVER', label: 'GĐ Kinh doanh', approverType: 'ROLE', approverRole: 'SALES_DIRECTOR', deadlineHours: 24, positionX: 250, positionY: 300 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 400, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 450 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_stage' },
      { sourceKey: 'cond_stage', targetKey: 'sales_leader', conditionExpression: "cancelStage == NO_DEPOSIT", sortOrder: 1, label: 'Chưa cọc' },
      { sourceKey: 'cond_stage', targetKey: 'sales_director', conditionExpression: "cancelStage == DEPOSIT_PAID", sortOrder: 2, label: 'Đã cọc' },
      { sourceKey: 'cond_stage', targetKey: 'coo', conditionExpression: "cancelStage == GOODS_PURCHASED", sortOrder: 3, label: 'Đã mua hàng' },
      { sourceKey: 'sales_leader', targetKey: 'end' },
      { sourceKey: 'sales_director', targetKey: 'sales_leader' },
      { sourceKey: 'coo', targetKey: 'sales_director' },
    ],
  });

  // 3. Gia hạn công nợ
  await createFlow({
    name: 'Gia hạn công nợ',
    description: 'Quy trình duyệt gia hạn công nợ cho khách hàng',
    category: 'SALES',
    triggerType: 'CREDIT_EXTENSION',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Trưởng nhóm KD', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'sales_leader' },
      { sourceKey: 'sales_leader', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // 4. Miễn/giảm cọc
  await createFlow({
    name: 'Miễn/giảm cọc',
    description: 'Quy trình duyệt miễn hoặc giảm tiền cọc',
    category: 'SALES',
    triggerType: 'DEPOSIT_EXEMPTION',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Trưởng nhóm KD', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 300 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'sales_leader' },
      { sourceKey: 'sales_leader', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'end' },
    ],
  });

  // ==========================================
  // FINANCE FLOWS (5-7)
  // ==========================================

  // 5. Phiếu chi (theo số tiền)
  await createFlow({
    name: 'Phiếu chi',
    description: 'Quy trình duyệt phiếu chi theo số tiền',
    category: 'FINANCE',
    triggerType: 'PAYMENT_VOUCHER',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'cond_amount', nodeType: 'CONDITION', label: 'Số tiền?', conditionField: 'amount', positionX: 250, positionY: 100 },
      { nodeKey: 'accountant_ar', nodeType: 'APPROVER', label: 'Kế toán TT', approverType: 'ROLE', approverRole: 'ACCOUNTANT_AR', deadlineHours: 24, positionX: 100, positionY: 200 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 400, positionY: 200 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 350 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 450 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_amount' },
      { sourceKey: 'cond_amount', targetKey: 'accountant_ar', conditionExpression: 'amount <= 50000000', sortOrder: 1, label: '≤ 50M' },
      { sourceKey: 'cond_amount', targetKey: 'chief_accountant', conditionExpression: 'amount > 50000000', sortOrder: 2, label: '> 50M' },
      { sourceKey: 'accountant_ar', targetKey: 'coo' },
      { sourceKey: 'chief_accountant', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // 6. Phiếu thu
  await createFlow({
    name: 'Phiếu thu',
    description: 'Quy trình duyệt phiếu thu',
    category: 'FINANCE',
    triggerType: 'RECEIPT_VOUCHER',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'accountant_ar', nodeType: 'APPROVER', label: 'Kế toán TT', approverType: 'ROLE', approverRole: 'ACCOUNTANT_AR', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 300 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'accountant_ar' },
      { sourceKey: 'accountant_ar', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'end' },
    ],
  });

  // 7. Hoàn ứng chi phí
  await createFlow({
    name: 'Hoàn ứng chi phí',
    description: 'Quy trình duyệt hoàn ứng chi phí',
    category: 'FINANCE',
    triggerType: 'EXPENSE_CLAIM',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'accountant_cost', nodeType: 'APPROVER', label: 'Kế toán chi phí', approverType: 'ROLE', approverRole: 'ACCOUNTANT_COST', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'accountant_cost' },
      { sourceKey: 'accountant_cost', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // ==========================================
  // LOGISTICS FLOWS (8-10)
  // ==========================================

  // 8. Kế hoạch Container
  await createFlow({
    name: 'Kế hoạch Container',
    description: 'Quy trình duyệt kế hoạch container',
    category: 'LOGISTICS',
    triggerType: 'CONTAINER_PLAN',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'xnk_staff', nodeType: 'APPROVER', label: 'NV XNK', approverType: 'ROLE', approverRole: 'XNK_STAFF', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'xnk_manager', nodeType: 'APPROVER', label: 'TP XNK', approverType: 'ROLE', approverRole: 'XNK_MANAGER', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'xnk_staff' },
      { sourceKey: 'xnk_staff', targetKey: 'xnk_manager' },
      { sourceKey: 'xnk_manager', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // 9. Xuất kho
  await createFlow({
    name: 'Xuất kho',
    description: 'Quy trình duyệt xuất kho Việt Nam',
    category: 'LOGISTICS',
    triggerType: 'WAREHOUSE_RELEASE',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'wh_staff', nodeType: 'APPROVER', label: 'NV kho VN', approverType: 'ROLE', approverRole: 'WAREHOUSE_VN_STAFF', deadlineHours: 12, positionX: 250, positionY: 100 },
      { nodeKey: 'wh_manager', nodeType: 'APPROVER', label: 'Trưởng kho VN', approverType: 'ROLE', approverRole: 'WAREHOUSE_VN_MANAGER', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'xnk_manager', nodeType: 'APPROVER', label: 'TP XNK', approverType: 'ROLE', approverRole: 'XNK_MANAGER', deadlineHours: 24, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'wh_staff' },
      { sourceKey: 'wh_staff', targetKey: 'wh_manager' },
      { sourceKey: 'wh_manager', targetKey: 'xnk_manager' },
      { sourceKey: 'xnk_manager', targetKey: 'end' },
    ],
  });

  // 10. Mua hàng (PO)
  await createFlow({
    name: 'Mua hàng',
    description: 'Quy trình duyệt đơn mua hàng theo số tiền',
    category: 'LOGISTICS',
    triggerType: 'PURCHASE_ORDER',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'xnk_staff', nodeType: 'APPROVER', label: 'NV XNK', approverType: 'ROLE', approverRole: 'XNK_STAFF', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'xnk_manager', nodeType: 'APPROVER', label: 'TP XNK', approverType: 'ROLE', approverRole: 'XNK_MANAGER', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'cond_amount', nodeType: 'CONDITION', label: 'Số tiền > 50M?', conditionField: 'amount', positionX: 250, positionY: 300 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 400, positionY: 400 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 500 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'xnk_staff' },
      { sourceKey: 'xnk_staff', targetKey: 'xnk_manager' },
      { sourceKey: 'xnk_manager', targetKey: 'cond_amount' },
      { sourceKey: 'cond_amount', targetKey: 'chief_accountant', conditionExpression: 'amount > 50000000', sortOrder: 1, label: '> 50M' },
      { sourceKey: 'cond_amount', targetKey: 'end', sortOrder: 2, label: '≤ 50M' },
      { sourceKey: 'chief_accountant', targetKey: 'end' },
    ],
  });

  // ==========================================
  // HR FLOWS (11-13)
  // ==========================================

  // 11. Nghỉ phép
  await createFlow({
    name: 'Nghỉ phép',
    description: 'Quy trình duyệt đơn xin nghỉ phép',
    category: 'HR',
    triggerType: 'LEAVE_REQUEST',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'direct_manager', nodeType: 'APPROVER', label: 'Quản lý trực tiếp', approverType: 'DIRECT_MANAGER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 200 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'direct_manager' },
      { sourceKey: 'direct_manager', targetKey: 'end' },
    ],
  });

  // 12. Tăng ca
  await createFlow({
    name: 'Tăng ca',
    description: 'Quy trình duyệt đơn xin tăng ca',
    category: 'HR',
    triggerType: 'OVERTIME_REQUEST',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'direct_manager', nodeType: 'APPROVER', label: 'Quản lý trực tiếp', approverType: 'DIRECT_MANAGER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 200 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'direct_manager' },
      { sourceKey: 'direct_manager', targetKey: 'end' },
    ],
  });

  // 13. Điều chỉnh lương
  await createFlow({
    name: 'Điều chỉnh lương',
    description: 'Quy trình duyệt điều chỉnh lương nhân viên',
    category: 'HR',
    triggerType: 'SALARY_ADJUSTMENT',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 48, positionX: 250, positionY: 100 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 200 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 300 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // ==========================================
  // SPECIAL FLOWS (14-15)
  // ==========================================

  // 14. Báo giá đặc biệt
  await createFlow({
    name: 'Báo giá đặc biệt',
    description: 'Quy trình duyệt báo giá đặc biệt theo giá trị',
    category: 'SALES',
    triggerType: 'QUOTATION_SPECIAL',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Trưởng nhóm KD', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'cond_amount', nodeType: 'CONDITION', label: 'Giá trị lớn?', conditionField: 'amount', positionX: 250, positionY: 200 },
      { nodeKey: 'sales_director', nodeType: 'APPROVER', label: 'GĐ Kinh doanh', approverType: 'ROLE', approverRole: 'SALES_DIRECTOR', deadlineHours: 24, positionX: 400, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'sales_leader' },
      { sourceKey: 'sales_leader', targetKey: 'cond_amount' },
      { sourceKey: 'cond_amount', targetKey: 'sales_director', conditionExpression: 'amount > 100000000', sortOrder: 1, label: '> 100M' },
      { sourceKey: 'cond_amount', targetKey: 'end', sortOrder: 2, label: '≤ 100M' },
      { sourceKey: 'sales_director', targetKey: 'end' },
    ],
  });

  // ==========================================
  // PRE-GO-LIVE FLOWS (16-18)
  // ==========================================

  // 16. Ân hạn (Grace Period)
  await createFlow({
    name: 'Xin ân hạn',
    description: 'Quy trình duyệt xin ân hạn cho khách hàng VIP',
    category: 'SALES',
    triggerType: 'GRACE_PERIOD_REQUEST',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'sale', nodeType: 'APPROVER', label: 'Sale', approverType: 'ROLE', approverRole: 'SALE', deadlineHours: 12, positionX: 250, positionY: 100 },
      { nodeKey: 'cfo', nodeType: 'APPROVER', label: 'CFO', approverType: 'ROLE', approverRole: 'CFO', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'ceo', nodeType: 'APPROVER', label: 'CEO', approverType: 'ROLE', approverRole: 'CEO', deadlineHours: 48, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'sale' },
      { sourceKey: 'sale', targetKey: 'cfo' },
      { sourceKey: 'cfo', targetKey: 'ceo' },
      { sourceKey: 'ceo', targetKey: 'end' },
    ],
  });

  // 17. Phụ phí phát sinh (Extra Charge Approval)
  await createFlow({
    name: 'Phụ phí phát sinh',
    description: 'Quy trình duyệt phụ phí phát sinh trên đơn hàng',
    category: 'LOGISTICS',
    triggerType: 'EXTRA_CHARGE_APPROVAL',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'wh_manager', nodeType: 'APPROVER', label: 'Trưởng kho', approverType: 'ROLE', approverRole: 'WAREHOUSE_VN_MANAGER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 300 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'wh_manager' },
      { sourceKey: 'wh_manager', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'end' },
    ],
  });

  // 18. Thấu chi tạm thời (Credit Overdraft)
  await createFlow({
    name: 'Thấu chi tạm thời',
    description: 'Quy trình duyệt thấu chi tạm thời cho khách hàng',
    category: 'SALES',
    triggerType: 'CREDIT_OVERDRAFT',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Trưởng nhóm KD', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 12, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Kế toán trưởng', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'COO', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 24, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'sales_leader' },
      { sourceKey: 'sales_leader', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  // 15. Custom template (trống)
  await createFlow({
    name: 'Quy trình tùy chỉnh',
    description: 'Template trống cho admin tự thiết kế quy trình mới',
    category: 'CUSTOM',
    triggerType: 'CUSTOM',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Bắt đầu', positionX: 250, positionY: 0 },
      { nodeKey: 'approver_1', nodeType: 'APPROVER', label: 'Người duyệt', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 150 },
      { nodeKey: 'end', nodeType: 'END', label: 'Kết thúc', positionX: 250, positionY: 300 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_1' },
      { sourceKey: 'approver_1', targetKey: 'end' },
    ],
  });

  // 19. Duyệt chi mua hàng NCC (Procurement Payment)
  await createFlow({
    name: 'Duyệt chi mua hàng NCC',
    description: 'Quy trình duyệt chi tiền mua hàng NCC 4 cấp: Sale tạo → Trưởng nhóm KD → Kế toán trưởng → COO',
    category: 'FINANCE',
    triggerType: 'PROCUREMENT_PAYMENT',
    nodes: [
      { nodeKey: 'start', nodeType: 'START', label: 'Sale tạo phiếu', positionX: 250, positionY: 0 },
      { nodeKey: 'sales_leader', nodeType: 'APPROVER', label: 'Duyệt nghiệp vụ', approverType: 'ROLE', approverRole: 'SALES_LEADER', deadlineHours: 24, positionX: 250, positionY: 100 },
      { nodeKey: 'chief_accountant', nodeType: 'APPROVER', label: 'Duyệt số dư/Tỷ giá', approverType: 'ROLE', approverRole: 'CHIEF_ACCOUNTANT', deadlineHours: 24, positionX: 250, positionY: 200 },
      { nodeKey: 'coo', nodeType: 'APPROVER', label: 'Duyệt chi cuối cùng', approverType: 'ROLE', approverRole: 'COO', deadlineHours: 48, positionX: 250, positionY: 300 },
      { nodeKey: 'end', nodeType: 'END', label: 'Hoàn thành', positionX: 250, positionY: 400 },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'sales_leader' },
      { sourceKey: 'sales_leader', targetKey: 'chief_accountant' },
      { sourceKey: 'chief_accountant', targetKey: 'coo' },
      { sourceKey: 'coo', targetKey: 'end' },
    ],
  });

  console.log('  ✅ All 19 approval flows seeded successfully');
}
