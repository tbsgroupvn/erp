'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatCurrency } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceLineItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
}

interface Invoice {
  id: string;
  code: string;
  status: string;
  customerName: string;
  customerCode: string;
  customerId: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  note?: string;
  items: InvoiceLineItem[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nhap',
  ISSUED: 'Da phat hanh',
  PAID: 'Da thanh toan',
  PARTIALLY_PAID: 'Thanh toan mot phan',
  OVERDUE: 'Qua han',
  CANCELLED: 'Da huy',
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: () => apiClient.get(`/invoices/${id}`).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  // Not found
  if (!invoice) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lai
        </Button>
        <p className="text-muted-foreground">Khong tim thay hoa don.</p>
      </div>
    );
  }

  const remaining = invoice.totalAmount - invoice.paidAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title="Chi tiet hoa don"
            description={invoice.code}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Invoice info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Thong tin hoa don
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Ma hoa don</dt>
              <dd className="font-medium">{invoice.code}</dd>

              <dt className="text-muted-foreground">Trang thai</dt>
              <dd>
                <StatusBadge
                  label={INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                  colorClass={
                    INVOICE_STATUS_COLORS[invoice.status] ||
                    'bg-gray-100 text-gray-700'
                  }
                />
              </dd>

              <dt className="text-muted-foreground">Ngay phat hanh</dt>
              <dd>{formatDate(invoice.issueDate, 'dd/MM/yyyy')}</dd>

              <dt className="text-muted-foreground">Han thanh toan</dt>
              <dd>
                {invoice.dueDate
                  ? formatDate(invoice.dueDate, 'dd/MM/yyyy')
                  : '---'}
              </dd>

              <dt className="text-muted-foreground">Ngay tao</dt>
              <dd>{formatDate(invoice.createdAt)}</dd>

              {invoice.note && (
                <>
                  <dt className="text-muted-foreground">Ghi chu</dt>
                  <dd>{invoice.note}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Card 2: Customer info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Khach hang</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Ma KH</dt>
              <dd>
                <Link
                  href={`/khach-hang/${invoice.customerId}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {invoice.customerCode}
                </Link>
              </dd>

              <dt className="text-muted-foreground">Ten</dt>
              <dd className="font-medium">{invoice.customerName}</dd>

              {invoice.customerPhone && (
                <>
                  <dt className="text-muted-foreground">Dien thoai</dt>
                  <dd>{invoice.customerPhone}</dd>
                </>
              )}

              {invoice.customerEmail && (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{invoice.customerEmail}</dd>
                </>
              )}

              {invoice.customerAddress && (
                <>
                  <dt className="text-muted-foreground">Dia chi</dt>
                  <dd className="col-span-1">{invoice.customerAddress}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Line items table */}
      {invoice.items && invoice.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chi tiet hang muc</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium w-10">STT</th>
                    <th className="pb-2 font-medium">Ten san pham</th>
                    <th className="pb-2 font-medium w-16 text-center">SL</th>
                    <th className="pb-2 font-medium text-right">Don gia</th>
                    <th className="pb-2 font-medium text-right">Thanh tien</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2 text-center">{index + 1}</td>
                      <td className="py-2">
                        <span>{item.productName}</span>
                        {item.note && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.note}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Amounts summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tong hop</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm max-w-sm ml-auto">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tam tinh</dt>
              <dd>{formatCurrency(invoice.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Thue</dt>
              <dd>{formatCurrency(invoice.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t pt-3 font-semibold text-base">
              <dt>Tong cong</dt>
              <dd>{formatCurrency(invoice.totalAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Da thanh toan</dt>
              <dd className="text-green-600">{formatCurrency(invoice.paidAmount)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Con lai</dt>
              <dd className={remaining > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(remaining)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
