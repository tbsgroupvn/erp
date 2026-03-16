'use client';

import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatCurrency, formatPercent } from '@/lib/utils/format';
import type { CustomsDeclaration, CustomsTaxAllocation } from '@/lib/types/customs.types';

interface TaxAllocationCardProps {
  declaration: CustomsDeclaration;
  allocations: CustomsTaxAllocation[];
  allocationMethod: string;
  isAllocatePending: boolean;
  onAllocate: () => void;
  onAllocationMethodChange: (method: string) => void;
}

export function TaxAllocationCard({
  declaration,
  allocations,
  allocationMethod,
  isAllocatePending,
  onAllocate,
  onAllocationMethodChange,
}: TaxAllocationCardProps) {
  const shouldShow = declaration.status === 'CLEARED' || declaration.taxAllocated;
  if (!shouldShow) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          Phân bổ thuế
          {declaration.taxAllocated && (
            <StatusBadge
              label="Đã phân bổ"
              colorClass="bg-green-100 text-green-700"
              className="ml-2"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!declaration.taxAllocated ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="allocationMethod" className="text-sm whitespace-nowrap">
                Phương pháp:
              </Label>
              <select
                id="allocationMethod"
                value={allocationMethod}
                onChange={(e) => onAllocationMethodChange(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="BY_VALUE">Theo giá trị</option>
                <option value="BY_WEIGHT">Theo trọng lượng</option>
              </select>
            </div>
            <Button onClick={onAllocate} disabled={isAllocatePending} size="sm">
              {isAllocatePending ? 'Đang phân bổ...' : 'Phân bổ'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                    Đơn hàng
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">
                    Tỷ lệ %
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">
                    Thuế NK
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">VAT</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">
                    Thuế TTĐB
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">
                    Thuế khác
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => (
                  <tr key={alloc.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/don-hang/${alloc.orderId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {alloc.orderId}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(alloc.proportion * 100)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(alloc.importDuty)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(alloc.vat)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(alloc.specialTax)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(alloc.otherTax)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(alloc.totalAllocated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {declaration.taxAllocatedAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Phân bổ lúc: {formatDate(declaration.taxAllocatedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
