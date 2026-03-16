'use client';

import { useState, type ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOKRTree } from '@/lib/hooks/use-okr';
import type { Objective, ObjectiveChild, OKRPeriod, OKRLevel, OKRStatus } from '@/lib/types/okr.types';
import {
  OKR_LEVEL_LABELS,
  OKR_STATUS_LABELS,
  OKR_PERIOD_LABELS,
} from '@/lib/types/okr.types';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Building2,
  User,
  Target,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TreeNode = (Objective | ObjectiveChild) & { progress?: number };

const levelIndent: Record<OKRLevel, string> = {
  COMPANY: 'ml-0',
  DEPARTMENT: 'ml-6',
  INDIVIDUAL: 'ml-12',
};

const levelIcon: Record<OKRLevel, ComponentType<{ className?: string }>> = {
  COMPANY: Globe,
  DEPARTMENT: Building2,
  INDIVIDUAL: User,
};

const levelBadgeClass: Record<OKRLevel, string> = {
  COMPANY: 'bg-purple-100 text-purple-700',
  DEPARTMENT: 'bg-blue-100 text-blue-700',
  INDIVIDUAL: 'bg-teal-100 text-teal-700',
};

const statusDotClass: Record<OKRStatus, string> = {
  DRAFT: 'bg-gray-400',
  ACTIVE: 'bg-green-500',
  COMPLETED: 'bg-blue-500',
  CANCELLED: 'bg-red-400',
};

function ProgressBubble({ progress }: { progress: number }) {
  const color =
    progress >= 70 ? 'bg-green-500' : progress >= 40 ? 'bg-yellow-500' : progress > 0 ? 'bg-red-500' : 'bg-gray-300';
  return (
    <div
      className={cn(
        'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
        color,
      )}
    >
      {progress}%
    </div>
  );
}

interface TreeNodeRowProps {
  node: TreeNode;
  level: OKRLevel;
  depth?: number;
}

function TreeNodeRow({ node, level, depth = 0 }: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const children = (node as TreeNode & { children?: TreeNode[] }).children;
  const hasChildren = children && children.length > 0;
  const progress = node.progress ?? 0;
  const status = node.status as OKRStatus;
  const LevelIcon = levelIcon[level];

  return (
    <div className={cn('', depth > 0 && 'border-l-2 border-gray-100 ml-4 pl-4')}>
      <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group">
        {/* Expand toggle */}
        <div className="w-5 shrink-0">
          {hasChildren ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
              )}
            </Button>
          ) : null}
        </div>

        {/* Level icon */}
        <LevelIcon className="h-4 w-4 text-gray-400 shrink-0" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                statusDotClass[status] || 'bg-gray-400',
              )}
            />
            <p className="text-sm font-medium text-gray-800 truncate">{node.title}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className={cn('text-xs py-0', levelBadgeClass[level])}>
              {OKR_LEVEL_LABELS[level]}
            </Badge>
            <span className="text-xs text-gray-400">
              {OKR_STATUS_LABELS[status]}
            </span>
            {(node as TreeNode & { department?: string }).department && (
              <span className="text-xs text-gray-400 truncate">
                · {(node as TreeNode & { department?: string }).department}
              </span>
            )}
          </div>
        </div>

        {/* Progress bubble */}
        <ProgressBubble progress={progress} />

        {/* KR count */}
        {(node as TreeNode & { keyResults?: unknown[] }).keyResults && (
          <span className="text-xs text-gray-400 shrink-0">
            {(node as TreeNode & { keyResults: unknown[] }).keyResults.length} KR
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-1">
          {children!.map((child) => {
            const childLevel: OKRLevel =
              level === 'COMPANY' ? 'DEPARTMENT' : 'INDIVIDUAL';
            return (
              <TreeNodeRow
                key={child.id}
                node={child as TreeNode}
                level={childLevel}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const PERIODS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tat ca chu ky' },
  { value: 'Q1', label: OKR_PERIOD_LABELS.Q1 },
  { value: 'Q2', label: OKR_PERIOD_LABELS.Q2 },
  { value: 'Q3', label: OKR_PERIOD_LABELS.Q3 },
  { value: 'Q4', label: OKR_PERIOD_LABELS.Q4 },
  { value: 'ANNUAL', label: OKR_PERIOD_LABELS.ANNUAL },
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

export function OKRTree() {
  const [period, setPeriod] = useState<OKRPeriod | undefined>(undefined);
  const [year, setYear] = useState<number>(currentYear);

  const { data: tree = [], isLoading } = useOKRTree(period, year);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={period ?? 'ALL'}
          onValueChange={(v) => setPeriod(v === 'ALL' ? undefined : (v as OKRPeriod))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                Nam {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tree */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div>
                <Skeleton className="h-4 w-48 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chua co OKR cap cong ty trong ky nay</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((node) => (
            <TreeNodeRow key={node.id} node={node as TreeNode} level="COMPANY" depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
