'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  LayoutTemplate,
  CheckCircle2,
  Download,
  ArrowLeft,
  GitBranch,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { approvalTemplatesApi, type ApprovalTemplate } from '@/lib/api/approval-templates.api';
import { APPROVAL_TYPE_LABELS } from '@/lib/utils/constants';
import type { ApprovalType } from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TemplateCategory = 'ALL' | 'SALES' | 'FINANCE' | 'LOGISTICS' | 'HR';

const CATEGORY_TABS: { value: TemplateCategory; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SALES', label: 'Kinh doanh' },
  { value: 'FINANCE', label: 'Tài chính' },
  { value: 'LOGISTICS', label: 'Vận hành' },
  { value: 'HR', label: 'Nhân sự' },
];

const CATEGORY_COLORS: Record<ApprovalTemplate['category'], string> = {
  SALES: 'bg-blue-100 text-blue-700',
  FINANCE: 'bg-emerald-100 text-emerald-700',
  LOGISTICS: 'bg-orange-100 text-orange-700',
  HR: 'bg-purple-100 text-purple-700',
};

const CATEGORY_LABELS: Record<ApprovalTemplate['category'], string> = {
  SALES: 'Kinh doanh',
  FINANCE: 'Tài chính',
  LOGISTICS: 'Vận hành',
  HR: 'Nhân sự',
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

const templateKeys = {
  all: ['approval-templates'] as const,
  list: () => [...templateKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count step nodes in a template (excludes START / END nodes) */
function countSteps(nodesJson: unknown): number {
  if (!Array.isArray(nodesJson)) return 0;
  return (nodesJson as Array<{ nodeType?: string }>).filter(
    (n) => n.nodeType !== 'START' && n.nodeType !== 'END',
  ).length;
}

/** Resolve human-readable trigger label from the constants map, fall back to raw value */
function resolveTriggerLabel(triggerType: string): string {
  return (
    APPROVAL_TYPE_LABELS[triggerType as ApprovalType] ?? triggerType
  );
}

// ---------------------------------------------------------------------------
// TemplateCard
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: ApprovalTemplate;
  isInstalling: boolean;
  onInstall: (slug: string) => void;
}

function TemplateCard({ template, isInstalling, onInstall }: TemplateCardProps) {
  const stepCount = countSteps(template.nodesJson);
  const triggerLabel = resolveTriggerLabel(template.triggerType);
  const categoryColor = CATEGORY_COLORS[template.category];
  const categoryLabel = CATEGORY_LABELS[template.category];

  return (
    <Card className="flex flex-col transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base leading-snug truncate">
                {template.nameVi || template.name}
              </CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={categoryLabel}
                  colorClass={categoryColor}
                />
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {triggerLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Installed indicator */}
          {template.isInstalled && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã cài
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        {/* Description */}
        {template.description ? (
          <CardDescription className="line-clamp-2 text-sm">
            {template.description}
          </CardDescription>
        ) : (
          <CardDescription className="text-sm italic">
            Không có mô tả.
          </CardDescription>
        )}

        {/* Step count + action */}
        <div className="mt-auto flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {stepCount > 0 ? `${stepCount} bước phê duyệt` : 'Chưa có bước'}
          </span>

          {template.isInstalled ? (
            <span className="text-xs font-medium text-green-600">
              Đã cài đặt
            </span>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={isInstalling}
              onClick={() => onInstall(template.slug)}
            >
              {isInstalling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Cài đặt
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Template grid per tab panel
// ---------------------------------------------------------------------------

interface TemplateGridProps {
  templates: ApprovalTemplate[];
  installingSlug: string | null;
  onInstall: (slug: string) => void;
}

function TemplateGrid({ templates, installingSlug, onInstall }: TemplateGridProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <LayoutTemplate className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-base font-medium">Không có mẫu nào</p>
        <p className="mt-1 text-sm">Danh mục này chưa có mẫu quy trình.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((tpl) => (
        <TemplateCard
          key={tpl.id}
          template={tpl}
          isInstalling={installingSlug === tpl.slug}
          onInstall={onInstall}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApprovalTemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TemplateCategory>('ALL');
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  // Fetch all templates once; filter client-side by tab to avoid multiple requests
  const { data: templates, isLoading } = useQuery({
    queryKey: templateKeys.list(),
    queryFn: () => approvalTemplatesApi.list(),
  });

  const installMutation = useMutation({
    mutationFn: (slug: string) => approvalTemplatesApi.install(slug),
    onMutate: (slug) => {
      setInstallingSlug(slug);
    },
    onSuccess: (_data, slug) => {
      // Optimistically mark the template as installed in the cache
      qc.setQueryData<ApprovalTemplate[]>(templateKeys.list(), (prev) =>
        prev
          ? prev.map((t) =>
              t.slug === slug ? { ...t, isInstalled: true } : t,
            )
          : prev,
      );
      toast.success('Đã cài đặt mẫu quy trình thành công');
    },
    onError: () => {
      toast.error('Không thể cài đặt mẫu quy trình');
    },
    onSettled: () => {
      setInstallingSlug(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Thư viện mẫu quy trình"
        description="Chọn và cài đặt mẫu quy trình phê duyệt có sẵn vào hệ thống"
      >
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push('./quy-trinh-phe-duyet')}
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Button>
      </PageHeader>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TemplateCategory)}
        >
          <TabsList className="mb-6">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab.value === 'ALL'
                  ? (templates?.length ?? 0)
                  : (templates?.filter((t) => t.category === tab.value).length ?? 0);
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                  {tab.label}
                  {count > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CATEGORY_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              <TemplateGrid
                templates={
                  tab.value === 'ALL'
                    ? (templates ?? [])
                    : (templates ?? []).filter((t) => t.category === tab.value)
                }
                installingSlug={installingSlug}
                onInstall={(slug) => installMutation.mutate(slug)}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Empty overall state */}
      {!isLoading && templates && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <LayoutTemplate className="h-14 w-14 mb-4 opacity-40" />
          <p className="text-lg font-medium">Chưa có mẫu quy trình nào</p>
          <p className="mt-1 text-sm">
            Liên hệ quản trị viên để thêm mẫu vào hệ thống.
          </p>
        </div>
      )}
    </div>
  );
}
