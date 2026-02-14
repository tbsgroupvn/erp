'use client';

import { Users, UserPlus, UserMinus, Clock, CalendarCheck, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHRStats } from '@/lib/hooks/use-dashboard';

export function HRDashboard() {
  const { data, isLoading } = useHRStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  const departmentHeadcount = data?.departmentHeadcount ?? [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Tổng nhân viên"
          value={data?.totalEmployees ?? 0}
          icon={Users}
          description="Tổng số nhân viên trong hệ thống"
        />
        <StatCard
          title="Đang làm việc"
          value={data?.activeEmployees ?? 0}
          icon={Users}
          description="Nhân viên đang hoạt động"
        />
        <StatCard
          title="Nhân viên mới tháng này"
          value={data?.newEmployeesThisMonth ?? 0}
          icon={UserPlus}
          description="Nhân viên mới tuyển dụng"
        />
        <StatCard
          title="Nghỉ việc tháng này"
          value={data?.resignedThisMonth ?? 0}
          icon={UserMinus}
          description="Nhân viên đã nghỉ việc"
        />
        <StatCard
          title="Tỉ lệ chấm công"
          value={`${((data?.attendanceRate ?? 0) * 100).toFixed(1)}%`}
          icon={CalendarCheck}
          description="Tỉ lệ chấm công trung bình"
        />
        <StatCard
          title="Nghỉ phép chờ duyệt"
          value={data?.pendingLeaveRequests ?? 0}
          icon={AlertCircle}
          description="Đơn xin nghỉ phép cần xử lý"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Giờ làm trung bình
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.averageWorkingHours?.toFixed(1) ?? '0.0'} giờ/ngày</p>
            <p className="text-xs text-muted-foreground mt-1">Trung bình theo tháng</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Giờ tăng ca tháng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.overtimeHoursThisMonth?.toFixed(1) ?? '0.0'} giờ</p>
            <p className="text-xs text-muted-foreground mt-1">Tổng giờ làm thêm</p>
          </CardContent>
        </Card>
      </div>

      {/* Department Headcount Table */}
      <Card>
        <CardHeader>
          <CardTitle>Số lượng nhân viên theo phòng ban</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentHeadcount.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Phòng ban</th>
                  <th className="pb-2 font-medium text-right">Số lượng nhân viên</th>
                </tr>
              </thead>
              <tbody>
                {departmentHeadcount.map((dept) => (
                  <tr key={dept.department} className="border-b last:border-0">
                    <td className="py-2.5">{dept.department}</td>
                    <td className="py-2.5 text-right font-medium">{dept.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu phòng ban</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
