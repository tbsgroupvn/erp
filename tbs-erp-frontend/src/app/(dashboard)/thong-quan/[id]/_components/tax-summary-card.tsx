'use client';

import { DollarSign, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format';
import type { CustomsDeclaration } from '@/lib/types/customs.types';

interface TaxSummaryCardProps {
  declaration: CustomsDeclaration;
  isRecalculatePending: boolean;
  onRecalculate: () => void;
}

export function TaxSummaryCard({
  declaration,
  isRecalculatePending,
  onRecalculate,
}: TaxSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5" />
          Tổng hợp thuế
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Thuế nhập khẩu</p>
            <p className="text-lg font-bold">{formatCurrency(declaration.totalImportDuty)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">VAT</p>
            <p className="text-lg font-bold">{formatCurrency(declaration.totalVat)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Thuế TTĐB</p>
            <p className="text-lg font-bold">{formatCurrency(declaration.totalSpecialTax)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Thuế BVMT</p>
            <p className="text-lg font-bold">
              {formatCurrency(declaration.totalEnvironmentalTax)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Thuế CBPG</p>
            <p className="text-lg font-bold">
              {formatCurrency(declaration.totalAntiDumpingDuty)}
            </p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <p className="text-xs font-medium text-primary">Tổng phải nộp</p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(declaration.totalPayable)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 border-t pt-4">
          <div className="flex-1">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Giá trị khai báo: </span>
                <span className="font-medium">
                  {formatCurrency(declaration.declaredTotalValue, declaration.declaredCurrency)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Giá trị nội bộ: </span>
                <span className="font-medium">
                  {formatCurrency(declaration.internalTotalValue)}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRecalculate}
            disabled={isRecalculatePending}
          >
            <Calculator className="mr-1 h-3 w-3" />
            {isRecalculatePending ? 'Đang tính...' : 'Tính lại thuế'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
