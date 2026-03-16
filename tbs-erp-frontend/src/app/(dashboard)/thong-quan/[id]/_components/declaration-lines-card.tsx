'use client';

import { Layers, Shield, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineRow } from './line-row';
import type {
  CustomsDeclaration,
  CustomsDeclarationLine,
  ComplianceStatus,
  HSCodeResult,
} from '@/lib/types/customs.types';

const COMPLIANCE_ICONS: Record<
  ComplianceStatus,
  { icon: typeof CheckCircle; className: string }
> = {
  CLEAR: { icon: CheckCircle, className: 'text-green-600' },
  WARNING: { icon: AlertTriangle, className: 'text-yellow-600' },
  BLOCKED: { icon: XCircle, className: 'text-red-600' },
};

interface DeclarationLinesCardProps {
  declaration: CustomsDeclaration;
  isEditable: boolean;
  lines: CustomsDeclarationLine[];
  selectedLineIds: Set<string>;
  expandedLines: Set<string>;
  editingLineId: string | null;
  editingLineData: Partial<CustomsDeclarationLine>;
  hsPopoverLineId: string | null;
  isGroupByHsPending: boolean;
  isGroupCustomPending: boolean;
  isCheckCompliancePending: boolean;
  isRemoveLinePending: boolean;
  isUpdateLinePending: boolean;
  onGroupByHs: () => void;
  onGroupSelected: () => void;
  onCheckCompliance: () => void;
  onToggleAllSelect: () => void;
  onToggleLineExpand: (lineId: string) => void;
  onToggleLineSelect: (lineId: string) => void;
  onStartEditLine: (line: CustomsDeclarationLine) => void;
  onCancelEditLine: () => void;
  onSaveEditLine: () => void;
  onEditDataChange: (
    fn: (prev: Partial<CustomsDeclarationLine>) => Partial<CustomsDeclarationLine>,
  ) => void;
  onHsPopoverOpen: (lineId: string) => void;
  onHsPopoverClose: () => void;
  onHSCodeSelect: (hs: HSCodeResult) => void;
  onRemoveLine: (lineId: string) => void;
  onUngroupLine: (lineId: string) => void;
}

export function DeclarationLinesCard({
  declaration,
  isEditable,
  lines,
  selectedLineIds,
  expandedLines,
  editingLineId,
  editingLineData,
  hsPopoverLineId,
  isGroupByHsPending,
  isGroupCustomPending,
  isCheckCompliancePending,
  isRemoveLinePending,
  isUpdateLinePending,
  onGroupByHs,
  onGroupSelected,
  onCheckCompliance,
  onToggleAllSelect,
  onToggleLineExpand,
  onToggleLineSelect,
  onStartEditLine,
  onCancelEditLine,
  onSaveEditLine,
  onEditDataChange,
  onHsPopoverOpen,
  onHsPopoverClose,
  onHSCodeSelect,
  onRemoveLine,
  onUngroupLine: _onUngroupLine,
}: DeclarationLinesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5" />
          Các dòng hàng ({lines.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Toolbar */}
        {isEditable && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onGroupByHs}
              disabled={isGroupByHsPending}
            >
              <Layers className="mr-1 h-3 w-3" />
              Gom theo HS
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGroupSelected}
              disabled={selectedLineIds.size < 2 || isGroupCustomPending}
            >
              <Layers className="mr-1 h-3 w-3" />
              Gom đã chọn ({selectedLineIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCheckCompliance}
              disabled={isCheckCompliancePending}
            >
              <Shield className="mr-1 h-3 w-3" />
              Kiểm tra tuân thủ
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {isEditable && (
                  <th className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selectedLineIds.size === lines.length && lines.length > 0}
                      onChange={onToggleAllSelect}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  #
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Mã HS
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Mô tả
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  SL
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  ĐVT
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Đơn giá
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Thành tiền
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Xuất xứ
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Thuế NK %
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Thuế NK
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  VAT %
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  VAT
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Tổng thuế
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                  TT
                </th>
                {isEditable && (
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={isEditable ? 16 : 14}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Chưa có dòng hàng nào
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const isExpanded = expandedLines.has(line.id);
                  const isEditing = editingLineId === line.id;
                  const compInfo = COMPLIANCE_ICONS[line.complianceStatus];
                  const CompIcon = compInfo.icon;

                  return (
                    <LineRow
                      key={line.id}
                      line={line}
                      isExpanded={isExpanded}
                      isEditing={isEditing}
                      isEditable={isEditable}
                      isSelected={selectedLineIds.has(line.id)}
                      editingData={editingLineData}
                      hsPopoverLineId={hsPopoverLineId}
                      CompIcon={CompIcon}
                      compClass={compInfo.className}
                      onToggleExpand={() => onToggleLineExpand(line.id)}
                      onToggleSelect={() => onToggleLineSelect(line.id)}
                      onStartEdit={() => onStartEditLine(line)}
                      onCancelEdit={onCancelEditLine}
                      onSaveEdit={onSaveEditLine}
                      onEditDataChange={onEditDataChange}
                      onHsPopoverOpen={() => onHsPopoverOpen(line.id)}
                      onHsPopoverClose={onHsPopoverClose}
                      onHSCodeSelect={onHSCodeSelect}
                      onRemove={() => onRemoveLine(line.id)}
                      isRemovePending={isRemoveLinePending}
                      isSavePending={isUpdateLinePending}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
