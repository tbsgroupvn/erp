'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, FileSpreadsheet, FileText, Download, Pencil, BookmarkPlus } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import {
  useQuotation,
  useApproveQuotation,
  useRejectQuotation,
  useConvertQuotationToOrder,
  useDuplicateQuotation,
  useSaveAsTemplate,
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
  HN: 'Hà Nội',
  HCM: 'TP. Hồ Chí Minh',
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
  const saveAsTemplate = useSaveAsTemplate();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templatePublic, setTemplatePublic] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!quotation) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy báo giá</p>
        <Link href="/bao-gia" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const q = quotation as Quotation;
  const status = q.status as QuotationStatus;

  const handleApprove = () => {
    approveQuotation.mutate(id, {
      onSuccess: (data: any) => {
        toast.success('Đã duyệt báo giá');
        if (data?.contractAppendixId) {
          toast.success('Đã tạo phụ lục hợp đồng tự động');
          router.push(`/hop-dong/${data.contractAppendixId}`);
        }
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi duyệt báo giá'),
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      toast.error('Lý do từ chối phải ít nhất 5 ký tự');
      return;
    }
    rejectQuotation.mutate({ id, reason: rejectReason }, {
      onSuccess: () => {
        toast.success('Đã từ chối báo giá');
        setShowRejectForm(false);
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi từ chối báo giá'),
    });
  };

  const handleConvert = () => {
    convertToOrder.mutate(id, {
      onSuccess: (data: any) => {
        const orderId = data?.order?.id;
        toast.success('Da chuyen thanh don hang', {
          action: orderId
            ? { label: 'Xem don hang', onClick: () => router.push(`/don-hang/${orderId}`) }
            : undefined,
        });
        if (orderId) {
          router.push(`/don-hang/${orderId}`);
        } else {
          router.push('/don-hang');
        }
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi chuyển đổi'),
    });
  };

  const handleDuplicate = () => {
    duplicateQuotation.mutate(id, {
      onSuccess: () => toast.success('Đã sao chép báo giá'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi sao chép'),
    });
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const blob = await quotationsApi.exportPdf(id);
      saveAs(blob, `bao-gia-${q.code}.pdf`);
      toast.success('Đã tải PDF');
    } catch {
      toast.error('Lỗi xuất PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const blob = await quotationsApi.exportExcel(id);
      saveAs(blob, `bao-gia-${q.code}.xlsx`);
      toast.success('Đã tải Excel');
    } catch {
      toast.error('Lỗi xuất Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Vui lòng nhập tên mẫu');
      return;
    }
    saveAsTemplate.mutate(
      { id, data: { name: templateName, isPublic: templatePublic } },
      {
        onSuccess: () => {
          setShowSaveTemplate(false);
          setTemplateName('');
          setTemplatePublic(false);
        },
      },
    );
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
            Tạo lúc {formatDate(q.createdAt)}
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
              Duyệt
            </button>
            <button onClick={() => setShowRejectForm(!showRejectForm)}
              className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
              Từ chối
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <button onClick={handleConvert} disabled={convertToOrder.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {convertToOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Chuyển thành đơn hàng
          </button>
        )}
        <button onClick={handleDuplicate} disabled={duplicateQuotation.isPending}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Sao chép
        </button>
        <button
          onClick={() => setShowSaveTemplate(true)}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          <BookmarkPlus className="h-4 w-4" />
          Lưu làm mẫu
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={handleExportExcel} disabled={exportingExcel}
            className="inline-flex items-center gap-2 rounded-md border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50">
            {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Xuất Excel
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf}
            className="inline-flex items-center gap-2 rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Xuất PDF
          </button>
        </div>
      </div>

      {/* Reject Form */}
      {showRejectForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <label className="text-sm font-medium">Lý do từ chối *</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Nhập lý do từ chối (tối thiểu 5 ký tự)..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={handleReject} disabled={rejectQuotation.isPending || rejectReason.trim().length < 5}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
            {rejectQuotation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận từ chối
          </button>
        </div>
      )}

      {/* Rejection Reason */}
      {q.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive mb-1">Lý do từ chối</p>
          <p className="text-sm">{q.rejectionReason}</p>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin báo giá</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại dịch vụ</dt>
              <dd>{SERVICE_TYPE_LABELS[q.serviceType as ServiceType] || q.serviceType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chi nhánh</dt>
              <dd>{BRANCH_LABELS[q.branch] || q.branch}</dd>
            </div>
            {q.shippingRoute && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tuyến vận chuyển</dt>
                <dd>{SHIPPING_ROUTE_LABELS[q.shippingRoute as ShippingRoute] || q.shippingRoute}</dd>
              </div>
            )}
            {q.validUntil && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hiệu lực đến</dt>
                <dd>{formatDate(q.validUntil, 'dd/MM/yyyy')}</dd>
              </div>
            )}
            {q.note && (
              <div>
                <dt className="text-muted-foreground mb-1">Ghi chú</dt>
                <dd>{q.note}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Khách hàng</h3>
          {q.customer ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mã KH</dt>
                <dd>
                  <Link href={`/khach-hang/${q.customer.id}`} className="text-primary hover:underline">
                    {q.customer.code}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tên</dt>
                <dd>{q.customer.fullName}</dd>
              </div>
              {q.customer.companyName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Công ty</dt>
                  <dd>{q.customer.companyName}</dd>
                </div>
              )}
              {q.customer.phone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Điện thoại</dt>
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
            <p className="text-sm text-muted-foreground">Không có thông tin</p>
          )}
        </div>

        {/* Price Summary */}
        <div className="rounded-lg border bg-card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Tổng hợp giá</h3>
          <dl className="space-y-3 text-sm max-w-sm ml-auto">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tạm tính</dt>
              <dd>{formatCurrency(q.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giảm giá ({Number(q.discountPercent)}%)</dt>
              <dd className="text-destructive">-{formatCurrency(q.discountAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Thuế ({(Number(q.taxRate) * 100).toFixed(0)}%)</dt>
              <dd>{formatCurrency(q.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t pt-3 font-semibold text-base">
              <dt>Tổng cộng</dt>
              <dd>{formatCurrency(q.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Items Table */}
      {q.items && q.items.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Chi tiết hàng mục</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium w-10">STT</th>
                  <th className="pb-2 font-medium">Tên sản phẩm</th>
                  <th className="pb-2 font-medium w-16 text-center">SL</th>
                  <th className="pb-2 font-medium text-right">Đơn giá</th>
                  <th className="pb-2 font-medium text-right">Thành tiền</th>
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

      {/* Save as Template Dialog */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl mx-4">
            <h3 className="text-lg font-semibold mb-4">Lưu làm mẫu báo giá</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tên mẫu *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="VD: Mẫu BG vận chuyển đường biển"
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templatePublic}
                  onChange={(e) => setTemplatePublic(e.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                <span className="text-sm">Chia sẻ cho team</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplatePublic(false); }}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  disabled={saveAsTemplate.isPending || !templateName.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saveAsTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Lưu mẫu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
