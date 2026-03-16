'use client';

import { Users, UserPlus, UserMinus } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { useHRStats } from '@/lib/hooks/use-dashboard';

export function HRDashboard() {
  const { data: hr, isLoading } = useHRStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Tổng nhân viên"
          value={hr?.totalEmployees ?? 0}
          icon={Users}
          variant="blue"
          href="/nhan-su"
        />
        <StatCard
          title="Nhân viên mới"
          value={hr?.newHires ?? 0}
          icon={UserPlus}
          description="Trong kỳ"
          variant="emerald"
          href="/nhan-su"
        />
        <StatCard
          title="Nghỉ việc"
          value={hr?.resigned ?? 0}
          icon={UserMinus}
          description="Trong kỳ"
          variant="rose"
          href="/nhan-su"
        />
      </div>

      {/* Department Headcount Table */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="text-sm font-semibold text-foreground/80">Số lượng nhân viên theo phòng ban</span>
        </div>
        <div className="px-6 pb-4">
          {hr?.byDepartment && hr.byDepartment.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Phòng ban</th>
                  <th className="pb-2 font-medium text-right">Số lượng nhân viên</th>
                </tr>
              </thead>
              <tbody>
                {hr.byDepartment.map((dept) => (
                  <tr key={dept.department} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5">{dept.department}</td>
                    <td className="py-2.5 text-right font-medium">{dept.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu phòng ban</p>
          )}
        </div>
      </div>
    </div>
  );
}
