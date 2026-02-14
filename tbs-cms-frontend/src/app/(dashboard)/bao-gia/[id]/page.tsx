'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, FileSpreadsheet, FileText, Download, Pencil } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import {
  useQuotation,
  useApproveQuotation,
  useRejectQuotation,
  useConvertQuotationToOrder,
  useDuplicateQuotation,
} from '@/lib/hooks/use-quotations';
import { quotationsApi } from '@/lib/api/quotations.api';
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  SHIPPING_ROUTE_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { Quotation, QuotationStatus, ServiceType, ShippingRoute } from '@/lib/types';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';

const BRANCH_LABELS: Record<string, string> = {
  HN: 'Ha\u0300 No\u0323i',
  HCM: 'TP. Ho\u0300 Chi\u0301 Minh',
};

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: quotation, isLoading } = useQuotation(id);
  const approveQuotation = useApproveQuotation();
  const rejectQuotation = useRejectQuotation();
  const convertToOrder = useConvertQuotationToOrder();
  const duplicateQuotation = useDuplicateQuotation();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!quotation) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Kh\u00F4ng t\u00ECm th\u1EA5y b\u00E1o gi\u00E1</p>
        <Link href="/bao-gia" className="text-primary hover:underline mt-2 inline-block">
          Quay l\u1EA1i danh s\u00E1ch
        </Link>
      </div>
    );
  }

  const q = quotation as Quotation;
  const status = q.status as QuotationStatus;

  const handleApprove = () => {
    approveQuotation.mutate(id, {
      onSuccess: () => toast.success('\u0110\u00E3 duy\u1EC7t b\u00E1o gi\u00E1'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'L\u1ED7i duy\u1EC7t b\u00E1o gi\u00E1'),
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      toast.error('L\u00FD do t\u1EEB ch\u1ED1i ph\u1EA3i \u00EDt nh\u1EA5t 5 k\u00FD t\u1EF1');
      return;
    }
    rejectQuotation.mutate({ id, reason: rejectReason }, {
      onSuccess: () => {
        toast.success('\u0110\u00E3 t\u1EEB ch\u1ED1i b\u00E1o gi\u00E1');
        setShowRejectForm(false);
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'L\u1ED7i t\u1EEB ch\u1ED1i b\u00E1o gi\u00E1'),
    });
  };

  const handleConvert = () => {
    convertToOrder.mutate(id, {
      onSuccess: () => {
        toast.success('\u0110\u00E3 chuy\u1EC3n th\u00E0nh \u0111\u01A1n h\u00E0ng');
        router.push('/don-hang');
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'L\u1ED7i chuy\u1EC3n \u0111\u1ED5i'),
    });
  };

  const handleDuplicate = () => {
    duplicateQuotation.mutate(id, {
      onSuccess: () => toast.success('\u0110\u00E3 sao ch\u00E9p b\u00E1o gi\u00E1'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'L\u1ED7i sao ch\u00E9p'),
    });
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const blob = await quotationsApi.exportPdf(id);
      saveAs(blob, `bao-gia-${q.code}.pdf`);
      toast.success('\u0110\u00E3 t\u1EA3i PDF');
    } catch {
      toast.error('L\u1ED7i xu\u1EA5t PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const blob = await quotationsApi.exportExcel(id);
      saveAs(blob, `bao-gia-${q.code}.xlsx`);
      toast.success('\u0110\u00E3 t\u1EA3i Excel');
    } catch {
      toast.error('L\u1ED7i xu\u1EA5t Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/bao-gia" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{q.code}</h1>
            <StatusBadge
              label={QUOTATION_STATUS_LABELS[status] || status}
              colorClass={QUOTATION_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
            {q.version > 1 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                v{q.version}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            T\u1EA1o l\u00FAc {formatDate(q.createdAt)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(status === 'DRAFT' || status === 'PENDING_APPROVAL') && (
          <Link
            href={`/bao-gia/tao-moi?editId=${id}`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
            Sửa
          </Link>
        )}
        {status === 'PENDING_APPROVAL' && (
          <>
            <button onClick={handleApprove} disabled={approveQuotation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {approveQuotation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Duy\u1EC7t
            </button>
            <button onClick={() => setShowRejectForm(!showRejectForm)}
              className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
              T\u1EEB ch\u1ED1i
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button onClick={handleConvert} disabled={convertToOrder.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {convertToOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Chuy\u1EC3n th\u00E0nh \u0111\u01A1n h\u00E0ng
          </button>
        )}
        <button onClick={handleDuplicate} disabled={duplicateQuotation.isPending}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Sao ch\u00E9p
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={handleExportExcel} disabled={exportingExcel}
            className="inline-flex items-center gap-2 rounded-md border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50">
            {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Xu\u1EA5t Excel
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf}
            className="inline-flex items-center gap-2 rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Xu\u1EA5t PDF
          </button>
        </div>
      </div>

      {/* Reject Form */}
      {showRejectForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <label className="text-sm font-medium">L\u00FD do t\u1EEB ch\u1ED1i *</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Nh\u1EADp l\u00FD do t\u1EEB ch\u1ED1i (t\u1ED1i thi\u1EC3u 5 k\u00FD t\u1EF1)..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={handleReject} disabled={rejectQuotation.isPending || rejectReason.trim().length < 5}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
            {rejectQuotation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            X\u00E1c nh\u1EADn t\u1EEB ch\u1ED1i
          </button>
        </div>
      )}

      {/* Rejection Reason */}
      {q.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive mb-1">L\u00FD do t\u1EEB ch\u1ED1i</p>
          <p className="text-sm">{q.rejectionReason}</p>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Th\u00F4ng tin b\u00E1o gi\u00E1</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lo\u1EA1i d\u1ECBch v\u1EE5</dt>
              <dd>{SERVICE_TYPE_LABELS[q.serviceType as ServiceType] || q.serviceType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chi nh\u00E1nh</dt>
              <dd>{BRANCH_LABELS[q.branch] || q.branch}</dd>
            </div>
            {q.shippingRoute && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tuy\u1EBFn v\u1EADn chuy\u1EC3n</dt>
                <dd>{SHIPPING_ROUTE_LABELS[q.shippingRoute as ShippingRoute] || q.shippingRoute}</dd>
              </div>
            )}
            {q.validUntil && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hi\u1EC7u l\u1EF1c \u0111\u1EBFn</dt>
                <dd>{formatDate(q.validUntil, 'dd/MM/yyyy')}</dd>
              </div>
            )}
            {q.note && (
              <div>
                <dt className="text-muted-foreground mb-1">Ghi ch\u00FA</dt>
                <dd>{q.note}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Kh\u00E1ch h\u00E0ng</h3>
          {q.customer ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">M\u00E3 KH</dt>
                <dd>
                  <Link href={`/khach-hang/${q.customer.id}`} className="text-primary hover:underline">
                    {q.customer.code}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">T\u00EAn</dt>
                <dd>{q.customer.fullName}</dd>
              </div>
              {q.customer.companyName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">C\u00F4ng ty</dt>
                  <dd>{q.customer.companyName}</dd>
                </div>
              )}
              {q.customer.phone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">\u0110i\u1EC7n tho\u1EA1i</dt>
                  <dd>{q.customer.phone}</dd>
                </div>
              )}
              {q.customer.email && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{q.customer.email}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Kh\u00F4ng c\u00F3 th\u00F4ng tin</p>
          )}
        </div>

        {/* Price Summary */}
        <div className="rounded-lg border bg-card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">T\u1ED5ng h\u1EE3p gi\u00E1</h3>
          <dl className="space-y-3 text-sm max-w-sm ml-auto">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">T\u1EA1m t\u00EDnh</dt>
              <dd>{formatCurrency(q.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gi\u1EA3m gi\u00E1 ({Number(q.discountPercent)}%)</dt>
              <dd className="text-destructive">-{formatCurrency(q.discountAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Thu\u1EBF ({(Number(q.taxRate) * 100).toFixed(0)}%)</dt>
              <dd>{formatCurrency(q.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t pt-3 font-semibold text-base">
              <dt>T\u1ED5ng c\u1ED9ng</dt>
              <dd>{formatCurrency(q.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Items Table */}
      {q.items && q.items.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Chi ti\u1EBFt h\u00E0ng m\u1EE5c</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium w-10">STT</th>
                  <th className="pb-2 font-medium">T\u00EAn s\u1EA3n ph\u1EA9m</th>
                  <th className="pb-2 font-medium w-16 text-center">SL</th>
                  <th className="pb-2 font-medium text-right">\u0110\u01A1n gi\u00E1</th>
                  <th className="pb-2 font-medium text-right">Th\u00E0nh ti\u1EC1n</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item, index) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2 text-center">{index + 1}</td>
                    <td className="py-2">
                      <div>
                        <span>{item.productName}</span>
                        {item.productUrl && (
                          <a href={item.productUrl} target="_blank" rel="noopener noreferrer"
                            className="ml-2 text-xs text-primary hover:underline">
                            [Link]
                          </a>
                        )}
                      </div>
                      {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
                    </td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
