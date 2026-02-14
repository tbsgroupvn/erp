'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle, ArrowRightCircle, Package } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { usePurchaseRequest, useApprovePurchaseRequest, useConvertToPO, useRecordReceipt } from '@/lib/hooks/use-purchases';
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS } from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { PurchaseStatus, Currency } from '@/lib/types';

export default function PurchaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: purchase, isLoading } = usePurchaseRequest(id);
  const approveMutation = useApprovePurchaseRequest();
  const convertMutation = useConvertToPO();
  const receiptMutation = useRecordReceipt();

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!purchase) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy yêu cầu mua</p>
        <Link href="/mua-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const status = purchase.status as PurchaseStatus;
  const isSubmitted = status === 'SUBMITTED';
  const isApproved = status === 'APPROVED';
  const isOrdered = status === 'ORDERED';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/mua-hang" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{purchase.code}</h1>
            <StatusBadge
              label={PURCHASE_STATUS_LABELS[status] || status}
              colorClass={PURCHASE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo lúc {formatDate(purchase.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitted && (
            <button
              onClick={() => approveMutation.mutate(id)}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" /> Duyệt
            </button>
          )}
          {isApproved && (
            <button
              onClick={() => convertMutation.mutate(id)}
              disabled={convertMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <ArrowRightCircle className="h-4 w-4" /> Chuyển thành PO
            </button>
          )}
          {isOrdered && (
            <button
              onClick={() => receiptMutation.mutate(id)}
              disabled={receiptMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              <Package className="h-4 w-4" /> Ghi nhận nhập hàng
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin chung</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nhà cung cấp</dt>
              <dd>{purchase.vendor?.name || purchase.vendorId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tiền tệ</dt>
              <dd>{purchase.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tổng tiền</dt>
              <dd className="font-medium">{formatCurrency(purchase.totalAmount, purchase.currency as Currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Người tạo</dt>
              <dd>{purchase.createdByUser?.fullName || purchase.createdBy}</dd>
            </div>
            {purchase.notes && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ghi chú</dt>
                <dd>{purchase.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Status Timeline */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Trạng thái</h3>
          <div className="space-y-3">
            {['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'CLOSED'].map((s) => {
              const statusOrder = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'CLOSED'];
              const currentIdx = statusOrder.indexOf(status);
              const stepIdx = statusOrder.indexOf(s);
              const isDone = stepIdx <= currentIdx;
              const isCurrent = stepIdx === currentIdx;

              return (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isDone
                        ? isCurrent
                          ? 'bg-blue-500 text-white'
                          : 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isDone && !isCurrent ? (
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepIdx + 1
                    )}
                  </div>
                  <span className={`text-sm ${isDone ? 'font-medium' : 'text-muted-foreground'}`}>
                    {PURCHASE_STATUS_LABELS[s as PurchaseStatus] || s}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Items table */}
      {purchase.items && purchase.items.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Chi tiết hàng hóa</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Mô tả</th>
                  <th className="pb-2 font-medium">SL</th>
                  <th className="pb-2 font-medium">Đơn vị</th>
                  <th className="pb-2 font-medium text-right">Đơn giá</th>
                  <th className="pb-2 font-medium text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2">{item.unit}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice, purchase.currency as Currency)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.amount, purchase.currency as Currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="py-2 text-right font-medium">Tổng cộng:</td>
                  <td className="py-2 text-right font-bold">{formatCurrency(purchase.totalAmount, purchase.currency as Currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
