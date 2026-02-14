'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, CheckCircle, XCircle } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useVendor, useToggleVendorApproval, useRateVendor } from '@/lib/hooks/use-vendors';
import { formatDate } from '@/lib/utils/format';

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: vendor, isLoading } = useVendor(id);
  const toggleApproval = useToggleVendorApproval();
  const rateVendor = useRateVendor();

  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!vendor) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy nhà cung cấp</p>
        <Link href="/nha-cung-cap" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const handleToggleApproval = () => {
    toggleApproval.mutate({ id, isApproved: !vendor.isApproved });
  };

  const handleRate = () => {
    rateVendor.mutate(
      { id, data: { score: ratingScore, comment: ratingComment || undefined } },
      {
        onSuccess: () => {
          setRatingComment('');
          setRatingScore(5);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/nha-cung-cap" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{vendor.name}</h1>
            <StatusBadge
              label={vendor.isApproved ? 'Đã duyệt' : 'Chưa duyệt'}
              colorClass={vendor.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Mã: {vendor.code}</p>
        </div>
        <button
          onClick={handleToggleApproval}
          disabled={toggleApproval.isPending}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${vendor.isApproved ? 'border border-red-300 text-red-700 hover:bg-red-50' : 'bg-green-600 text-white hover:bg-green-700'} disabled:opacity-50`}
        >
          {vendor.isApproved ? (
            <><XCircle className="h-4 w-4" /> Hủy duyệt</>
          ) : (
            <><CheckCircle className="h-4 w-4" /> Duyệt NCC</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin nhà cung cấp</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Người liên hệ</dt>
              <dd>{vendor.contactPerson}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Điện thoại</dt>
              <dd>{vendor.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{vendor.email || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quốc gia</dt>
              <dd>{vendor.country}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Địa chỉ</dt>
              <dd className="text-right max-w-[60%]">{vendor.address || '---'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin ngân hàng</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngân hàng</dt>
              <dd>{vendor.bankName || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số tài khoản</dt>
              <dd>{vendor.bankAccountNumber || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chủ tài khoản</dt>
              <dd>{vendor.bankAccountName || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Điều khoản thanh toán</dt>
              <dd>{vendor.paymentTerms || '---'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Đánh giá</h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold">{(vendor.averageRating || 0).toFixed(1)}</p>
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.floor(vendor.averageRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Trung bình</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Đánh giá nhà cung cấp</h4>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Điểm</label>
              <select
                value={ratingScore}
                onChange={(e) => setRatingScore(Number(e.target.value))}
                className="flex h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v} sao</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-xs text-muted-foreground">Nhận xét</label>
              <input
                type="text"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Nhận xét về nhà cung cấp..."
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleRate}
              disabled={rateVendor.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Gửi đánh giá
            </button>
          </div>
        </div>

        {vendor.ratings && vendor.ratings.length > 0 && (
          <div className="border-t pt-4 mt-4 space-y-3">
            <h4 className="text-sm font-medium">Đánh giá gần đây</h4>
            {vendor.ratings.map((r) => (
              <div key={r.id} className="flex items-start gap-3 text-sm">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < r.score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  {r.comment && <p>{r.comment}</p>}
                  <p className="text-xs text-muted-foreground">
                    {r.ratedByUser?.fullName || r.ratedBy} - {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
