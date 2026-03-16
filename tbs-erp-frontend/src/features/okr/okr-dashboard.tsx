'use client';

import type { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOKRDashboard } from '@/lib/hooks/use-okr';
import { KR_STATUS_LABELS } from '@/lib/types/okr.types';
import { Target, TrendingUp, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  iconClass?: string;
}

function StatCard({ title, value, description, icon: Icon, iconClass }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
          </div>
          <div className={cn('p-2.5 rounded-lg', iconClass || 'bg-blue-50')}>
            <Icon className={cn('h-5 w-5', iconClass ? 'text-white' : 'text-blue-600')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function OKRDashboard() {
  const { data, isLoading } = useOKRDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Muc tieu cua toi"
          value={data.myObjectivesCount}
          description="Trong nam nay"
          icon={Target}
          iconClass="bg-blue-50"
        />
        <StatCard
          title="Tien do trung binh"
          value={`${data.myAvgProgress}%`}
          description="Tat ca muc tieu cua toi"
          icon={TrendingUp}
          iconClass="bg-green-50"
        />
        <StatCard
          title="KR co rui ro"
          value={data.atRiskCount}
          description="Can chu y xu ly"
          icon={AlertTriangle}
          iconClass="bg-yellow-50"
        />
        <StatCard
          title="Hoan thanh"
          value={data.completedCount}
          description="Muc tieu da dat"
          icon={CheckCircle2}
          iconClass="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-risk KRs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Ket qua can chu y ({data.atRiskKeyResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.atRiskKeyResults.length === 0 ? (
              <p className="text-sm text-gray-500 px-6 pb-4">Khong co KR nao can chu y</p>
            ) : (
              <div className="divide-y">
                {data.atRiskKeyResults.slice(0, 5).map((kr) => {
                  const pct =
                    kr.targetValue > 0
                      ? Math.round((kr.currentValue / kr.targetValue) * 100)
                      : 0;
                  return (
                    <div key={kr.id} className="px-6 py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{kr.title}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs shrink-0',
                            kr.status === 'BEHIND'
                              ? 'text-red-600 border-red-200'
                              : 'text-yellow-600 border-yellow-200',
                          )}
                        >
                          {KR_STATUS_LABELS[kr.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">{kr.objective.title}</p>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={pct}
                          color={kr.status === 'BEHIND' ? 'bg-red-500' : 'bg-yellow-500'}
                        />
                        <span className="text-xs font-medium text-gray-600 w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top performers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Hieu suat cao nhat
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 px-6 pb-4">Chua co du lieu</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nhan vien</TableHead>
                    <TableHead className="text-xs">Vai tro</TableHead>
                    <TableHead className="text-xs text-right">Tien do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topPerformers.map((performer, index) => (
                    <TableRow key={performer.ownerId}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 w-4">
                            {index + 1}.
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {performer.user?.fullName || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">{performer.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="text-xs">
                          {performer.user?.role?.replace('_', ' ') || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ProgressBar
                            value={performer.avgProgress}
                            color={
                              performer.avgProgress >= 70
                                ? 'bg-green-500'
                                : performer.avgProgress >= 40
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }
                          />
                          <span
                            className={cn(
                              'text-sm font-bold w-12 text-right',
                              performer.avgProgress >= 70
                                ? 'text-green-600'
                                : performer.avgProgress >= 40
                                  ? 'text-yellow-600'
                                  : 'text-red-600',
                            )}
                          >
                            {performer.avgProgress}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
