'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import {
  StepListBuilder,
  stepsToNodesAndEdges,
  nodesToSteps,
  type StepItem,
} from '../_components/step-list-builder';
import {
  useApprovalFlow,
  useUpdateApprovalFlow,
} from '@/lib/hooks/use-approval-flows';
import { APPROVAL_TYPE_LABELS } from '@/lib/utils/constants';
import { ApprovalType } from '@/lib/types';

const CATEGORIES = [
  { value: 'SALES', label: 'Kinh doanh' },
  { value: 'FINANCE', label: 'Tài chính' },
  { value: 'HR', label: 'Nhân sự' },
  { value: 'LOGISTICS', label: 'Vận hành' },
  { value: 'OTHER', label: 'Khác' },
] as const;

export default function ChinhSuaQuyTrinhPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: flow, isLoading } = useApprovalFlow(id);
  const updateFlow = useUpdateApprovalFlow();

  // ---------- Form state ----------
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('SALES');
  const [triggerType, setTriggerType] = useState<ApprovalType>(
    ApprovalType.DISCOUNT,
  );

  // ---------- Step list state ----------
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [initialised, setInitialised] = useState(false);

  // ---------- Populate form when data loads ----------
  useEffect(() => {
    if (flow && !initialised) {
      setName(flow.name);
      setDescription(flow.description ?? '');
      setCategory(flow.category ?? 'OTHER');
      setTriggerType((flow.triggerType as ApprovalType) ?? ApprovalType.CUSTOM);

      if (flow.nodes) {
        setSteps(
          nodesToSteps(
            flow.nodes.map((n) => ({
              nodeKey: n.nodeKey,
              nodeType: n.nodeType,
              approverType: n.approverType,
              approverRole: n.approverRole,
              approvalMode: n.approvalMode,
              deadlineHours: n.deadlineHours,
              conditionField: n.conditionField,
              conditionOperator: n.conditionOperator,
              conditionValue: n.conditionValue,
              positionX: n.positionX,
              positionY: n.positionY,
            })),
            flow.edges?.map((e) => ({
              sourceNodeId: e.sourceNodeId,
              targetNodeId: e.targetNodeId,
              sortOrder: e.sortOrder,
            })),
          ),
        );
      }

      setInitialised(true);
    }
  }, [flow, initialised]);

  // ---------- Save handler ----------
  const handleSave = () => {
    if (!name.trim()) return;

    const { nodes, edges } = stepsToNodesAndEdges(steps);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      triggerType,
      nodes,
      edges,
    };

    updateFlow.mutate(
      { id, data: payload as unknown as Record<string, unknown> },
      {
        onSuccess: () => {
          router.push('/cai-dat/quy-trinh-phe-duyet');
        },
      },
    );
  };

  // ---------- Loading ----------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => router.push('/cai-dat/quy-trinh-phe-duyet')}
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Button>
      </div>

      <PageHeader title="Chỉnh sửa quy trình" />

      {/* Form fields */}
      <div className="rounded-lg border bg-card p-6 space-y-4 max-w-3xl">
        {/* Tên quy trình */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Tên quy trình <span className="text-destructive">*</span>
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên quy trình"
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Mô tả */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Mô tả</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả quy trình (tùy chọn)"
            rows={3}
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Danh mục */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Danh mục</p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Loại kích hoạt */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Loại kích hoạt</p>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as ApprovalType)}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(APPROVAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step List Builder */}
      <div className="rounded-lg border bg-card overflow-hidden max-w-3xl">
        <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Thiết kế quy trình</h3>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || updateFlow.isPending}
            className="gap-2"
          >
            {updateFlow.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu thay đổi
          </Button>
        </div>
        <StepListBuilder steps={steps} onChange={setSteps} />
      </div>
    </div>
  );
}
