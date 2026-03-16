'use client';

import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { OKRDashboard } from '@/features/okr/okr-dashboard';
import { OKRTree } from '@/features/okr/okr-tree';
import { ObjectiveCard } from '@/features/okr/objective-card';
import { ObjectiveForm } from '@/features/okr/objective-form';
import {
  useObjectives,
  useMyOKRs,
  useDeleteObjective,
} from '@/lib/hooks/use-okr';
import type { Objective, OKRPeriod, OKRLevel, OKRStatus } from '@/lib/types/okr.types';
import {
  OKR_PERIOD_LABELS,
  OKR_LEVEL_LABELS,
  OKR_STATUS_LABELS,
} from '@/lib/types/okr.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

const PERIODS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tat ca chu ky' },
  ...(['Q1', 'Q2', 'Q3', 'Q4', 'ANNUAL'] as OKRPeriod[]).map((p) => ({
    value: p,
    label: OKR_PERIOD_LABELS[p],
  })),
];

const LEVELS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tat ca cap do' },
  ...(['COMPANY', 'DEPARTMENT', 'INDIVIDUAL'] as OKRLevel[]).map((l) => ({
    value: l,
    label: OKR_LEVEL_LABELS[l],
  })),
];

const STATUSES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tat ca trang thai' },
  ...(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as OKRStatus[]).map((s) => ({
    value: s,
    label: OKR_STATUS_LABELS[s],
  })),
];

// ---------------------------------------------------------------------------
// "Cua toi" tab
// ---------------------------------------------------------------------------
function MyOKRsTab() {
  const [period, setPeriod] = useState<OKRPeriod | undefined>(undefined);
  const [year, setYear] = useState<number>(currentYear);
  const [formOpen, setFormOpen] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: objectives = [], isLoading } = useMyOKRs(period, year);
  const deleteObjective = useDeleteObjective();

  const handleEdit = (obj: Objective) => {
    setEditingObj(obj);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => setDeleteId(id);

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteObjective.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
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

        <Badge variant="outline" className="text-sm">
          {objectives.length} muc tieu
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : objectives.length === 0 ? (
        <div className="text-center py-16">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chua co muc tieu nao</p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditingObj(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Tao muc tieu dau tien
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {objectives.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ObjectiveForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingObj(null);
        }}
        editingObjective={editingObj}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xac nhan xoa muc tieu</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tac nay se xoa mem muc tieu va khong the hoan tac. Ban co chac chac muon xoa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={confirmDelete}
            >
              Xoa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// "Cong ty" tab - all objectives
// ---------------------------------------------------------------------------
function AllOKRsTab() {
  const [period, setPeriod] = useState<OKRPeriod | undefined>(undefined);
  const [year, setYear] = useState<number>(currentYear);
  const [level, setLevel] = useState<OKRLevel | undefined>(undefined);
  const [status, setStatus] = useState<OKRStatus | undefined>(undefined);

  const { data: objectives = [], isLoading } = useObjectives({
    period,
    year,
    level,
    status,
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
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

        <Select
          value={level ?? 'ALL'}
          onValueChange={(v) => setLevel(v === 'ALL' ? undefined : (v as OKRLevel))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status ?? 'ALL'}
          onValueChange={(v) => setStatus(v === 'ALL' ? undefined : (v as OKRStatus))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline">{objectives.length} muc tieu</Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : objectives.length === 0 ? (
        <div className="text-center py-16">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Khong co muc tieu nao phu hop voi bo loc</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {objectives.map((obj) => (
            <ObjectiveCard key={obj.id} objective={obj} />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function OKRPage() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="OKR / Muc tieu"
        description="Quan ly muc tieu va ket qua then chot toan to chuc"
        infoKey="okr"
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tao muc tieu
        </Button>
      </PageHeader>

      <Tabs defaultValue="dashboard">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="my">Cua toi</TabsTrigger>
          <TabsTrigger value="company">Cong ty</TabsTrigger>
          <TabsTrigger value="tree">Cay OKR</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <OKRDashboard />
        </TabsContent>

        <TabsContent value="my" className="mt-6">
          <MyOKRsTab />
        </TabsContent>

        <TabsContent value="company" className="mt-6">
          <AllOKRsTab />
        </TabsContent>

        <TabsContent value="tree" className="mt-6">
          <OKRTree />
        </TabsContent>
      </Tabs>

      <ObjectiveForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
