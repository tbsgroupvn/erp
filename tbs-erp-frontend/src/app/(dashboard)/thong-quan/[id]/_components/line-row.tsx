'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, Pencil, Check, X, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HSCodeSearchPopover } from './hs-code-search-popover';
import type { CustomsDeclarationLine, HSCodeResult } from '@/lib/types/customs.types';

export interface LineRowProps {
  line: CustomsDeclarationLine;
  isExpanded: boolean;
  isEditing: boolean;
  isEditable: boolean;
  isSelected: boolean;
  editingData: Partial<CustomsDeclarationLine>;
  hsPopoverLineId: string | null;
  CompIcon: typeof CheckCircle;
  compClass: string;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditDataChange: (
    fn: (prev: Partial<CustomsDeclarationLine>) => Partial<CustomsDeclarationLine>,
  ) => void;
  onHsPopoverOpen: () => void;
  onHsPopoverClose: () => void;
  onHSCodeSelect: (hs: HSCodeResult) => void;
  onRemove: () => void;
  isRemovePending: boolean;
  isSavePending: boolean;
}

export function LineRow({
  line,
  isExpanded,
  isEditing,
  isEditable,
  isSelected,
  editingData,
  hsPopoverLineId,
  CompIcon,
  compClass,
  onToggleExpand,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditDataChange,
  onHsPopoverOpen,
  onHsPopoverClose,
  onHSCodeSelect,
  onRemove,
  isRemovePending,
  isSavePending,
}: LineRowProps) {
  const colSpanBase = isEditable ? 16 : 14;

  return (
    <>
      <tr className="border-b hover:bg-muted/30 transition-colors">
        {isEditable && (
          <td className="px-2 py-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-gray-300"
            />
          </td>
        )}
        <td className="px-3 py-2">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-sm font-medium"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {line.lineNumber}
          </button>
        </td>
        <td className="px-3 py-2 relative">
          {isEditing ? (
            <div className="relative">
              <Input
                value={editingData.declaredHsCode ?? ''}
                onChange={(e) =>
                  onEditDataChange((p) => ({ ...p, declaredHsCode: e.target.value }))
                }
                onFocus={onHsPopoverOpen}
                className="h-7 w-28 text-xs"
              />
              {hsPopoverLineId === line.id && (
                <HSCodeSearchPopover onSelect={onHSCodeSelect} onClose={onHsPopoverClose} />
              )}
            </div>
          ) : (
            <span className="font-mono text-xs">{line.declaredHsCode}</span>
          )}
        </td>
        <td className="px-3 py-2 max-w-[200px]">
          {isEditing ? (
            <Input
              value={editingData.declaredDescription ?? ''}
              onChange={(e) =>
                onEditDataChange((p) => ({ ...p, declaredDescription: e.target.value }))
              }
              className="h-7 text-xs"
            />
          ) : (
            <span className="truncate block text-xs">{line.declaredDescription}</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {isEditing ? (
            <Input
              type="number"
              value={editingData.declaredQuantity ?? ''}
              onChange={(e) =>
                onEditDataChange((p) => ({
                  ...p,
                  declaredQuantity: parseFloat(e.target.value) || 0,
                }))
              }
              className="h-7 w-20 text-xs text-right"
            />
          ) : (
            <span className="text-xs">{line.declaredQuantity}</span>
          )}
        </td>
        <td className="px-3 py-2">
          {isEditing ? (
            <Input
              value={editingData.declaredUnit ?? ''}
              onChange={(e) =>
                onEditDataChange((p) => ({ ...p, declaredUnit: e.target.value }))
              }
              className="h-7 w-16 text-xs"
            />
          ) : (
            <span className="text-xs">{line.declaredUnit}</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {isEditing ? (
            <Input
              type="number"
              value={editingData.declaredUnitPrice ?? ''}
              onChange={(e) =>
                onEditDataChange((p) => ({
                  ...p,
                  declaredUnitPrice: parseFloat(e.target.value) || 0,
                }))
              }
              className="h-7 w-24 text-xs text-right"
            />
          ) : (
            <span className="text-xs">{line.declaredUnitPrice.toLocaleString()}</span>
          )}
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium">
          {line.declaredTotalValue.toLocaleString()}
        </td>
        <td className="px-3 py-2">
          {isEditing ? (
            <Input
              value={editingData.declaredCountryOrigin ?? ''}
              onChange={(e) =>
                onEditDataChange((p) => ({ ...p, declaredCountryOrigin: e.target.value }))
              }
              className="h-7 w-16 text-xs"
            />
          ) : (
            <span className="text-xs">{line.declaredCountryOrigin}</span>
          )}
        </td>
        <td className="px-3 py-2 text-right text-xs">{line.importDutyRate}%</td>
        <td className="px-3 py-2 text-right text-xs">{line.importDutyAmount.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs">{line.vatRate}%</td>
        <td className="px-3 py-2 text-right text-xs">{line.vatAmount.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs font-medium">
          {line.lineTotalTax.toLocaleString()}
        </td>
        <td className="px-3 py-2 text-center">
          <CompIcon className={`h-4 w-4 inline ${compClass}`} />
          {line.requiresPermit && (
            <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] text-purple-700">
              {line.permitType ?? 'Giấy phép'}
            </span>
          )}
        </td>
        {isEditable && (
          <td className="px-3 py-2 text-center">
            {isEditing ? (
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSaveEdit}
                  disabled={isSavePending}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1">
                <Button variant="ghost" size="sm" onClick={onStartEdit}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  disabled={isRemovePending}
                >
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            )}
          </td>
        )}
      </tr>

      {/* Expanded row — internal data */}
      {isExpanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={colSpanBase} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Mô tả nội bộ: </span>
                <span className="font-medium">{line.internalDescription}</span>
              </div>
              <div>
                <span className="text-muted-foreground">SL nội bộ: </span>
                <span className="font-medium">{line.internalQuantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Đơn giá nội bộ: </span>
                <span className="font-medium">{line.internalUnitPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tổng nội bộ: </span>
                <span className="font-medium">{line.internalTotalValue.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">TL ròng: </span>
                <span className="font-medium">{line.declaredNetWeight ?? '---'} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">TL cả bì: </span>
                <span className="font-medium">{line.declaredGrossWeight ?? '---'} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Thuế TTĐB: </span>
                <span className="font-medium">
                  {line.specialTaxRate}% ({line.specialTaxAmount.toLocaleString()})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Thuế MT + CBPG: </span>
                <span className="font-medium">
                  {line.environmentalTax.toLocaleString()} +{' '}
                  {line.antiDumpingDuty.toLocaleString()}
                </span>
              </div>
              {line.sourceItems && line.sourceItems.length > 0 && (
                <div className="col-span-full mt-2">
                  <span className="text-muted-foreground">Nguồn: </span>
                  {line.sourceItems.map((src, i) => (
                    <span key={src.id} className="mr-3">
                      <Link
                        href={`/don-hang/${src.orderId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {src.orderId}
                      </Link>{' '}
                      (SL: {src.contributedQuantity}, GT: {src.contributedValue.toLocaleString()})
                      {i < line.sourceItems!.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
