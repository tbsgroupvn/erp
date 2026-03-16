'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { quickQuoteApi, type RateCard } from '@/lib/api/quick-quote.api';

const TRANSPORT_LABELS: Record<string, string> = { SEA: 'Biển', ROAD: 'Bộ', AIR: 'Hàng không' };
const ORIGIN_LABELS: Record<string, string> = { YIWU: 'Nghĩa Ô', PINGXIANG: 'Bằng Tường', GUANGZHOU: 'Quảng Châu', OTHER: 'Khác' };
const DEST_LABELS: Record<string, string> = { HANOI: 'Hà Nội', HOCHIMINH: 'HCM', DANANG: 'Đà Nẵng', OTHER: 'Khác' };
const SVC_LABELS: Record<string, string> = { VCT: 'Vận chuyển', MHH: 'Mua hàng hộ', UTXNK: 'UTX NK', LCLCN: 'LCL Chính ngạch' };

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

export default function BangGiaPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rate-cards'],
    queryFn: () => quickQuoteApi.listRateCards({ isActive: undefined }),
  });

  const rateCards: RateCard[] = (data?.data?.data as any)?.data ?? data?.data?.data ?? [];

  return (
    <div>
      <PageHeader title="Bảng giá cước" description="Cấu hình giá cước vận chuyển cho Quick Quote">
        <Button size="sm" className="gap-1" disabled>
          <Plus className="h-4 w-4" /> Thêm bảng giá
        </Button>
      </PageHeader>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
        ) : rateCards.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground mb-2">Chưa có bảng giá cước nào</p>
            <p className="text-sm text-muted-foreground">
              Nhờ Kế toán / Logistics Manager nhập bảng giá trước khi dùng Quick Quote
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Tên bảng giá</th>
                <th className="px-4 py-3 text-left font-medium">Tuyến</th>
                <th className="px-4 py-3 text-left font-medium">Dịch vụ</th>
                <th className="px-4 py-3 text-right font-medium">VND/CBM</th>
                <th className="px-4 py-3 text-right font-medium">VND/KG</th>
                <th className="px-4 py-3 text-left font-medium">Hiệu lực</th>
                <th className="px-4 py-3 text-center font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rateCards.map((rc) => (
                <tr key={rc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{rc.name}</p>
                    <p className="text-xs text-muted-foreground">{rc.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{ORIGIN_LABELS[rc.origin] ?? rc.origin} → {DEST_LABELS[rc.destination] ?? rc.destination}</p>
                    <Badge variant="outline" className="text-xs mt-1">{TRANSPORT_LABELS[rc.transportMode] ?? rc.transportMode}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{SVC_LABELS[rc.serviceType] ?? rc.serviceType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(Number(rc.pricePerCBM))}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(Number(rc.pricePerKG))}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(rc.validFrom).toLocaleDateString('vi-VN')}
                    {rc.validTo ? ` → ${new Date(rc.validTo).toLocaleDateString('vi-VN')}` : ' → Vô thời hạn'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rc.isActive
                      ? <CheckCircle className="h-4 w-4 text-green-500 inline" />
                      : <XCircle className="h-4 w-4 text-red-400 inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 rounded-md border bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Lưu ý:</strong> Bảng giá cước là nền tảng của Quick Quote. Cần nhập ít nhất 1 bảng giá cho mỗi tuyến trước khi Sale dùng Báo giá nhanh.
        Liên hệ KT Tổng hợp hoặc Logistics Manager để cập nhật.
      </div>
    </div>
  );
}
