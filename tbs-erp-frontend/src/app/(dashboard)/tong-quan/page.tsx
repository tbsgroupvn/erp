'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/lib/types';
import { getDashboardType } from '@/lib/utils/permissions';
import { PageHeader } from '@/components/shared/page-header';
import {
  BodDashboard,
  SalesDashboard,
  FinanceDashboard,
  WarehouseDashboard,
  HRDashboard,
  CSKHDashboard,
} from '@/features/dashboard';

export default function TongQuanPage() {
  const user = useAuthStore((s) => s.user);
  const role = (user?.role as UserRole) || UserRole.SALE;
  const dashboardType = getDashboardType(role);

  const renderDashboard = () => {
    switch (dashboardType) {
      case 'executive':
        return <BodDashboard />;
      case 'sales':
        return <SalesDashboard />;
      case 'finance':
        return <FinanceDashboard />;
      case 'warehouse':
      case 'operations':
      case 'logistics':
        return <WarehouseDashboard />;
      case 'hr':
        return <HRDashboard />;
      case 'cskh':
        return <CSKHDashboard />;
      default:
        return <SalesDashboard />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description={`Xin chào, ${user?.fullName || 'Người dùng'}`}
      />
      {renderDashboard()}
    </div>
  );
}
