'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Users, Building2, MapPin, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useEmployees } from '@/lib/hooks/use-employees';
import type { Employee } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENT_COLORS: Record<string, string> = {
  BAN_LANH_DAO: 'border-l-purple-500',
  KINH_DOANH: 'border-l-blue-500',
  VAN_HANH: 'border-l-green-500',
  KHO: 'border-l-yellow-500',
  TAI_CHINH: 'border-l-red-500',
  NHAN_SU: 'border-l-pink-500',
  CSKH: 'border-l-cyan-500',
  IT: 'border-l-indigo-500',
  XNK: 'border-l-orange-500',
  VAN_TAI: 'border-l-teal-500',
};

const DEPARTMENT_BADGE_COLORS: Record<string, string> = {
  BAN_LANH_DAO: 'bg-purple-100 text-purple-700',
  KINH_DOANH: 'bg-blue-100 text-blue-700',
  VAN_HANH: 'bg-green-100 text-green-700',
  KHO: 'bg-yellow-100 text-yellow-700',
  TAI_CHINH: 'bg-red-100 text-red-700',
  NHAN_SU: 'bg-pink-100 text-pink-700',
  CSKH: 'bg-cyan-100 text-cyan-700',
  IT: 'bg-indigo-100 text-indigo-700',
  XNK: 'bg-orange-100 text-orange-700',
  VAN_TAI: 'bg-teal-100 text-teal-700',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  BAN_LANH_DAO: 'Ban lãnh đạo',
  KINH_DOANH: 'Kinh doanh',
  VAN_HANH: 'Vận hành',
  KHO: 'Kho',
  TAI_CHINH: 'Tài chính',
  NHAN_SU: 'Nhân sự',
  CSKH: 'CSKH',
  IT: 'IT',
  XNK: 'XNK',
  VAN_TAI: 'Vận tải',
};

const BRANCH_LABELS: Record<string, string> = {
  HN: 'Hà Nội',
  HCM: 'Hồ Chí Minh',
};

// ─── Tree Node Types ──────────────────────────────────────────────────────────

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

// ─── Tree Builder ─────────────────────────────────────────────────────────────

function buildTree(employees: Employee[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  employees.forEach((emp) => {
    nodeMap.set(emp.id, { employee: emp, children: [] });
  });

  const roots: TreeNode[] = [];
  employees.forEach((emp) => {
    const node = nodeMap.get(emp.id)!;
    if (emp.managerId && nodeMap.has(emp.managerId)) {
      nodeMap.get(emp.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function filterTree(
  nodes: TreeNode[],
  search: string,
  department: string,
  branch: string,
): TreeNode[] {
  const searchLower = search.toLowerCase();

  function matchesNode(node: TreeNode): boolean {
    const emp = node.employee;
    const matchSearch =
      !search ||
      emp.fullName.toLowerCase().includes(searchLower) ||
      emp.code.toLowerCase().includes(searchLower) ||
      emp.positionTitle.toLowerCase().includes(searchLower);
    const matchDept = !department || department === 'all' || emp.departmentCode === department;
    const matchBranch = !branch || branch === 'all' || emp.branch === branch;
    return matchSearch && matchDept && matchBranch;
  }

  function filterNode(node: TreeNode): TreeNode | null {
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is TreeNode => n !== null);

    if (matchesNode(node) || filteredChildren.length > 0) {
      return { employee: node.employee, children: filteredChildren };
    }
    return null;
  }

  return nodes.map(filterNode).filter((n): n is TreeNode => n !== null);
}

// ─── Employee Card Component ──────────────────────────────────────────────────

interface EmployeeCardProps {
  node: TreeNode;
  depth: number;
  defaultExpanded?: boolean;
}

function EmployeeCard({ node, depth, defaultExpanded = true }: EmployeeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 2);
  const { employee, children } = node;
  const hasChildren = children.length > 0;

  const borderColor =
    DEPARTMENT_COLORS[employee.departmentCode] ?? 'border-l-gray-400';
  const deptBadge =
    DEPARTMENT_BADGE_COLORS[employee.departmentCode] ?? 'bg-gray-100 text-gray-700';
  const deptLabel =
    DEPARTMENT_LABELS[employee.departmentCode] ?? employee.departmentCode;

  return (
    <div className="relative">
      {/* Node card */}
      <div
        className={cn(
          'group relative flex items-start gap-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md border-l-4',
          borderColor,
        )}
      >
        {/* Avatar placeholder */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {employee.fullName.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{employee.fullName}</span>
            <span className="text-xs text-muted-foreground">{employee.code}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {employee.positionTitle}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', deptBadge)}>
              {deptLabel}
            </span>
            {employee.branch && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {BRANCH_LABELS[employee.branch] ?? employee.branch}
              </span>
            )}
          </div>
        </div>

        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto shrink-0 rounded p-1 hover:bg-muted transition-colors"
            aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-0.5 text-xs text-muted-foreground">
              {children.length}
            </span>
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative ml-6 mt-2 space-y-2 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-border/60">
          {children.map((child) => (
            <div key={child.employee.id} className="relative pl-5 before:absolute before:left-0 before:top-5 before:h-px before:w-4 before:bg-border/60">
              <EmployeeCard node={child} depth={depth + 1} defaultExpanded={defaultExpanded} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  employees: Employee[];
}

function SummaryCards({ employees }: SummaryCardsProps) {
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((e) => {
      counts[e.departmentCode] = (counts[e.departmentCode] ?? 0) + 1;
    });
    return counts;
  }, [employees]);

  const branchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((e) => {
      if (e.branch) counts[e.branch] = (counts[e.branch] ?? 0) + 1;
    });
    return counts;
  }, [employees]);

  const topDepts = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tổng nhân sự</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{employees.length}</div>
          <p className="text-xs text-muted-foreground">Nhân viên đang hoạt động</p>
        </CardContent>
      </Card>

      {Object.entries(branchCounts).map(([branch, count]) => (
        <Card key={branch}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {BRANCH_LABELS[branch] ?? branch}
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{count}</div>
            <p className="text-xs text-muted-foreground">Nhân viên</p>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Phòng ban</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Object.keys(deptCounts).length}</div>
          <div className="mt-2 space-y-1">
            {topDepts.map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">
                  {DEPARTMENT_LABELS[dept] ?? dept}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SoDoToChucPage() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [branch, setBranch] = useState('all');
  const [expandAll, setExpandAll] = useState(true);

  // Fetch all employees in one request for tree building
  const { data, isLoading } = useEmployees({ limit: 500, status: 'ACTIVE' } as any);
  const employees: Employee[] = data?.data ?? [];

  // Derive unique departments and branches for filter dropdowns
  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.departmentCode));
    return Array.from(depts).sort();
  }, [employees]);

  const branches = useMemo(() => {
    const bs = new Set(employees.map((e) => e.branch).filter(Boolean));
    return Array.from(bs).sort();
  }, [employees]);

  // Build tree then apply filters
  const tree = useMemo(() => buildTree(employees), [employees]);

  const filteredTree = useMemo(
    () => filterTree(tree, search, department, branch),
    [tree, search, department, branch],
  );

  const activeEmployees = useMemo(
    () =>
      employees.filter((e) => {
        const matchDept = !department || department === 'all' || e.departmentCode === department;
        const matchBranch = !branch || branch === 'all' || e.branch === branch;
        return matchDept && matchBranch;
      }),
    [employees, department, branch],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sơ đồ tổ chức"
        description="Cấu trúc tổ chức và phân cấp nhân sự"
        infoKey="so-do-to-chuc"
      >
        <button
          onClick={() => setExpandAll((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          {expandAll ? (
            <>
              <ChevronDown className="h-4 w-4" />
              Thu gọn tất cả
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4" />
              Mở rộng tất cả
            </>
          )}
        </button>
      </PageHeader>

      {/* Summary Cards */}
      <SummaryCards employees={activeEmployees} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm nhân viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tất cả phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả phòng ban</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DEPARTMENT_LABELS[d] ?? d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tất cả chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BRANCH_LABELS[b] ?? b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tree View */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Không tìm thấy nhân viên phù hợp</p>
            </div>
          ) : (
            <div className="space-y-3" key={String(expandAll)}>
              {filteredTree.map((node) => (
                <EmployeeCard
                  key={node.employee.id}
                  node={node}
                  depth={0}
                  defaultExpanded={expandAll}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
