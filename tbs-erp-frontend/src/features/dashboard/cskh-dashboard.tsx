'use client';

import { AlertCircle, CheckCircle, Clock, ThumbsUp } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { useComplaintStatistics, useComplaints } from '@/lib/hooks/use-complaints';
import { ComplaintStatus } from '@/lib/types/enums';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';

export function CSKHDashboard() {
  const { data: stats, isLoading: statsLoading } = useComplaintStatistics();
  const { data: recentComplaints, isLoading: complaintsLoading } = useComplaints({
    limit: 5,
  });

  const typedStats = stats as {
    total?: number;
    open?: number;
    investigating?: number;
    resolved?: number;
    satisfactionRate?: number;
  } | null;

  const complaints = recentComplaints?.data as Array<{
    id: string;
    code?: string;
    customerName?: string;
    subject?: string;
    status: string;
    severity?: string;
    createdAt: string;
  }> | undefined;

  const COMPLAINT_STATUS_LABELS: Record<string, string> = {
    OPEN: 'Mới',
    INVESTIGATING: 'Đang điều tra',
    PENDING_RESOLUTION: 'Chờ xử lý',
    RESOLVED: 'Đã giải quyết',
    CLOSED: 'Đóng',
  };

  const COMPLAINT_STATUS_COLORS: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-700',
    INVESTIGATING: 'bg-yellow-100 text-yellow-700',
    PENDING_RESOLUTION: 'bg-orange-100 text-orange-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-700',
  };

  const SEVERITY_COLORS: Record<string, string> = {
    LOW: 'text-blue-600',
    MEDIUM: 'text-yellow-600',
    HIGH: 'text-orange-600',
    CRITICAL: 'text-red-600',
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Khiếu nại mới"
          value={typedStats?.open ?? 0}
          icon={AlertCircle}
          description="Chưa được xử lý"
          variant="blue"
          className={typedStats?.open ? 'border-red-200' : ''}
          href="/khieu-nai"
        />
        <StatCard
          title="Đang xử lý"
          value={typedStats?.investigating ?? 0}
          icon={Clock}
          description="Đang điều tra"
          variant="emerald"
          href="/khieu-nai"
        />
        <StatCard
          title="Đã giải quyết"
          value={typedStats?.resolved ?? 0}
          icon={CheckCircle}
          variant="amber"
          href="/khieu-nai"
        />
        <StatCard
          title="Tỉ lệ hài lòng"
          value={
            typedStats?.satisfactionRate != null
              ? `${typedStats.satisfactionRate}%`
              : '---'
          }
          icon={ThumbsUp}
          variant="rose"
          href="/khieu-nai"
        />
      </div>

      {/* Recent Complaints Table */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="text-sm font-semibold text-foreground/80">Khiếu nại gần đây</span>
          <Link href="/khieu-nai" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <div className="px-6 pb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Mã</th>
                <th className="pb-2 font-medium">Khách hàng</th>
                <th className="pb-2 font-medium">Nội dung</th>
                <th className="pb-2 font-medium">Mức độ</th>
                <th className="pb-2 font-medium">Trạng thái</th>
                <th className="pb-2 font-medium">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {complaintsLoading || statsLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Đang tải...
                  </td>
                </tr>
              ) : !complaints || complaints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Không có khiếu nại nào
                  </td>
                </tr>
              ) : (
                complaints.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/khieu-nai/${c.id}`} className="text-primary hover:underline">
                        {c.code || c.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{c.customerName || '---'}</td>
                    <td className="py-3 pr-4 max-w-[200px] truncate">
                      {c.subject || '---'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={SEVERITY_COLORS[c.severity || ''] || ''}>
                        {c.severity || '---'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          COMPLAINT_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {COMPLAINT_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="py-3">{formatDate(c.createdAt, 'dd/MM/yyyy')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
