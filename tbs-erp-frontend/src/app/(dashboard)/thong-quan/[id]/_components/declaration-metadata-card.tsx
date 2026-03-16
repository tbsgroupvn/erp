'use client';

import { Ship, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils/format';
import type { CustomsDeclaration } from '@/lib/types/customs.types';

interface DeclarationMetadataCardProps {
  declaration: CustomsDeclaration;
  isEditable: boolean;
  isExpanded: boolean;
  editingHeader: boolean;
  headerForm: Record<string, string>;
  isSavePending: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onHeaderFormChange: (field: string, value: string) => void;
}

export function DeclarationMetadataCard({
  declaration,
  isEditable,
  isExpanded,
  editingHeader,
  headerForm,
  isSavePending,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSave,
  onHeaderFormChange,
}: DeclarationMetadataCardProps) {
  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={onToggleExpand}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ship className="h-5 w-5" />
          Thông tin tờ khai
          {isExpanded ? (
            <ChevronDown className="ml-auto h-4 w-4" />
          ) : (
            <ChevronRight className="ml-auto h-4 w-4" />
          )}
          {isEditable && !editingHeader && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {editingHeader ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-medium leading-none">Cơ quan hải quan</p>
                  <Input
                    value={headerForm.customsOfficeCode}
                    onChange={(e) => onHeaderFormChange('customsOfficeCode', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">MST nhập khẩu</p>
                  <Input
                    value={headerForm.importerTaxCode}
                    onChange={(e) => onHeaderFormChange('importerTaxCode', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Tên nhập khẩu</p>
                  <Input
                    value={headerForm.importerName}
                    onChange={(e) => onHeaderFormChange('importerName', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-medium leading-none">Địa chỉ nhập khẩu</p>
                  <Input
                    value={headerForm.importerAddress}
                    onChange={(e) => onHeaderFormChange('importerAddress', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Phương thức vận chuyển</p>
                  <Input
                    value={headerForm.shippingMethod}
                    onChange={(e) => onHeaderFormChange('shippingMethod', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Số BL/AWB</p>
                  <Input
                    value={headerForm.blAwbNumber}
                    onChange={(e) => onHeaderFormChange('blAwbNumber', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-medium leading-none">Cảng xếp hàng</p>
                  <Input
                    value={headerForm.portOfLoading}
                    onChange={(e) => onHeaderFormChange('portOfLoading', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Cảng dỡ hàng</p>
                  <Input
                    value={headerForm.portOfDischarge}
                    onChange={(e) => onHeaderFormChange('portOfDischarge', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Tên tàu</p>
                  <Input
                    value={headerForm.vesselName}
                    onChange={(e) => onHeaderFormChange('vesselName', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-medium leading-none">Đồng tiền khai báo</p>
                  <Input
                    value={headerForm.declaredCurrency}
                    onChange={(e) => onHeaderFormChange('declaredCurrency', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Cước vận chuyển</p>
                  <Input
                    type="number"
                    value={headerForm.declaredFreight}
                    onChange={(e) => onHeaderFormChange('declaredFreight', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Phí bảo hiểm</p>
                  <Input
                    type="number"
                    value={headerForm.declaredInsurance}
                    onChange={(e) => onHeaderFormChange('declaredInsurance', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={onSave} disabled={isSavePending} size="sm">
                  {isSavePending ? 'Đang lưu...' : 'Lưu'}
                </Button>
                <Button variant="outline" size="sm" onClick={onCancelEdit}>
                  Hủy
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <dt className="text-muted-foreground">Cơ quan HQ</dt>
              <dd>{declaration.customsOfficeCode || '---'}</dd>

              <dt className="text-muted-foreground">MST nhập khẩu</dt>
              <dd>{declaration.importerTaxCode}</dd>

              <dt className="text-muted-foreground">Tên nhập khẩu</dt>
              <dd>{declaration.importerName}</dd>

              <dt className="text-muted-foreground">Địa chỉ</dt>
              <dd>{declaration.importerAddress || '---'}</dd>

              <dt className="text-muted-foreground">PTVT</dt>
              <dd>{declaration.shippingMethod || '---'}</dd>

              <dt className="text-muted-foreground">Số BL/AWB</dt>
              <dd>{declaration.blAwbNumber || '---'}</dd>

              <dt className="text-muted-foreground">Cảng xếp</dt>
              <dd>{declaration.portOfLoading || '---'}</dd>

              <dt className="text-muted-foreground">Cảng dỡ</dt>
              <dd>{declaration.portOfDischarge || '---'}</dd>

              <dt className="text-muted-foreground">Tên tàu</dt>
              <dd>{declaration.vesselName || '---'}</dd>

              <dt className="text-muted-foreground">Tiền tệ</dt>
              <dd>{declaration.declaredCurrency}</dd>

              <dt className="text-muted-foreground">Cước VC</dt>
              <dd>{formatCurrency(declaration.declaredFreight)}</dd>

              <dt className="text-muted-foreground">Bảo hiểm</dt>
              <dd>{formatCurrency(declaration.declaredInsurance)}</dd>

              {declaration.ecusDeclarationNumber && (
                <>
                  <dt className="text-muted-foreground">Số ECUS</dt>
                  <dd className="font-medium">{declaration.ecusDeclarationNumber}</dd>
                </>
              )}

              {declaration.exchangeRateUsed && (
                <>
                  <dt className="text-muted-foreground">Tỷ giá</dt>
                  <dd>{declaration.exchangeRateUsed.toLocaleString()}</dd>
                </>
              )}
            </dl>
          )}
        </CardContent>
      )}
    </Card>
  );
}
