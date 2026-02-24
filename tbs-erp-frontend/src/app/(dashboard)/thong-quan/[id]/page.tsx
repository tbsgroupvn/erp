'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileSpreadsheet,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Package,
  Ship,
  DollarSign,
  Calculator,
  Layers,
  Download,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Search,
  Clock,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCustomsDeclaration,
  useUpdateDeclarationHeader,
  useUpdateDeclarationLine,
  useRemoveDeclarationLine,
  useUpdateDeclarationStatus,
  useUpdateDeclarationChannel,
  useRecalculateTax,
  useAllocateTax,
  useExportEcus5,
  useGroupByHs,
  useGroupCustom,
  useUngroupLine,
  useSearchHSCodes,
  useCheckCompliance,
  useAcknowledgeAlert,
} from '@/lib/hooks/use-customs-declaration';
import { formatDate, formatCurrency, formatPercent } from '@/lib/utils/format';
import type {
  CustomsDeclarationStatus,
  CustomsChannel,
  ComplianceStatus,
  CustomsDeclarationLine,
  HSCodeResult,
} from '@/lib/types/customs.types';

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<CustomsDeclarationStatus, string> = {
  DRAFT: 'Nháp',
  READY: 'Sẵn sàng',
  SUBMITTED: 'Đã gửi',
  CHANNEL_ASSIGNED: 'Đã phân luồng',
  INSPECTING: 'Đang kiểm',
  CLEARED: 'Đã thông quan',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const STATUS_COLORS: Record<CustomsDeclarationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  READY: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-indigo-100 text-indigo-700',
  CHANNEL_ASSIGNED: 'bg-amber-100 text-amber-700',
  INSPECTING: 'bg-orange-100 text-orange-700',
  CLEARED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const CHANNEL_LABELS: Record<CustomsChannel, string> = {
  GREEN: 'Xanh',
  YELLOW: 'Vàng',
  RED: 'Đỏ',
};

const CHANNEL_COLORS: Record<CustomsChannel, string> = {
  GREEN: 'bg-green-100 text-green-700',
  YELLOW: 'bg-yellow-100 text-yellow-700',
  RED: 'bg-red-100 text-red-700',
};

const COMPLIANCE_ICONS: Record<ComplianceStatus, { icon: typeof CheckCircle; className: string }> =
  {
    CLEAR: { icon: CheckCircle, className: 'text-green-600' },
    WARNING: { icon: AlertTriangle, className: 'text-yellow-600' },
    BLOCKED: { icon: XCircle, className: 'text-red-600' },
  };

// Valid status transitions
const STATUS_TRANSITIONS: Partial<Record<CustomsDeclarationStatus, CustomsDeclarationStatus[]>> = {
  DRAFT: ['READY', 'CANCELLED'],
  READY: ['SUBMITTED', 'DRAFT', 'CANCELLED'],
  SUBMITTED: ['CHANNEL_ASSIGNED'],
  CHANNEL_ASSIGNED: ['INSPECTING', 'CLEARED'],
  INSPECTING: ['CLEARED', 'REJECTED'],
  REJECTED: ['DRAFT'],
};

// ---------------------------------------------------------------------------
// HS Code Search Popover
// ---------------------------------------------------------------------------

function HSCodeSearchPopover({
  onSelect,
  onClose,
}: {
  onSelect: (hs: HSCodeResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useSearchHSCodes(query);

  return (
    <div className="absolute z-50 mt-1 w-[500px] rounded-lg border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nhập mã HS hoặc mô tả..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 border-0 focus-visible:ring-0"
          autoFocus
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-center text-sm text-muted-foreground">Đang tìm...</div>
        )}
        {!isLoading && results && results.length === 0 && query.length > 1 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Không tìm thấy kết quả
          </div>
        )}
        {results?.map((hs) => {
          const CompIcon = hs.isProhibited
            ? XCircle
            : hs.isRestricted
              ? AlertTriangle
              : CheckCircle;
          const compClass = hs.isProhibited
            ? 'text-red-600'
            : hs.isRestricted
              ? 'text-yellow-600'
              : 'text-green-600';

          return (
            <button
              key={hs.id}
              onClick={() => onSelect(hs)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
            >
              <CompIcon className={`h-4 w-4 shrink-0 ${compClass}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{hs.code}</div>
                <div className="truncate text-muted-foreground text-xs">{hs.descriptionVi}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <div>Thuế NK: {hs.importDutyRate}%</div>
                <div>VAT: {hs.vatRate}%</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CustomsDeclarationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { data: declaration, isLoading } = useCustomsDeclaration(params.id);

  // Mutations
  const updateHeader = useUpdateDeclarationHeader();
  const updateLine = useUpdateDeclarationLine();
  const removeLine = useRemoveDeclarationLine();
  const updateStatus = useUpdateDeclarationStatus();
  const updateChannel = useUpdateDeclarationChannel();
  const recalculateTax = useRecalculateTax();
  const allocateTax = useAllocateTax();
  const exportEcus5 = useExportEcus5();
  const groupByHs = useGroupByHs();
  const groupCustom = useGroupCustom();
  const ungroupLine = useUngroupLine();
  const checkCompliance = useCheckCompliance();
  const acknowledgeAlert = useAcknowledgeAlert();

  // UI state
  const [metadataExpanded, setMetadataExpanded] = useState(true);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineData, setEditingLineData] = useState<Partial<CustomsDeclarationLine>>({});
  const [hsPopoverLineId, setHsPopoverLineId] = useState<string | null>(null);
  const [allocationMethod, setAllocationMethod] = useState('BY_VALUE');
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState('');

  const isEditable = declaration?.status === 'DRAFT' || declaration?.status === 'READY';
  const lines = declaration?.lines ?? [];
  const alerts = declaration?.complianceAlerts ?? [];
  const allocations = declaration?.taxAllocations ?? [];
  const history = declaration?.statusHistory ?? [];

  const availableTransitions = declaration
    ? (STATUS_TRANSITIONS[declaration.status] ?? [])
    : [];

  // Toggle a line's expanded state
  const toggleLineExpand = (lineId: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  // Toggle line selection for grouping
  const toggleLineSelect = (lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const toggleAllLineSelect = () => {
    if (selectedLineIds.size === lines.length) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(lines.map((l) => l.id)));
    }
  };

  // Start editing a line
  const startEditLine = (line: CustomsDeclarationLine) => {
    setEditingLineId(line.id);
    setEditingLineData({
      declaredHsCode: line.declaredHsCode,
      declaredDescription: line.declaredDescription,
      declaredQuantity: line.declaredQuantity,
      declaredUnit: line.declaredUnit,
      declaredUnitPrice: line.declaredUnitPrice,
      declaredCountryOrigin: line.declaredCountryOrigin,
    });
  };

  const cancelEditLine = () => {
    setEditingLineId(null);
    setEditingLineData({});
    setHsPopoverLineId(null);
  };

  const saveEditLine = () => {
    if (!editingLineId || !declaration) return;
    updateLine.mutate(
      { lineId: editingLineId, data: editingLineData, declarationId: declaration.id },
      { onSuccess: () => cancelEditLine() },
    );
  };

  // Header editing
  const startEditHeader = () => {
    if (!declaration) return;
    setEditingHeader(true);
    setHeaderForm({
      customsOfficeCode: declaration.customsOfficeCode ?? '',
      importerTaxCode: declaration.importerTaxCode ?? '',
      importerName: declaration.importerName ?? '',
      importerAddress: declaration.importerAddress ?? '',
      shippingMethod: declaration.shippingMethod ?? '',
      blAwbNumber: declaration.blAwbNumber ?? '',
      portOfLoading: declaration.portOfLoading ?? '',
      portOfDischarge: declaration.portOfDischarge ?? '',
      vesselName: declaration.vesselName ?? '',
      declaredCurrency: declaration.declaredCurrency ?? '',
      declaredFreight: String(declaration.declaredFreight ?? 0),
      declaredInsurance: String(declaration.declaredInsurance ?? 0),
    });
  };

  const saveHeader = () => {
    if (!declaration) return;
    updateHeader.mutate(
      {
        id: declaration.id,
        data: {
          ...headerForm,
          declaredFreight: parseFloat(headerForm.declaredFreight) || 0,
          declaredInsurance: parseFloat(headerForm.declaredInsurance) || 0,
        } as any,
      },
      { onSuccess: () => setEditingHeader(false) },
    );
  };

  // Handle HS code selection from popover
  const handleHSCodeSelect = (hs: HSCodeResult) => {
    setEditingLineData((prev) => ({
      ...prev,
      declaredHsCode: hs.code,
      declaredUnit: hs.unit,
      importDutyRate: hs.importDutyRate,
      vatRate: hs.vatRate,
      specialTaxRate: hs.specialTaxRate,
    }));
    setHsPopoverLineId(null);
  };

  // Handle status transition
  const handleStatusTransition = (nextStatus: CustomsDeclarationStatus) => {
    if (!declaration) return;
    updateStatus.mutate({
      id: declaration.id,
      status: nextStatus,
      note: statusNote || undefined,
    });
    setStatusNote('');
  };

  // Handle channel assignment
  const handleChannelAssign = (channel: CustomsChannel) => {
    if (!declaration) return;
    updateChannel.mutate({ id: declaration.id, channel });
  };

  // Handle group selected lines
  const handleGroupSelected = () => {
    if (!declaration || selectedLineIds.size < 2) return;
    const firstLine = lines.find((l) => selectedLineIds.has(l.id));
    if (!firstLine) return;
    groupCustom.mutate(
      {
        id: declaration.id,
        data: {
          lineIds: Array.from(selectedLineIds),
          hsCode: firstLine.declaredHsCode,
          description: firstLine.declaredDescription,
        },
      },
      { onSuccess: () => setSelectedLineIds(new Set()) },
    );
  };

  // ---- Loading state ----

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!declaration) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/thong-quan')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>
        <p className="text-muted-foreground">Không tìm thấy tờ khai.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* 1. Header                                                         */}
      {/* ================================================================== */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/thong-quan')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title={`Tờ khai ${declaration.code}`}
            description={declaration.container?.code ? `Container: ${declaration.container.code}` : undefined}
          >
            <div className="flex items-center gap-2">
              <StatusBadge
                label={STATUS_LABELS[declaration.status]}
                colorClass={STATUS_COLORS[declaration.status]}
              />
              {declaration.channel && (
                <StatusBadge
                  label={`Luồng ${CHANNEL_LABELS[declaration.channel]}`}
                  colorClass={CHANNEL_COLORS[declaration.channel]}
                />
              )}
            </div>
          </PageHeader>
        </div>
      </div>

      {/* Status transition buttons */}
      {availableTransitions.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <span className="text-sm font-medium text-muted-foreground">Chuyển trạng thái:</span>
            {availableTransitions.map((nextStatus) => (
              <Button
                key={nextStatus}
                variant={nextStatus === 'CANCELLED' || nextStatus === 'REJECTED' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => handleStatusTransition(nextStatus)}
                disabled={updateStatus.isPending}
              >
                {STATUS_LABELS[nextStatus]}
              </Button>
            ))}
            {declaration.status === 'SUBMITTED' && (
              <>
                <span className="ml-4 text-sm font-medium text-muted-foreground">Phân luồng:</span>
                {(['GREEN', 'YELLOW', 'RED'] as CustomsChannel[]).map((ch) => (
                  <Button
                    key={ch}
                    variant="outline"
                    size="sm"
                    onClick={() => handleChannelAssign(ch)}
                    disabled={updateChannel.isPending}
                    className={CHANNEL_COLORS[ch]}
                  >
                    {CHANNEL_LABELS[ch]}
                  </Button>
                ))}
              </>
            )}
            <Input
              placeholder="Ghi chú (tùy chọn)"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="ml-auto h-8 w-48"
            />
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* 2. Metadata Card (collapsible)                                    */}
      {/* ================================================================== */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setMetadataExpanded((prev) => !prev)}
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ship className="h-5 w-5" />
            Thông tin tờ khai
            {metadataExpanded ? (
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
                  startEditHeader();
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        {metadataExpanded && (
          <CardContent>
            {editingHeader ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Cơ quan hải quan</Label>
                    <Input
                      value={headerForm.customsOfficeCode}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, customsOfficeCode: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>MST nhập khẩu</Label>
                    <Input
                      value={headerForm.importerTaxCode}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, importerTaxCode: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Tên nhập khẩu</Label>
                    <Input
                      value={headerForm.importerName}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, importerName: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Địa chỉ nhập khẩu</Label>
                    <Input
                      value={headerForm.importerAddress}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, importerAddress: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Phương thức vận chuyển</Label>
                    <Input
                      value={headerForm.shippingMethod}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, shippingMethod: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Số BL/AWB</Label>
                    <Input
                      value={headerForm.blAwbNumber}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, blAwbNumber: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Cảng xếp hàng</Label>
                    <Input
                      value={headerForm.portOfLoading}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, portOfLoading: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Cảng dỡ hàng</Label>
                    <Input
                      value={headerForm.portOfDischarge}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, portOfDischarge: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Tên tàu</Label>
                    <Input
                      value={headerForm.vesselName}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, vesselName: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Đồng tiền khai báo</Label>
                    <Input
                      value={headerForm.declaredCurrency}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, declaredCurrency: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Cước vận chuyển</Label>
                    <Input
                      type="number"
                      value={headerForm.declaredFreight}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, declaredFreight: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Phí bảo hiểm</Label>
                    <Input
                      type="number"
                      value={headerForm.declaredInsurance}
                      onChange={(e) =>
                        setHeaderForm((p) => ({ ...p, declaredInsurance: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={saveHeader} disabled={updateHeader.isPending} size="sm">
                    {updateHeader.isPending ? 'Đang lưu...' : 'Lưu'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingHeader(false)}>
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

      {/* ================================================================== */}
      {/* 3. Declaration Lines Table                                        */}
      {/* ================================================================== */}
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
                onClick={() => groupByHs.mutate(declaration.id)}
                disabled={groupByHs.isPending}
              >
                <Layers className="mr-1 h-3 w-3" />
                Gom theo HS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGroupSelected}
                disabled={selectedLineIds.size < 2 || groupCustom.isPending}
              >
                <Layers className="mr-1 h-3 w-3" />
                Gom đã chọn ({selectedLineIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkCompliance.mutate(declaration.id)}
                disabled={checkCompliance.isPending}
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
                        onChange={toggleAllLineSelect}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Mã HS</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Mô tả</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">SL</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">ĐVT</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Đơn giá</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Thành tiền</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Xuất xứ</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Thuế NK %</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Thuế NK</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">VAT %</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">VAT</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Tổng thuế</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">TT</th>
                  {isEditable && (
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={isEditable ? 16 : 14} className="py-8 text-center text-muted-foreground">
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
                        onToggleExpand={() => toggleLineExpand(line.id)}
                        onToggleSelect={() => toggleLineSelect(line.id)}
                        onStartEdit={() => startEditLine(line)}
                        onCancelEdit={cancelEditLine}
                        onSaveEdit={saveEditLine}
                        onEditDataChange={setEditingLineData}
                        onHsPopoverOpen={() => setHsPopoverLineId(line.id)}
                        onHsPopoverClose={() => setHsPopoverLineId(null)}
                        onHSCodeSelect={handleHSCodeSelect}
                        onRemove={() =>
                          removeLine.mutate({ lineId: line.id, declarationId: declaration.id })
                        }
                        onUngroup={() =>
                          ungroupLine.mutate({ lineId: line.id, declarationId: declaration.id })
                        }
                        isRemovePending={removeLine.isPending}
                        isSavePending={updateLine.isPending}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* 5. Tax Summary Card                                               */}
      {/* ================================================================== */}
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
              onClick={() => recalculateTax.mutate(declaration.id)}
              disabled={recalculateTax.isPending}
            >
              <Calculator className="mr-1 h-3 w-3" />
              {recalculateTax.isPending ? 'Đang tính...' : 'Tính lại thuế'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* 6. Compliance Alerts Card                                         */}
      {/* ================================================================== */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Cảnh báo tuân thủ ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => {
                const severityClass =
                  alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                    ? 'border-red-200 bg-red-50'
                    : alert.severity === 'MEDIUM'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-blue-200 bg-blue-50';
                const severityText =
                  alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
                    ? 'text-red-800'
                    : alert.severity === 'MEDIUM'
                      ? 'text-yellow-800'
                      : 'text-blue-800';

                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${severityClass}`}
                  >
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severityText}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase ${severityText}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-muted-foreground">{alert.alertType}</span>
                        {alert.hsCode && (
                          <span className="rounded bg-background/50 px-1.5 py-0.5 text-xs font-mono">
                            {alert.hsCode}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${severityText}`}>{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(alert.createdAt)}
                      </p>
                    </div>
                    {alert.isAcknowledged ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Đã xác nhận
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          acknowledgeAlert.mutate({
                            alertId: alert.id,
                            declarationId: declaration.id,
                          })
                        }
                        disabled={acknowledgeAlert.isPending}
                        className="shrink-0"
                      >
                        Xác nhận
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* 7. Tax Allocation Card (shown when CLEARED)                       */}
      {/* ================================================================== */}
      {(declaration.status === 'CLEARED' || declaration.taxAllocated) && (
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
                    onChange={(e) => setAllocationMethod(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="BY_VALUE">Theo giá trị</option>
                    <option value="BY_WEIGHT">Theo trọng lượng</option>
                  </select>
                </div>
                <Button
                  onClick={() =>
                    allocateTax.mutate({ id: declaration.id, method: allocationMethod })
                  }
                  disabled={allocateTax.isPending}
                  size="sm"
                >
                  {allocateTax.isPending ? 'Đang phân bổ...' : 'Phân bổ'}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Đơn hàng</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Tỷ lệ %</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Thuế NK</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">VAT</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Thuế TTĐB</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Thuế khác</th>
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
      )}

      {/* ================================================================== */}
      {/* 8. Status Timeline Card                                           */}
      {/* ================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Lịch sử trạng thái
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lịch sử.</p>
          ) : (
            <div className="relative space-y-0">
              {history.map((event, idx) => {
                const isChannelEvent = !!event.channel;
                return (
                  <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {idx < history.length - 1 && (
                      <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
                    )}
                    <div
                      className={`relative z-10 mt-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 ${
                        isChannelEvent ? 'border-amber-500 bg-amber-100' : 'border-primary bg-background'
                      }`}
                    />
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {event.fromStatus
                            ? `${STATUS_LABELS[event.fromStatus as CustomsDeclarationStatus] ?? event.fromStatus} -> ${STATUS_LABELS[event.toStatus as CustomsDeclarationStatus] ?? event.toStatus}`
                            : STATUS_LABELS[event.toStatus as CustomsDeclarationStatus] ?? event.toStatus}
                        </span>
                        {event.channel && (
                          <StatusBadge
                            label={`Luồng ${CHANNEL_LABELS[event.channel]}`}
                            colorClass={CHANNEL_COLORS[event.channel]}
                          />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(event.createdAt)}
                        {event.changedBy && (
                          <span className="ml-2 text-xs">(bởi {event.changedBy})</span>
                        )}
                      </p>
                      {event.note && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          {event.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* 9. Export Section                                                  */}
      {/* ================================================================== */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Button
            onClick={() => exportEcus5.mutate(declaration.id)}
            disabled={exportEcus5.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportEcus5.isPending ? 'Đang xuất...' : 'Xuất ECUS5 (Excel)'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineRow sub-component
// ---------------------------------------------------------------------------

interface LineRowProps {
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
  onEditDataChange: (fn: (prev: Partial<CustomsDeclarationLine>) => Partial<CustomsDeclarationLine>) => void;
  onHsPopoverOpen: () => void;
  onHsPopoverClose: () => void;
  onHSCodeSelect: (hs: HSCodeResult) => void;
  onRemove: () => void;
  onUngroup: () => void;
  isRemovePending: boolean;
  isSavePending: boolean;
}

function LineRow({
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
  onUngroup,
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
                  {line.environmentalTax.toLocaleString()} + {line.antiDumpingDuty.toLocaleString()}
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
                      </Link>
                      {' '}
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
