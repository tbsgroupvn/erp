'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
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
  useCheckCompliance,
  useAcknowledgeAlert,
} from '@/lib/hooks/use-customs-declaration';
import type {
  CustomsDeclarationStatus,
  CustomsChannel,
  CustomsDeclarationLine,
  HSCodeResult,
} from '@/lib/types/customs.types';

import {
  StatusTransitionBar,
  DeclarationMetadataCard,
  DeclarationLinesCard,
  TaxSummaryCard,
  ComplianceAlertsCard,
  TaxAllocationCard,
  StatusTimelineCard,
  ExportCard,
} from './_components';

// ---------------------------------------------------------------------------
// Status maps (used in page header badges only — full maps live in sub-components)
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

  // ----- Line handlers -----

  const toggleLineExpand = (lineId: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

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

  // ----- Header handlers -----

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

  const handleHeaderFormChange = (field: string, value: string) => {
    setHeaderForm((prev) => ({ ...prev, [field]: value }));
  };

  // ----- HS Code handler -----

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

  // ----- Status / channel handlers -----

  const handleStatusTransition = (nextStatus: CustomsDeclarationStatus) => {
    if (!declaration) return;
    updateStatus.mutate({
      id: declaration.id,
      status: nextStatus,
      note: statusNote || undefined,
    });
    setStatusNote('');
  };

  const handleChannelAssign = (channel: CustomsChannel) => {
    if (!declaration) return;
    updateChannel.mutate({ id: declaration.id, channel });
  };

  // ----- Grouping handler -----

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
      {/* 1. Header                                                          */}
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
            description={
              declaration.container?.code
                ? `Container: ${declaration.container.code}`
                : undefined
            }
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

      {/* ================================================================== */}
      {/* 2. Status transition bar                                           */}
      {/* ================================================================== */}
      <StatusTransitionBar
        currentStatus={declaration.status}
        availableTransitions={availableTransitions}
        statusNote={statusNote}
        isTransitionPending={updateStatus.isPending}
        isChannelPending={updateChannel.isPending}
        onStatusTransition={handleStatusTransition}
        onChannelAssign={handleChannelAssign}
        onStatusNoteChange={setStatusNote}
      />

      {/* ================================================================== */}
      {/* 3. Metadata card (collapsible)                                     */}
      {/* ================================================================== */}
      <DeclarationMetadataCard
        declaration={declaration}
        isEditable={isEditable ?? false}
        isExpanded={metadataExpanded}
        editingHeader={editingHeader}
        headerForm={headerForm}
        isSavePending={updateHeader.isPending}
        onToggleExpand={() => setMetadataExpanded((prev) => !prev)}
        onStartEdit={startEditHeader}
        onCancelEdit={() => setEditingHeader(false)}
        onSave={saveHeader}
        onHeaderFormChange={handleHeaderFormChange}
      />

      {/* ================================================================== */}
      {/* 4. Declaration lines table                                         */}
      {/* ================================================================== */}
      <DeclarationLinesCard
        declaration={declaration}
        isEditable={isEditable ?? false}
        lines={lines}
        selectedLineIds={selectedLineIds}
        expandedLines={expandedLines}
        editingLineId={editingLineId}
        editingLineData={editingLineData}
        hsPopoverLineId={hsPopoverLineId}
        isGroupByHsPending={groupByHs.isPending}
        isGroupCustomPending={groupCustom.isPending}
        isCheckCompliancePending={checkCompliance.isPending}
        isRemoveLinePending={removeLine.isPending}
        isUpdateLinePending={updateLine.isPending}
        onGroupByHs={() => groupByHs.mutate(declaration.id)}
        onGroupSelected={handleGroupSelected}
        onCheckCompliance={() => checkCompliance.mutate(declaration.id)}
        onToggleAllSelect={toggleAllLineSelect}
        onToggleLineExpand={toggleLineExpand}
        onToggleLineSelect={toggleLineSelect}
        onStartEditLine={startEditLine}
        onCancelEditLine={cancelEditLine}
        onSaveEditLine={saveEditLine}
        onEditDataChange={setEditingLineData}
        onHsPopoverOpen={setHsPopoverLineId}
        onHsPopoverClose={() => setHsPopoverLineId(null)}
        onHSCodeSelect={handleHSCodeSelect}
        onRemoveLine={(lineId) => removeLine.mutate({ lineId, declarationId: declaration.id })}
        onUngroupLine={(lineId) => ungroupLine.mutate({ lineId, declarationId: declaration.id })}
      />

      {/* ================================================================== */}
      {/* 5. Tax summary                                                     */}
      {/* ================================================================== */}
      <TaxSummaryCard
        declaration={declaration}
        isRecalculatePending={recalculateTax.isPending}
        onRecalculate={() => recalculateTax.mutate(declaration.id)}
      />

      {/* ================================================================== */}
      {/* 6. Compliance alerts                                               */}
      {/* ================================================================== */}
      <ComplianceAlertsCard
        alerts={alerts}
        isAcknowledgePending={acknowledgeAlert.isPending}
        onAcknowledge={(alertId) =>
          acknowledgeAlert.mutate({ alertId, declarationId: declaration.id })
        }
      />

      {/* ================================================================== */}
      {/* 7. Tax allocation                                                  */}
      {/* ================================================================== */}
      <TaxAllocationCard
        declaration={declaration}
        allocations={allocations}
        allocationMethod={allocationMethod}
        isAllocatePending={allocateTax.isPending}
        onAllocate={() => allocateTax.mutate({ id: declaration.id, method: allocationMethod })}
        onAllocationMethodChange={setAllocationMethod}
      />

      {/* ================================================================== */}
      {/* 8. Status timeline                                                 */}
      {/* ================================================================== */}
      <StatusTimelineCard history={history} />

      {/* ================================================================== */}
      {/* 9. Export                                                          */}
      {/* ================================================================== */}
      <ExportCard
        isExportPending={exportEcus5.isPending}
        onExportEcus5={() => exportEcus5.mutate(declaration.id)}
      />
    </div>
  );
}
