'use client';

import dynamic from 'next/dynamic';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/lib/types';
import { getDashboardType } from '@/lib/utils/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/loading-skeleton';
import { ErrorBoundary } from '@/components/shared/error-boundary';

// Code-split heavy dashboard components (each imports recharts / chart libs)
const BodDashboard = dynamic(
  () => import('@/features/dashboard/bod-dashboard').then((m) => ({ default: m.BodDashboard })),
  { loading: () => <PageSkeleton /> },
);
const SalesDashboard = dynamic(
  () => import('@/features/dashboard/sales-dashboard').then((m) => ({ default: m.SalesDashboard })),
  { loading: () => <PageSkeleton /> },
);
const FinanceDashboard = dynamic(
  () => import('@/features/dashboard/finance-dashboard').then((m) => ({ default: m.FinanceDashboard })),
  { loading: () => <PageSkeleton /> },
);
const WarehouseDashboard = dynamic(
  () => import('@/features/dashboard/warehouse-dashboard').then((m) => ({ default: m.WarehouseDashboard })),
  { loading: () => <PageSkeleton /> },
);
const HRDashboard = dynamic(
  () => import('@/features/dashboard/hr-dashboard').then((m) => ({ default: m.HRDashboard })),
  { loading: () => <PageSkeleton /> },
);
const CSKHDashboard = dynamic(
  () => import('@/features/dashboard/cskh-dashboard').then((m) => ({ default: m.CSKHDashboard })),
  { loading: () => <PageSkeleton /> },
);

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
      <ErrorBoundary>
        {renderDashboard()}
      </ErrorBoundary>
    </div>
  );
}
