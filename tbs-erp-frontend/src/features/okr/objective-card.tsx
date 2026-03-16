'use client';

import { useState, type ComponentType } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { KeyResultItem } from './key-result-item';
import type { Objective, OKRLevel, OKRStatus } from '@/lib/types/okr.types';
import {
  OKR_LEVEL_LABELS,
  OKR_STATUS_LABELS,
  OKR_PERIOD_LABELS,
} from '@/lib/types/okr.types';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Target, User, Building2, Globe } from 'lucide-react';

interface ObjectiveCardProps {
  objective: Objective;
  onEdit?: (objective: Objective) => void;
  onDelete?: (id: string) => void;
}

const levelConfig: Record<OKRLevel, { icon: ComponentType<{ className?: string }>; badgeClass: string }> = {
  COMPANY: { icon: Globe, badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  DEPARTMENT: { icon: Building2, badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  INDIVIDUAL: { icon: User, badgeClass: 'bg-teal-100 text-teal-700 border-teal-200' },
};

const statusBadgeClass: Record<OKRStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  COMPLETED: 'bg-blue-100 text-blue-700 border-blue-200',
  CANCELLED: 'bg-red-100 text-red-600 border-red-200',
};

function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const color =
    progress >= 70 ? '#22c55e' : progress >= 40 ? '#f59e0b' : progress > 0 ? '#ef4444' : '#d1d5db';

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={4} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={4}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={600}
        fill="#374151"
      >
        {progress}%
      </text>
    </svg>
  );
}

export function ObjectiveCard({ objective, onEdit, onDelete }: ObjectiveCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = levelConfig[objective.level];
  const LevelIcon = config.icon;
  const progress = objective.progress ?? 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <ProgressRing progress={progress} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant="outline" className={cn('text-xs', config.badgeClass)}>
                <LevelIcon className="h-3 w-3 mr-1" />
                {OKR_LEVEL_LABELS[objective.level]}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {OKR_PERIOD_LABELS[objective.period]} {objective.year}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', statusBadgeClass[objective.status])}>
                {OKR_STATUS_LABELS[objective.status]}
              </Badge>
            </div>

            <h3 className="font-semibold text-gray-900 leading-tight">{objective.title}</h3>

            {objective.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{objective.description}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {objective.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {objective.department}
                </span>
              )}
              {objective.parent && (
                <span className="flex items-center gap-1 truncate">
                  <Target className="h-3 w-3 shrink-0" />
                  <span className="truncate">{objective.parent.title}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onEdit(objective)}
              >
                Sua
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => onDelete(objective.id)}
              >
                Xoa
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {objective.keyResults && objective.keyResults.length > 0 && (
        <CardContent className="pt-0">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full justify-between px-2">
                <span>
                  {objective.keyResults.length} ket qua then chot
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {objective.keyResults.map((kr) => (
                <KeyResultItem
                  key={kr.id}
                  keyResult={kr}
                  objectiveId={objective.id}
                  showCheckIn={objective.status === 'ACTIVE'}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
