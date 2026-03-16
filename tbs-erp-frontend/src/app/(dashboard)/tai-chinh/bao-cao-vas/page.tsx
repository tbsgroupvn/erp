import { VasReportViewer } from '@/features/finance/vas-report-viewer';
import { PageHeader } from '@/components/shared/page-header';

export default function BaoCaoVasPage() {
  return (
    <div>
      <PageHeader
        title="Báo cáo tài chính VAS"
        description="Báo cáo theo chuẩn mực kế toán Việt Nam (B01, B02, B03)"
        infoKey="bao-cao-vas"
      />
      <VasReportViewer />
    </div>
  );
}
