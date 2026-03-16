'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Clock, CalendarDays, LogIn, LogOut, Plus, X, MapPin } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useMyAttendance,
  useAttendanceSummary,
  useCheckIn,
  useCheckOut,
  useMyLeaveRequests,
  useLeaveBalance,
  useCreateLeaveRequest,
  useCancelLeaveRequest,
} from '@/lib/hooks/use-attendance';
import { GpsCheckIn } from '@/features/attendance/gps-checkin';
import { AttendanceMap } from '@/features/attendance/attendance-map';
import { LeaveType, LeaveStatus } from '@/lib/types/enums';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Users, AlertCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { AttendanceRecord, LeaveRequest } from '@/lib/api/attendance.api';

const NghiPhepTabContent = dynamic(
  () => import('./_components/nghi-phep-tab').then((m) => ({ default: m.NghiPhepTab })),
  { ssr: false, loading: () => <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div> },
);

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'attendance', label: 'Chấm công', icon: Clock },
  { key: 'leave', label: 'Nghỉ phép cá nhân', icon: CalendarDays },
  { key: 'gps', label: 'Chấm công GPS', icon: MapPin },
  { key: 'nghi-phep', label: 'Quản lý nghỉ phép', icon: CalendarDays },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const ATTENDANCE_STATUS_MAP: Record<string, { label: string; colorClass: string }> = {
  PRESENT: { label: 'Có mặt', colorClass: 'bg-green-100 text-green-700' },
  ABSENT: { label: 'Vắng', colorClass: 'bg-red-100 text-red-700' },
  LATE: { label: 'Đi muộn', colorClass: 'bg-yellow-100 text-yellow-700' },
  LEAVE: { label: 'Nghỉ phép', colorClass: 'bg-blue-100 text-blue-700' },
  HOLIDAY: { label: 'Nghỉ lễ', colorClass: 'bg-purple-100 text-purple-700' },
};

const LEAVE_STATUS_COLOR: Record<LeaveStatus, string> = {
  [LeaveStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
  [LeaveStatus.APPROVED]: 'bg-green-100 text-green-700',
  [LeaveStatus.REJECTED]: 'bg-red-100 text-red-700',
  [LeaveStatus.CANCELLED]: 'bg-gray-100 text-gray-700',
};

const attendanceColumns: ColumnDef<AttendanceRecord>[] = [
  {
    accessorKey: 'date',
    header: 'Ngày',
    cell: ({ row }) => formatDate(row.original.date),
  },
  {
    accessorKey: 'checkIn',
    header: 'Giờ vào',
    cell: ({ row }) => row.original.checkIn ?? '—',
  },
  {
    accessorKey: 'checkOut',
    header: 'Giờ ra',
    cell: ({ row }) => row.original.checkOut ?? '—',
  },
  {
    accessorKey: 'workHours',
    header: 'Số giờ',
    cell: ({ row }) => `${Number(row.original.workHours).toFixed(1)}h`,
  },
  {
    accessorKey: 'overtimeHours',
    header: 'Tăng ca',
    cell: ({ row }) =>
      row.original.overtimeHours > 0 ? `${Number(row.original.overtimeHours).toFixed(1)}h` : '—',
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const s = ATTENDANCE_STATUS_MAP[row.original.status];
      return s ? <StatusBadge label={s.label} colorClass={s.colorClass} /> : row.original.status;
    },
  },
  {
    accessorKey: 'note',
    header: 'Ghi chú',
    cell: ({ row }) => row.original.note ?? '—',
  },
];

const leaveColumns: ColumnDef<LeaveRequest>[] = [
  {
    accessorKey: 'leaveType',
    header: 'Loại nghỉ',
    cell: ({ row }) => LEAVE_TYPE_LABELS[row.original.leaveType] ?? row.original.leaveType,
  },
  {
    accessorKey: 'startDate',
    header: 'Từ ngày',
    cell: ({ row }) => formatDate(row.original.startDate),
  },
  {
    accessorKey: 'endDate',
    header: 'Đến ngày',
    cell: ({ row }) => formatDate(row.original.endDate),
  },
  {
    accessorKey: 'days',
    header: 'Số ngày',
  },
  {
    accessorKey: 'reason',
    header: 'Lý do',
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <StatusBadge
        label={LEAVE_STATUS_LABELS[row.original.status] ?? row.original.status}
        colorClass={LEAVE_STATUS_COLOR[row.original.status] ?? 'bg-gray-100 text-gray-700'}
      />
    ),
  },
  {
    id: 'actions',
    header: 'Thao tác',
    cell: function ActionCell({ row }) {
      const cancel = useCancelLeaveRequest();
      if (row.original.status !== LeaveStatus.PENDING) return null;
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cancel.mutate(row.original.id)}
          disabled={cancel.isPending}
        >
          <X className="h-4 w-4 mr-1" />
          Hủy
        </Button>
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Page inner (uses useSearchParams)
// ---------------------------------------------------------------------------

function ChamCongPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') ?? 'attendance') as TabKey;

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'attendance') params.delete('tab');
    else params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  const [attPage, setAttPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  // Attendance data
  const { data: myAttendance, isLoading: attLoading } = useMyAttendance({ page: attPage, limit: 20 });
  const { data: summary } = useAttendanceSummary();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  // Leave data
  const { data: myLeaves, isLoading: leaveLoading } = useMyLeaveRequests({ page: leavePage, limit: 20 });
  const { data: leaveBalance } = useLeaveBalance();
  const createLeave = useCreateLeaveRequest();

  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'ANNUAL' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  });

  const handleCreateLeave = () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) return;
    createLeave.mutate(leaveForm, {
      onSuccess: () => {
        setShowLeaveForm(false);
        setLeaveForm({ leaveType: LeaveType.ANNUAL, startDate: '', endDate: '', reason: '' });
      },
    });
  };

  return (
    <div>
      <PageHeader title="Chấm công" description="Quản lý chấm công và nghỉ phép" infoKey="cham-cong">
        <div className="flex gap-2">
          {activeTab === 'attendance' && (
            <>
              <Button onClick={() => checkIn.mutate(undefined)} disabled={checkIn.isPending}>
                <LogIn className="mr-2 h-4 w-4" />
                {checkIn.isPending ? 'Đang xử lý...' : 'Chấm vào'}
              </Button>
              <Button variant="outline" onClick={() => checkOut.mutate(undefined)} disabled={checkOut.isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                {checkOut.isPending ? 'Đang xử lý...' : 'Chấm ra'}
              </Button>
            </>
          )}
          {activeTab === 'leave' && (
            <Button onClick={() => setShowLeaveForm((p) => !p)}>
              {showLeaveForm ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Đóng
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Xin nghỉ phép
                </>
              )}
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="inline-block mr-2 h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Có mặt hôm nay"
                value={summary.presentToday}
                icon={Users}
                description={`/${summary.totalEmployees} nhân viên`}
              />
              <StatCard
                title="Vắng mặt"
                value={summary.absentToday}
                icon={AlertCircle}
                description="Nhân viên vắng hôm nay"
              />
              <StatCard
                title="Đi muộn"
                value={summary.lateToday}
                icon={Clock}
                description="Nhân viên đi muộn hôm nay"
              />
              <StatCard
                title="Nghỉ phép"
                value={summary.onLeaveToday}
                icon={CalendarDays}
                description="Nhân viên nghỉ hôm nay"
              />
            </div>
          )}

          <DataTable
            columns={attendanceColumns}
            data={myAttendance?.data ?? []}
            pageCount={myAttendance?.meta?.totalPages}
            page={attPage}
            onPageChange={setAttPage}
            isLoading={attLoading}
          />
        </div>
      )}

      {/* GPS Tab */}
      {activeTab === 'gps' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GpsCheckIn />
            <AttendanceMap />
          </div>
        </div>
      )}

      {/* Personal Leave Tab */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          {leaveBalance && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Phép năm</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {leaveBalance.annualUsed}/{leaveBalance.annual}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Còn lại: {leaveBalance.annual - leaveBalance.annualUsed} ngày
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Nghỉ ốm</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {leaveBalance.sickUsed}/{leaveBalance.sick}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Còn lại: {leaveBalance.sick - leaveBalance.sickUsed} ngày
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Việc riêng</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {leaveBalance.personalUsed}/{leaveBalance.personal}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Còn lại: {leaveBalance.personal - leaveBalance.personalUsed} ngày
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {showLeaveForm && (
            <Card>
              <CardHeader>
                <CardTitle>Tạo đơn xin nghỉ phép</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium leading-none">Loại nghỉ *</p>
                    <select
                      value={leaveForm.leaveType}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({ ...prev, leaveType: e.target.value as LeaveType }))
                      }
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div />
                  <div className="space-y-2">
                    <p className="text-sm font-medium leading-none">Từ ngày *</p>
                    <Input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium leading-none">Đến ngày *</p>
                    <Input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-medium leading-none">Lý do *</p>
                    <Input
                      placeholder="Nhập lý do xin nghỉ"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleCreateLeave}
                    disabled={createLeave.isPending || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason}
                  >
                    {createLeave.isPending ? 'Đang gửi...' : 'Gửi đơn'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowLeaveForm(false)}>
                    Hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <DataTable
            columns={leaveColumns}
            data={myLeaves?.data ?? []}
            pageCount={myLeaves?.meta?.totalPages}
            page={leavePage}
            onPageChange={setLeavePage}
            isLoading={leaveLoading}
          />
        </div>
      )}

      {/* Manager Leave Overview Tab */}
      {activeTab === 'nghi-phep' && (
        <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>}>
          <NghiPhepTabContent />
        </Suspense>
      )}
    </div>
  );
}

export default function ChamCongPage() {
  return (
    <Suspense>
      <ChamCongPageInner />
    </Suspense>
  );
}
