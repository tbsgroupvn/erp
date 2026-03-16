import { PrismaClient } from '@prisma/client';

// ============================================================
// APPROVAL FLOW TEMPLATES SEED
// 15 pre-built templates for common approval workflows
// ============================================================

interface NodeDef {
  key: string;
  type: 'START' | 'END' | 'APPROVER' | 'CONDITION';
  label: string;
  config?: Record<string, unknown>;
}

interface EdgeDef {
  sourceKey: string;
  targetKey: string;
  condition?: string;
  label?: string;
  isDefault?: boolean;
}

interface TemplateDef {
  slug: string;
  name: string;
  nameVi: string;
  description: string;
  descriptionVi: string;
  category: 'SALES' | 'FINANCE' | 'HR' | 'LOGISTICS' | 'CUSTOM';
  triggerType: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
}

const TEMPLATES: TemplateDef[] = [
  // ─────────────────────────────────────────────────────────
  // 1. DISCOUNT — 3 tiers based on discountPercent
  // ─────────────────────────────────────────────────────────
  {
    slug: 'discount-standard',
    name: 'Standard Discount Approval',
    nameVi: 'Phê duyệt chiết khấu tiêu chuẩn',
    description: '3-tier discount approval: ≤3% (SL+AR), ≤5% (SL+AR+SD), >5% (SL+AR+SD+COO)',
    descriptionVi:
      'Phê duyệt chiết khấu 3 cấp: ≤3% (Leader+KT), ≤5% (Leader+KT+GĐ KD), >5% (Leader+KT+GĐ KD+COO)',
    category: 'SALES',
    triggerType: 'DISCOUNT',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'cond_3pct',
        type: 'CONDITION',
        label: 'Chiết khấu ≤ 3%?',
        config: { expression: 'discountPercent <= 3', label: 'Chiết khấu ≤ 3%' },
      },
      {
        key: 'approver_sl',
        type: 'APPROVER',
        label: 'Sales Leader duyệt',
        config: { approverType: 'ROLE', role: 'SALES_LEADER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ar',
        type: 'APPROVER',
        label: 'KT Thanh toán duyệt',
        config: { approverType: 'ROLE', role: 'ACCOUNTANT_AR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'cond_5pct',
        type: 'CONDITION',
        label: 'Chiết khấu ≤ 5%?',
        config: { expression: 'discountPercent <= 5', label: 'Chiết khấu ≤ 5%' },
      },
      {
        key: 'approver_sl_b',
        type: 'APPROVER',
        label: 'Sales Leader duyệt (nhánh 5%)',
        config: { approverType: 'ROLE', role: 'SALES_LEADER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ar_b',
        type: 'APPROVER',
        label: 'KT Thanh toán duyệt (nhánh 5%)',
        config: { approverType: 'ROLE', role: 'ACCOUNTANT_AR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_sd_b',
        type: 'APPROVER',
        label: 'GĐ Kinh doanh duyệt (nhánh 5%)',
        config: { approverType: 'ROLE', role: 'SALES_DIRECTOR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_sl_c',
        type: 'APPROVER',
        label: 'Sales Leader duyệt (nhánh >5%)',
        config: { approverType: 'ROLE', role: 'SALES_LEADER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ar_c',
        type: 'APPROVER',
        label: 'KT Thanh toán duyệt (nhánh >5%)',
        config: { approverType: 'ROLE', role: 'ACCOUNTANT_AR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_sd_c',
        type: 'APPROVER',
        label: 'GĐ Kinh doanh duyệt (nhánh >5%)',
        config: { approverType: 'ROLE', role: 'SALES_DIRECTOR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo_c',
        type: 'APPROVER',
        label: 'COO duyệt (nhánh >5%)',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_3pct' },
      // Nhánh ≤3%
      {
        sourceKey: 'cond_3pct',
        targetKey: 'approver_sl',
        condition: 'discountPercent <= 3',
        label: 'Có (≤3%)',
      },
      { sourceKey: 'approver_sl', targetKey: 'approver_ar' },
      { sourceKey: 'approver_ar', targetKey: 'end' },
      // Nhánh >3% → kiểm tra 5%
      {
        sourceKey: 'cond_3pct',
        targetKey: 'cond_5pct',
        condition: 'discountPercent > 3',
        label: 'Không (>3%)',
      },
      // Nhánh ≤5%
      {
        sourceKey: 'cond_5pct',
        targetKey: 'approver_sl_b',
        condition: 'discountPercent <= 5',
        label: 'Có (≤5%)',
      },
      { sourceKey: 'approver_sl_b', targetKey: 'approver_ar_b' },
      { sourceKey: 'approver_ar_b', targetKey: 'approver_sd_b' },
      { sourceKey: 'approver_sd_b', targetKey: 'end' },
      // Nhánh >5%
      {
        sourceKey: 'cond_5pct',
        targetKey: 'approver_sl_c',
        condition: 'discountPercent > 5',
        label: 'Không (>5%)',
      },
      { sourceKey: 'approver_sl_c', targetKey: 'approver_ar_c' },
      { sourceKey: 'approver_ar_c', targetKey: 'approver_sd_c' },
      { sourceKey: 'approver_sd_c', targetKey: 'approver_coo_c' },
      { sourceKey: 'approver_coo_c', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 2. PAYMENT_VOUCHER — 2 tiers based on amount
  // ─────────────────────────────────────────────────────────
  {
    slug: 'payment-voucher-standard',
    name: 'Standard Payment Voucher Approval',
    nameVi: 'Phê duyệt phiếu chi tiêu chuẩn',
    description: '2-tier: ≤50M (AR+COO), >50M (AR+Chief Accountant+COO)',
    descriptionVi: '2 cấp: ≤50 triệu (KT+COO), >50 triệu (KT+KTTV+COO)',
    category: 'FINANCE',
    triggerType: 'PAYMENT_VOUCHER',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'cond_50m',
        type: 'CONDITION',
        label: 'Số tiền ≤ 50 triệu?',
        config: { expression: 'amount <= 50000000', label: 'Số tiền ≤ 50.000.000 VND' },
      },
      {
        key: 'approver_ar_a',
        type: 'APPROVER',
        label: 'KT Thanh toán duyệt (≤50M)',
        config: { approverType: 'ROLE', role: 'ACCOUNTANT_AR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo_a',
        type: 'APPROVER',
        label: 'COO duyệt (≤50M)',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ar_b',
        type: 'APPROVER',
        label: 'KT Thanh toán duyệt (>50M)',
        config: { approverType: 'ROLE', role: 'ACCOUNTANT_AR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ca_b',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt (>50M)',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo_b',
        type: 'APPROVER',
        label: 'COO duyệt (>50M)',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_50m' },
      {
        sourceKey: 'cond_50m',
        targetKey: 'approver_ar_a',
        condition: 'amount <= 50000000',
        label: 'Có (≤50M)',
      },
      { sourceKey: 'approver_ar_a', targetKey: 'approver_coo_a' },
      { sourceKey: 'approver_coo_a', targetKey: 'end' },
      {
        sourceKey: 'cond_50m',
        targetKey: 'approver_ar_b',
        condition: 'amount > 50000000',
        label: 'Không (>50M)',
      },
      { sourceKey: 'approver_ar_b', targetKey: 'approver_ca_b' },
      { sourceKey: 'approver_ca_b', targetKey: 'approver_coo_b' },
      { sourceKey: 'approver_coo_b', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 3. ORDER_CANCEL — 3 tiers based on cancel stage
  // ─────────────────────────────────────────────────────────
  {
    slug: 'order-cancel-standard',
    name: 'Standard Order Cancel Approval',
    nameVi: 'Phê duyệt hủy đơn tiêu chuẩn',
    description: '3-tier: no deposit (SL only), deposit paid (SL+SD), after dispatch (SD+COO)',
    descriptionVi: '3 cấp: chưa cọc (Leader), đã cọc (Leader+GĐ KD), đã xuất kho (GĐ KD+COO)',
    category: 'SALES',
    triggerType: 'ORDER_CANCEL',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'cond_no_deposit',
        type: 'CONDITION',
        label: 'Chưa cọc?',
        config: { expression: "cancelStage == 'NO_DEPOSIT'", label: 'Giai đoạn hủy = Chưa cọc' },
      },
      {
        key: 'approver_sl_a',
        type: 'APPROVER',
        label: 'Sales Leader duyệt (chưa cọc)',
        config: { approverType: 'ROLE', role: 'SALES_LEADER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'cond_deposit_paid',
        type: 'CONDITION',
        label: 'Đã cọc?',
        config: {
          expression: "cancelStage == 'DEPOSIT_PAID'",
          label: 'Giai đoạn hủy = Đã cọc',
        },
      },
      {
        key: 'approver_sl_b',
        type: 'APPROVER',
        label: 'Sales Leader duyệt (đã cọc)',
        config: { approverType: 'ROLE', role: 'SALES_LEADER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_sd_b',
        type: 'APPROVER',
        label: 'GĐ Kinh doanh duyệt (đã cọc)',
        config: { approverType: 'ROLE', role: 'SALES_DIRECTOR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_sd_c',
        type: 'APPROVER',
        label: 'GĐ Kinh doanh duyệt (sau xuất kho)',
        config: { approverType: 'ROLE', role: 'SALES_DIRECTOR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo_c',
        type: 'APPROVER',
        label: 'COO duyệt (sau xuất kho)',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_no_deposit' },
      {
        sourceKey: 'cond_no_deposit',
        targetKey: 'approver_sl_a',
        condition: "cancelStage == 'NO_DEPOSIT'",
        label: 'Chưa cọc',
      },
      { sourceKey: 'approver_sl_a', targetKey: 'end' },
      {
        sourceKey: 'cond_no_deposit',
        targetKey: 'cond_deposit_paid',
        condition: "cancelStage != 'NO_DEPOSIT'",
        label: 'Đã có cọc/hàng',
      },
      {
        sourceKey: 'cond_deposit_paid',
        targetKey: 'approver_sl_b',
        condition: "cancelStage == 'DEPOSIT_PAID'",
        label: 'Đã cọc',
      },
      { sourceKey: 'approver_sl_b', targetKey: 'approver_sd_b' },
      { sourceKey: 'approver_sd_b', targetKey: 'end' },
      {
        sourceKey: 'cond_deposit_paid',
        targetKey: 'approver_sd_c',
        condition: "cancelStage != 'DEPOSIT_PAID'",
        label: 'Sau xuất kho',
      },
      { sourceKey: 'approver_sd_c', targetKey: 'approver_coo_c' },
      { sourceKey: 'approver_coo_c', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 4. EXTRA_CHARGE_APPROVAL — 2 tiers based on amount
  // ─────────────────────────────────────────────────────────
  {
    slug: 'extra-charge-standard',
    name: 'Standard Extra Charge Approval',
    nameVi: 'Phê duyệt phụ phí phát sinh tiêu chuẩn',
    description: '2-tier: ≤5M (WH VN Manager), >5M (WH VN Manager + Chief Accountant)',
    descriptionVi: '2 cấp: ≤5 triệu (Trưởng kho VN), >5 triệu (Trưởng kho VN + KT Tổng hợp)',
    category: 'FINANCE',
    triggerType: 'EXTRA_CHARGE_APPROVAL',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'cond_5m',
        type: 'CONDITION',
        label: 'Số tiền ≤ 5 triệu?',
        config: { expression: 'amount <= 5000000', label: 'Số tiền ≤ 5.000.000 VND' },
      },
      {
        key: 'approver_wh_vn_a',
        type: 'APPROVER',
        label: 'Trưởng kho VN duyệt (≤5M)',
        config: {
          approverType: 'ROLE',
          role: 'WAREHOUSE_VN_MANAGER',
          approvalMode: 'SEQUENTIAL',
        },
      },
      {
        key: 'approver_wh_vn_b',
        type: 'APPROVER',
        label: 'Trưởng kho VN duyệt (>5M)',
        config: {
          approverType: 'ROLE',
          role: 'WAREHOUSE_VN_MANAGER',
          approvalMode: 'SEQUENTIAL',
        },
      },
      {
        key: 'approver_ca_b',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt (>5M)',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_5m' },
      {
        sourceKey: 'cond_5m',
        targetKey: 'approver_wh_vn_a',
        condition: 'amount <= 5000000',
        label: 'Có (≤5M)',
      },
      { sourceKey: 'approver_wh_vn_a', targetKey: 'end' },
      {
        sourceKey: 'cond_5m',
        targetKey: 'approver_wh_vn_b',
        condition: 'amount > 5000000',
        label: 'Không (>5M)',
      },
      { sourceKey: 'approver_wh_vn_b', targetKey: 'approver_ca_b' },
      { sourceKey: 'approver_ca_b', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 5. CREDIT_EXTENSION — CA → COO → (if >500M) CEO
  // ─────────────────────────────────────────────────────────
  {
    slug: 'credit-extension-standard',
    name: 'Standard Credit Extension Approval',
    nameVi: 'Phê duyệt gia hạn công nợ tiêu chuẩn',
    description: 'Sequential: Chief Accountant → COO → (if amount >500M) CEO',
    descriptionVi: 'Tuần tự: KT Tổng hợp → COO → (nếu >500 triệu) CEO',
    category: 'FINANCE',
    triggerType: 'CREDIT_EXTENSION',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_ca',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo',
        type: 'APPROVER',
        label: 'COO duyệt',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'cond_500m',
        type: 'CONDITION',
        label: 'Hạn mức > 500 triệu?',
        config: { expression: 'amount > 500000000', label: 'Hạn mức > 500.000.000 VND' },
      },
      {
        key: 'approver_ceo',
        type: 'APPROVER',
        label: 'CEO duyệt (>500M)',
        config: { approverType: 'ROLE', role: 'CEO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_ca' },
      { sourceKey: 'approver_ca', targetKey: 'approver_coo' },
      { sourceKey: 'approver_coo', targetKey: 'cond_500m' },
      {
        sourceKey: 'cond_500m',
        targetKey: 'approver_ceo',
        condition: 'amount > 500000000',
        label: 'Có (>500M)',
      },
      { sourceKey: 'approver_ceo', targetKey: 'end' },
      {
        sourceKey: 'cond_500m',
        targetKey: 'end',
        condition: 'amount <= 500000000',
        label: 'Không (≤500M)',
        isDefault: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 6. DEPOSIT_EXEMPTION — SD → COO
  // ─────────────────────────────────────────────────────────
  {
    slug: 'deposit-exemption-standard',
    name: 'Standard Deposit Exemption Approval',
    nameVi: 'Phê duyệt miễn/giảm cọc tiêu chuẩn',
    description: 'Sequential: Sales Director → COO',
    descriptionVi: 'Tuần tự: GĐ Kinh doanh → COO',
    category: 'SALES',
    triggerType: 'DEPOSIT_EXEMPTION',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_sd',
        type: 'APPROVER',
        label: 'GĐ Kinh doanh duyệt',
        config: { approverType: 'ROLE', role: 'SALES_DIRECTOR', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo',
        type: 'APPROVER',
        label: 'COO duyệt',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_sd' },
      { sourceKey: 'approver_sd', targetKey: 'approver_coo' },
      { sourceKey: 'approver_coo', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 7. CONTAINER_PLAN — XNK Manager → COO
  // ─────────────────────────────────────────────────────────
  {
    slug: 'container-plan-standard',
    name: 'Standard Container Plan Approval',
    nameVi: 'Phê duyệt kế hoạch container tiêu chuẩn',
    description: 'Sequential: XNK Manager → COO',
    descriptionVi: 'Tuần tự: TP XNK → COO',
    category: 'LOGISTICS',
    triggerType: 'CONTAINER_PLAN',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_xnk',
        type: 'APPROVER',
        label: 'TP XNK duyệt',
        config: { approverType: 'ROLE', role: 'XNK_MANAGER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo',
        type: 'APPROVER',
        label: 'COO duyệt',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_xnk' },
      { sourceKey: 'approver_xnk', targetKey: 'approver_coo' },
      { sourceKey: 'approver_coo', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 8. WAREHOUSE_RELEASE — WH VN Manager → Chief Accountant
  // ─────────────────────────────────────────────────────────
  {
    slug: 'warehouse-release-standard',
    name: 'Standard Warehouse Release Approval',
    nameVi: 'Phê duyệt xuất kho tiêu chuẩn',
    description: 'Sequential: Warehouse VN Manager → Chief Accountant',
    descriptionVi: 'Tuần tự: Trưởng kho VN → KT Tổng hợp',
    category: 'LOGISTICS',
    triggerType: 'WAREHOUSE_RELEASE',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_wh_vn',
        type: 'APPROVER',
        label: 'Trưởng kho VN duyệt',
        config: {
          approverType: 'ROLE',
          role: 'WAREHOUSE_VN_MANAGER',
          approvalMode: 'SEQUENTIAL',
        },
      },
      {
        key: 'approver_ca',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_wh_vn' },
      { sourceKey: 'approver_wh_vn', targetKey: 'approver_ca' },
      { sourceKey: 'approver_ca', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 9. PURCHASE_ORDER — 2 tiers based on amount
  // ─────────────────────────────────────────────────────────
  {
    slug: 'purchase-order-standard',
    name: 'Standard Purchase Order Approval',
    nameVi: 'Phê duyệt đơn mua hàng tiêu chuẩn',
    description: '2-tier: ≤20M (XNK Manager only), >20M (XNK Manager + Chief Accountant)',
    descriptionVi: '2 cấp: ≤20 triệu (TP XNK), >20 triệu (TP XNK + KT Tổng hợp)',
    category: 'LOGISTICS',
    triggerType: 'PURCHASE_ORDER',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'cond_20m',
        type: 'CONDITION',
        label: 'Số tiền ≤ 20 triệu?',
        config: { expression: 'amount <= 20000000', label: 'Số tiền ≤ 20.000.000 VND' },
      },
      {
        key: 'approver_xnk_a',
        type: 'APPROVER',
        label: 'TP XNK duyệt (≤20M)',
        config: { approverType: 'ROLE', role: 'XNK_MANAGER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_xnk_b',
        type: 'APPROVER',
        label: 'TP XNK duyệt (>20M)',
        config: { approverType: 'ROLE', role: 'XNK_MANAGER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ca_b',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt (>20M)',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'cond_20m' },
      {
        sourceKey: 'cond_20m',
        targetKey: 'approver_xnk_a',
        condition: 'amount <= 20000000',
        label: 'Có (≤20M)',
      },
      { sourceKey: 'approver_xnk_a', targetKey: 'end' },
      {
        sourceKey: 'cond_20m',
        targetKey: 'approver_xnk_b',
        condition: 'amount > 20000000',
        label: 'Không (>20M)',
      },
      { sourceKey: 'approver_xnk_b', targetKey: 'approver_ca_b' },
      { sourceKey: 'approver_ca_b', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 10. PROCUREMENT_PAYMENT — SL → CA → COO
  // ─────────────────────────────────────────────────────────
  {
    slug: 'procurement-payment-standard',
    name: 'Standard Procurement Payment Approval',
    nameVi: 'Phê duyệt chi mua hàng NCC tiêu chuẩn',
    description: 'Sequential: Sales Leader → Chief Accountant → COO',
    descriptionVi: 'Tuần tự: Sales Leader → KT Tổng hợp → COO',
    category: 'FINANCE',
    triggerType: 'PROCUREMENT_PAYMENT',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_sl',
        type: 'APPROVER',
        label: 'Sales Leader duyệt',
        config: { approverType: 'ROLE', role: 'SALES_LEADER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ca',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo',
        type: 'APPROVER',
        label: 'COO duyệt',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_sl' },
      { sourceKey: 'approver_sl', targetKey: 'approver_ca' },
      { sourceKey: 'approver_ca', targetKey: 'approver_coo' },
      { sourceKey: 'approver_coo', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 11. GRACE_PERIOD_REQUEST — CFO → CEO
  // ─────────────────────────────────────────────────────────
  {
    slug: 'grace-period-standard',
    name: 'Standard Grace Period Approval',
    nameVi: 'Phê duyệt xin ân hạn tiêu chuẩn',
    description: 'Sequential: CFO → CEO',
    descriptionVi: 'Tuần tự: CFO → CEO',
    category: 'FINANCE',
    triggerType: 'GRACE_PERIOD_REQUEST',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_cfo',
        type: 'APPROVER',
        label: 'CFO duyệt',
        config: { approverType: 'ROLE', role: 'CFO', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ceo',
        type: 'APPROVER',
        label: 'CEO duyệt',
        config: { approverType: 'ROLE', role: 'CEO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_cfo' },
      { sourceKey: 'approver_cfo', targetKey: 'approver_ceo' },
      { sourceKey: 'approver_ceo', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 12. CREDIT_OVERDRAFT — CA → COO
  // ─────────────────────────────────────────────────────────
  {
    slug: 'credit-overdraft-standard',
    name: 'Standard Credit Overdraft Approval',
    nameVi: 'Phê duyệt thấu chi tạm thời tiêu chuẩn',
    description: 'Sequential: Chief Accountant → COO',
    descriptionVi: 'Tuần tự: KT Tổng hợp → COO',
    category: 'FINANCE',
    triggerType: 'CREDIT_OVERDRAFT',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_ca',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_coo',
        type: 'APPROVER',
        label: 'COO duyệt',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_ca' },
      { sourceKey: 'approver_ca', targetKey: 'approver_coo' },
      { sourceKey: 'approver_coo', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 13. CUSTOMS_DECLARATION — XNK Manager → Chief Accountant
  // ─────────────────────────────────────────────────────────
  {
    slug: 'customs-declaration-standard',
    name: 'Standard Customs Declaration Approval',
    nameVi: 'Phê duyệt tờ khai hải quan tiêu chuẩn',
    description: 'Sequential: XNK Manager → Chief Accountant',
    descriptionVi: 'Tuần tự: TP XNK → KT Tổng hợp',
    category: 'LOGISTICS',
    triggerType: 'CUSTOMS_DECLARATION',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_xnk',
        type: 'APPROVER',
        label: 'TP XNK duyệt',
        config: { approverType: 'ROLE', role: 'XNK_MANAGER', approvalMode: 'SEQUENTIAL' },
      },
      {
        key: 'approver_ca',
        type: 'APPROVER',
        label: 'KT Tổng hợp duyệt',
        config: { approverType: 'ROLE', role: 'CHIEF_ACCOUNTANT', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_xnk' },
      { sourceKey: 'approver_xnk', targetKey: 'approver_ca' },
      { sourceKey: 'approver_ca', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 14. RETURN_REQUEST — COO only
  // ─────────────────────────────────────────────────────────
  {
    slug: 'return-request-standard',
    name: 'Standard Return Request Approval',
    nameVi: 'Phê duyệt yêu cầu trả hàng tiêu chuẩn',
    description: 'Single approver: COO',
    descriptionVi: 'Một cấp duyệt: COO',
    category: 'SALES',
    triggerType: 'RETURN_REQUEST',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_coo',
        type: 'APPROVER',
        label: 'COO duyệt',
        config: { approverType: 'ROLE', role: 'COO', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_coo' },
      { sourceKey: 'approver_coo', targetKey: 'end' },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 15. LEAVE_REQUEST — Direct Manager
  // ─────────────────────────────────────────────────────────
  {
    slug: 'leave-request-standard',
    name: 'Standard Leave Request Approval',
    nameVi: 'Phê duyệt nghỉ phép tiêu chuẩn',
    description: 'Single approver: Direct Manager (auto-resolved from User.leaderId)',
    descriptionVi: 'Một cấp duyệt: Quản lý trực tiếp (tự động theo User.leaderId)',
    category: 'HR',
    triggerType: 'LEAVE_REQUEST',
    nodes: [
      { key: 'start', type: 'START', label: 'Bắt đầu' },
      {
        key: 'approver_dm',
        type: 'APPROVER',
        label: 'Quản lý trực tiếp duyệt',
        config: { approverType: 'DIRECT_MANAGER', approvalMode: 'SEQUENTIAL' },
      },
      { key: 'end', type: 'END', label: 'Kết thúc' },
    ],
    edges: [
      { sourceKey: 'start', targetKey: 'approver_dm' },
      { sourceKey: 'approver_dm', targetKey: 'end' },
    ],
  },
];

export async function seedApprovalTemplates(prisma: PrismaClient): Promise<void> {
  console.log('  -> Seeding approval flow templates...');

  let created = 0;
  let updated = 0;

  for (const tpl of TEMPLATES) {
    const nodesJson = tpl.nodes as unknown as import('@prisma/client').Prisma.JsonArray;
    const edgesJson = tpl.edges as unknown as import('@prisma/client').Prisma.JsonArray;

    const result = await prisma.approvalFlowTemplate.upsert({
      where: { slug: tpl.slug },
      create: {
        slug: tpl.slug,
        name: tpl.name,
        nameVi: tpl.nameVi,
        description: tpl.description,
        descriptionVi: tpl.descriptionVi,
        category: tpl.category,
        triggerType: tpl.triggerType,
        nodesJson,
        edgesJson,
        isDefault: true,
      },
      update: {
        name: tpl.name,
        nameVi: tpl.nameVi,
        description: tpl.description,
        descriptionVi: tpl.descriptionVi,
        category: tpl.category,
        triggerType: tpl.triggerType,
        nodesJson,
        edgesJson,
        isDefault: true,
      },
    });

    // Prisma upsert does not expose whether it created or updated.
    // We track via a secondary select (or simply count).
    if (result) {
      // Use a lightweight check: compare createdAt ≈ now
      const diffMs = Date.now() - result.createdAt.getTime();
      if (diffMs < 5000) {
        created++;
      } else {
        updated++;
      }
    }
  }

  console.log(
    `  -> Approval templates: ${created} created, ${updated} updated (${TEMPLATES.length} total)`,
  );
}
