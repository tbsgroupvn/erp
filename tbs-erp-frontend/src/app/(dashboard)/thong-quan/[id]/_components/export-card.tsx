'use client';

import { Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ExportCardProps {
  isExportPending: boolean;
  onExportEcus5: () => void;
}

export function ExportCard({ isExportPending, onExportEcus5 }: ExportCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <Button onClick={onExportEcus5} disabled={isExportPending}>
          <Download className="mr-2 h-4 w-4" />
          {isExportPending ? 'Đang xuất...' : 'Xuất ECUS5 (Excel)'}
        </Button>
      </CardContent>
    </Card>
  );
}
