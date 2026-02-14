'use client';

import React, { useCallback } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  User,
  GitBranch,
  Eye,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { USER_ROLE_LABELS } from '@/lib/utils/constants';
import {
  ApprovalNodeType,
  ApproverType,
  ApprovalMode,
  UserRole,
} from '@/lib/types/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepItem {
  id: string;
  type: 'APPROVER' | 'CONDITION' | 'CC';
  approverType: string;
  approverRole?: string;
  approvalMode: string;
  deadlineHours?: number;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
}

export interface StepListBuilderProps {
  steps: StepItem[];
  onChange: (steps: StepItem[]) => void;
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const STEP_TYPE_OPTIONS: { value: StepItem['type']; label: string }[] = [
  { value: 'APPROVER', label: 'Nguoi duyet' },
  { value: 'CONDITION', label: 'Dieu kien' },
  { value: 'CC', label: 'Theo doi' },
];

const APPROVER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: ApproverType.ROLE, label: 'Theo chuc vu' },
  { value: ApproverType.DIRECT_MANAGER, label: 'Quan ly truc tiep' },
  { value: ApproverType.DEPARTMENT_HEAD, label: 'Truong phong' },
  { value: ApproverType.SPECIFIC_USER, label: 'Nguoi cu the' },
  { value: ApproverType.REQUESTER_MANAGER, label: 'Quan ly nguoi yeu cau' },
];

const APPROVAL_MODE_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: ApprovalMode.SEQUENTIAL, label: 'Tuan tu' },
  { value: ApprovalMode.PARALLEL_AND, label: 'Dong thoi AND' },
  { value: ApprovalMode.PARALLEL_OR, label: 'Dong thoi OR' },
];

const CONDITION_OPERATORS: { value: string; label: string }[] = [
  { value: 'GT', label: '>' },
  { value: 'GTE', label: '>=' },
  { value: 'LT', label: '<' },
  { value: 'LTE', label: '<=' },
  { value: 'EQ', label: '=' },
  { value: 'NEQ', label: '!=' },
];

const STEP_TYPE_ICON: Record<string, React.ReactNode> = {
  APPROVER: <User className="h-4 w-4" />,
  CONDITION: <GitBranch className="h-4 w-4" />,
  CC: <Eye className="h-4 w-4" />,
};

const STEP_TYPE_COLOR: Record<string, string> = {
  APPROVER: 'border-blue-200 bg-blue-50/40',
  CONDITION: 'border-yellow-200 bg-yellow-50/40',
  CC: 'border-gray-200 bg-gray-50/40',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultStep(): StepItem {
  return {
    id: Date.now().toString(),
    type: 'APPROVER',
    approverType: ApproverType.ROLE,
    approverRole: UserRole.CEO,
    approvalMode: ApprovalMode.SEQUENTIAL,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepListBuilder({ steps, onChange }: StepListBuilderProps) {
  const addStep = useCallback(() => {
    onChange([...steps, createDefaultStep()]);
  }, [steps, onChange]);

  const removeStep = useCallback(
    (index: number) => {
      onChange(steps.filter((_, i) => i !== index));
    },
    [steps, onChange],
  );

  const moveStep = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= steps.length) return;
      const updated = [...steps];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onChange(updated);
    },
    [steps, onChange],
  );

  const updateStep = useCallback(
    (index: number, patch: Partial<StepItem>) => {
      const updated = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
      onChange(updated);
    },
    [steps, onChange],
  );

  return (
    <div className="space-y-3 p-4">
      {steps.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-sm text-muted-foreground">
          Chua co buoc nao. Bam &quot;Them buoc&quot; de bat dau.
        </div>
      )}

      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            'rounded-lg border p-4 transition-colors',
            STEP_TYPE_COLOR[step.type] ?? 'border-gray-200',
          )}
        >
          {/* Header row */}
          <div className="flex items-center gap-3 mb-3">
            {/* Step number badge */}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </span>

            {/* Icon */}
            <span className="text-muted-foreground">
              {STEP_TYPE_ICON[step.type]}
            </span>

            {/* Step type dropdown */}
            <select
              value={step.type}
              onChange={(e) => {
                const newType = e.target.value as StepItem['type'];
                const patch: Partial<StepItem> = { type: newType };
                if (newType === 'APPROVER') {
                  patch.approverType = ApproverType.ROLE;
                  patch.approverRole = UserRole.CEO;
                  patch.approvalMode = ApprovalMode.SEQUENTIAL;
                  patch.conditionField = undefined;
                  patch.conditionOperator = undefined;
                  patch.conditionValue = undefined;
                } else if (newType === 'CONDITION') {
                  patch.conditionField = '';
                  patch.conditionOperator = 'GT';
                  patch.conditionValue = '';
                  patch.approverType = '';
                  patch.approverRole = undefined;
                  patch.approvalMode = '';
                } else {
                  patch.approverType = '';
                  patch.approverRole = undefined;
                  patch.approvalMode = '';
                  patch.conditionField = undefined;
                  patch.conditionOperator = undefined;
                  patch.conditionValue = undefined;
                }
                updateStep(index, patch);
              }}
              className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {STEP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Move buttons */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index === 0}
              onClick={() => moveStep(index, 'up')}
              title="Di chuyen len"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index === steps.length - 1}
              onClick={() => moveStep(index, 'down')}
              title="Di chuyen xuong"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>

            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => removeStep(index)}
              title="Xoa buoc"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* APPROVER fields */}
          {step.type === 'APPROVER' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Approver type */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Loai nguoi duyet
                </label>
                <select
                  value={step.approverType}
                  onChange={(e) =>
                    updateStep(index, { approverType: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {APPROVER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role (only when approverType = ROLE) */}
              {step.approverType === ApproverType.ROLE && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Chuc vu
                  </label>
                  <select
                    value={step.approverRole ?? ''}
                    onChange={(e) =>
                      updateStep(index, { approverRole: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Approval mode */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Che do duyet
                </label>
                <select
                  value={step.approvalMode}
                  onChange={(e) =>
                    updateStep(index, { approvalMode: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {APPROVAL_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Deadline hours */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Han xu ly (gio)
                </label>
                <input
                  type="number"
                  min={0}
                  value={step.deadlineHours ?? ''}
                  onChange={(e) =>
                    updateStep(index, {
                      deadlineHours: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="Tuy chon"
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* CONDITION fields */}
          {step.type === 'CONDITION' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Truong
                </label>
                <input
                  type="text"
                  value={step.conditionField ?? ''}
                  onChange={(e) =>
                    updateStep(index, { conditionField: e.target.value })
                  }
                  placeholder="VD: amount"
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Toan tu
                </label>
                <select
                  value={step.conditionOperator ?? 'GT'}
                  onChange={(e) =>
                    updateStep(index, { conditionOperator: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CONDITION_OPERATORS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Gia tri
                </label>
                <input
                  type="text"
                  value={step.conditionValue ?? ''}
                  onChange={(e) =>
                    updateStep(index, { conditionValue: e.target.value })
                  }
                  placeholder="VD: 10000000"
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* CC: no extra fields needed */}
          {step.type === 'CC' && (
            <p className="text-xs text-muted-foreground">
              Buoc theo doi — nguoi duoc CC se nhan thong bao.
            </p>
          )}
        </div>
      ))}

      {/* Add step button */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-dashed"
        onClick={addStep}
      >
        <Plus className="h-4 w-4" />
        Them buoc
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion helpers — steps ↔ nodes + edges for API
// ---------------------------------------------------------------------------

/** Convert StepItem[] to API nodes + edges payload */
export function stepsToNodesAndEdges(steps: StepItem[]) {
  const Y_SPACING = 150;
  const X_CENTER = 300;

  // START node
  const startNodeKey = '__start__';
  const endNodeKey = '__end__';

  const nodes: Array<{
    nodeKey: string;
    nodeType: string;
    label?: string;
    approverType?: string;
    approverRole?: string;
    approvalMode?: string;
    deadlineHours?: number;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: string;
    positionX: number;
    positionY: number;
  }> = [];

  const edges: Array<{
    sourceNodeKey: string;
    targetNodeKey: string;
    label?: string;
    conditionExpression?: string;
    sortOrder: number;
  }> = [];

  // 1. START
  nodes.push({
    nodeKey: startNodeKey,
    nodeType: ApprovalNodeType.START,
    label: 'Bat dau',
    positionX: X_CENTER,
    positionY: 0,
  });

  // 2. Step nodes
  steps.forEach((step, i) => {
    const nodeKey = step.id;
    nodes.push({
      nodeKey,
      nodeType: step.type,
      label:
        step.type === 'APPROVER'
          ? 'Nguoi duyet'
          : step.type === 'CONDITION'
            ? 'Dieu kien'
            : 'Theo doi',
      approverType: step.type === 'APPROVER' ? step.approverType : undefined,
      approverRole: step.type === 'APPROVER' ? step.approverRole : undefined,
      approvalMode: step.type === 'APPROVER' ? step.approvalMode : undefined,
      deadlineHours: step.type === 'APPROVER' ? step.deadlineHours : undefined,
      conditionField:
        step.type === 'CONDITION' ? step.conditionField : undefined,
      conditionOperator:
        step.type === 'CONDITION' ? step.conditionOperator : undefined,
      conditionValue:
        step.type === 'CONDITION' ? step.conditionValue : undefined,
      positionX: X_CENTER,
      positionY: (i + 1) * Y_SPACING,
    });
  });

  // 3. END
  nodes.push({
    nodeKey: endNodeKey,
    nodeType: ApprovalNodeType.END,
    label: 'Ket thuc',
    positionX: X_CENTER,
    positionY: (steps.length + 1) * Y_SPACING,
  });

  // 4. Edges: START → step1 → step2 → ... → END
  const orderedKeys = [startNodeKey, ...steps.map((s) => s.id), endNodeKey];
  for (let i = 0; i < orderedKeys.length - 1; i++) {
    edges.push({
      sourceNodeKey: orderedKeys[i],
      targetNodeKey: orderedKeys[i + 1],
      sortOrder: i,
    });
  }

  return { nodes, edges };
}

/** Convert API nodes to StepItem[] (ignores START/END, sorts by positionY or edge order) */
export function nodesToSteps(
  apiNodes: Array<{
    nodeKey: string;
    nodeType: string;
    approverType?: string | null;
    approverRole?: string | null;
    approvalMode?: string | null;
    deadlineHours?: number | null;
    conditionField?: string | null;
    conditionOperator?: string | null;
    conditionValue?: string | null;
    positionX?: number | null;
    positionY?: number | null;
  }>,
  apiEdges?: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    sortOrder?: number;
  }>,
): StepItem[] {
  // Filter out START and END nodes
  const stepNodes = apiNodes.filter(
    (n) =>
      n.nodeType !== ApprovalNodeType.START &&
      n.nodeType !== ApprovalNodeType.END,
  );

  // Try to order by edges if available
  if (apiEdges && apiEdges.length > 0) {
    // Build adjacency: source → target
    const nextMap = new Map<string, string>();
    for (const e of apiEdges) {
      nextMap.set(e.sourceNodeId, e.targetNodeId);
    }

    // Find the first step node by traversing from START or any node without incoming
    const stepKeySet = new Set(stepNodes.map((n) => n.nodeKey));
    const targetSet = new Set(apiEdges.map((e) => e.targetNodeId));

    // Find START node
    const startNode = apiNodes.find(
      (n) => n.nodeType === ApprovalNodeType.START,
    );
    let currentKey = startNode
      ? nextMap.get(startNode.nodeKey)
      : undefined;

    // If we can't find via START, find the step node that's not a target of another step node
    if (!currentKey || !stepKeySet.has(currentKey)) {
      for (const n of stepNodes) {
        if (!targetSet.has(n.nodeKey)) {
          currentKey = n.nodeKey;
          break;
        }
      }
    }

    if (currentKey) {
      const ordered: typeof stepNodes = [];
      const visited = new Set<string>();
      while (currentKey && stepKeySet.has(currentKey) && !visited.has(currentKey)) {
        visited.add(currentKey);
        const node = stepNodes.find((n) => n.nodeKey === currentKey);
        if (node) ordered.push(node);
        currentKey = nextMap.get(currentKey);
      }
      // Add any remaining nodes not reached via edges
      for (const n of stepNodes) {
        if (!visited.has(n.nodeKey)) ordered.push(n);
      }
      return ordered.map(toStepItem);
    }
  }

  // Fallback: sort by positionY
  const sorted = [...stepNodes].sort(
    (a, b) => (a.positionY ?? 0) - (b.positionY ?? 0),
  );
  return sorted.map(toStepItem);
}

function toStepItem(n: {
  nodeKey: string;
  nodeType: string;
  approverType?: string | null;
  approverRole?: string | null;
  approvalMode?: string | null;
  deadlineHours?: number | null;
  conditionField?: string | null;
  conditionOperator?: string | null;
  conditionValue?: string | null;
}): StepItem {
  return {
    id: n.nodeKey,
    type: n.nodeType as StepItem['type'],
    approverType: n.approverType ?? ApproverType.ROLE,
    approverRole: n.approverRole ?? undefined,
    approvalMode: n.approvalMode ?? ApprovalMode.SEQUENTIAL,
    deadlineHours: n.deadlineHours ?? undefined,
    conditionField: n.conditionField ?? undefined,
    conditionOperator: n.conditionOperator ?? undefined,
    conditionValue: n.conditionValue ?? undefined,
  };
}
