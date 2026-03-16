import { ReconciliationDashboard } from '@/features/finance/reconciliation-dashboard';
import { PageHeader } from '@/components/shared/page-header';

export default function DoiChieuPage() {
  return (
    <div>
      <PageHeader
        title="Đối chiếu ngân hàng"
        description="Kiểm tra và khớp lệnh giao dịch ngân hàng với công nợ phải thu"
        infoKey="doi-chieu-ngan-hang"
      />
      <ReconciliationDashboard />
    </div>
  );
}
