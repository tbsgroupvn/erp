'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, ShoppingCart, Wallet, CreditCard, Plus, Pencil, Loader2 } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { StatusBadge } from '@/components/shared/status-badge';
import { useCustomer, useUpdateCustomer, useTopupWallet } from '@/lib/hooks/use-customers';
import { useMasterOrders } from '@/lib/hooks/use-orders';
import { useComplaints } from '@/lib/hooks/use-complaints';
import { useReceivables } from '@/lib/hooks/use-finance';
import { CustomerForm, type CustomerFormData } from '@/features/customers/customer-form';
import type { UpdateCustomerDto } from '@/lib/types';
import { CUSTOMER_TIER_LABELS, CUSTOMER_TIER_COLORS, BRANCH_LABELS, MASTER_ORDER_STATUS_LABELS, MASTER_ORDER_STATUS_COLORS, COMPLAINT_STATUS_LABELS, COMPLAINT_STATUS_COLORS } from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { CustomerTier, MasterOrderStatus, ComplaintStatus } from '@/lib/types';
import { AlertCircle } from 'lucide-react';

const TABS = [
  { key: 'info', label: 'Thông tin', icon: User },
  { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
  { key: 'wallet', label: 'Ví', icon: Wallet },
  { key: 'debt', label: 'Công nợ', icon: CreditCard },
  { key: 'complaints', label: 'Khiếu nại', icon: AlertCircle },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CustomerDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CustomerDetailContent />
    </Suspense>
  );
}

function CustomerDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { data: customer, isLoading, isError } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">Lỗi tải dữ liệu</p>
        <p className="text-sm text-muted-foreground mt-1">Không thể tải thông tin khách hàng. Vui lòng thử lại.</p>
        <Link href="/khach-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy khách hàng</p>
        <Link href="/khach-hang" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const tier = customer.tier as CustomerTier;

  const handleEditSubmit = (data: CustomerFormData) => {
    const dto: UpdateCustomerDto = {
      ...data,
      email: data.email || undefined,
      branch: data.branch || undefined,
    };
    updateCustomer.mutate(
      { id, data: dto },
      {
        onSuccess: () => {
          setIsEditing(false);
          router.replace(`/khach-hang/${id}`);
        },
      },
    );
  };

  const customerDefaultValues: Partial<CustomerFormData> = {
    fullName: customer.fullName,
    phone: customer.phone,
    companyName: customer.companyName ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    taxCode: customer.taxCode ?? '',
    tier: customer.tier,
    branch: (customer.branch ?? '') as any,
    saleId: customer.saleId ?? '',
    creditLimit: customer.creditLimit,
    depositRate: customer.depositRate,
    note: customer.note ?? '',
    isActive: customer.isActive,
    contacts: customer.contacts?.map((c) => ({
      fullName: c.fullName,
      phone: c.phone ?? '',
      email: c.email ?? '',
      position: c.position ?? '',
      isPrimary: c.isPrimary,
    })) ?? [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/khach-hang" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{customer.fullName}</h1>
            <StatusBadge
              label={CUSTOMER_TIER_LABELS[tier] || tier}
              colorClass={CUSTOMER_TIER_COLORS[tier] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {customer.code} {customer.companyName ? `- ${customer.companyName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isEditing) {
                setIsEditing(false);
                router.replace(`/khach-hang/${id}`);
              } else {
                setIsEditing(true);
              }
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border hover:bg-accent',
              isEditing && 'bg-accent',
            )}
          >
            <Pencil className="h-4 w-4" />
            {isEditing ? 'Hủy sửa' : 'Sửa'}
          </button>
          <Link
            href={`/don-hang/tao-moi?customerId=${id}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Đặt đơn
          </Link>
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing ? (
        <CustomerForm
          mode="edit"
          defaultValues={customerDefaultValues}
          onSubmit={handleEditSubmit}
          isPending={updateCustomer.isPending}
        />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Tổng đơn hàng</p>
              <p className="text-2xl font-bold mt-1">{customer.totalOrders}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Doanh thu</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(customer.totalRevenue)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Công nợ hiện tại</p>
              <p className={cn('text-2xl font-bold mt-1', customer.currentDebt > 0 ? 'text-red-600' : '')}>
                {formatCurrency(customer.currentDebt)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Hạn mức tín dụng</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(customer.creditLimit)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex gap-4">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
                      activeTab === tab.key
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Thông tin cơ bản</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Họ tên</dt>
                    <dd>{customer.fullName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">SĐT</dt>
                    <dd>{customer.phone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{customer.email || '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Địa chỉ</dt>
                    <dd>{customer.address || '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">MST</dt>
                    <dd>{customer.taxCode || '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Chi nhánh</dt>
                    <dd>{customer.branch ? BRANCH_LABELS[customer.branch] : '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sale phụ trách</dt>
                    <dd>{customer.saleId || '---'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tỷ lệ cọc</dt>
                    <dd>{customer.depositRate}%</dd>
                  </div>
                </dl>
              </div>

              {customer.contacts && customer.contacts.length > 0 && (
                <div className="rounded-lg border bg-card p-6">
                  <h3 className="text-lg font-semibold mb-4">Liên hệ</h3>
                  <div className="space-y-3">
                    {customer.contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between border-b pb-2 text-sm">
                        <div>
                          <p className="font-medium">{c.fullName}</p>
                          <p className="text-xs text-muted-foreground">{c.position || ''}</p>
                        </div>
                        <div className="text-right">
                          <p>{c.phone || ''}</p>
                          <p className="text-xs text-muted-foreground">{c.email || ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <CustomerOrders customerId={id} />
          )}

          {activeTab === 'wallet' && (
            <CustomerWallet customerId={id} wallet={customer.wallet} />
          )}

          {activeTab === 'debt' && (
            <CustomerDebt customerId={id} customer={customer} />
          )}

          {activeTab === 'complaints' && (
            <CustomerComplaints customerId={id} />
          )}
        </>
      )}
    </div>
  );
}

/** Sub-component: Orders tab for a customer */
function CustomerOrders({ customerId }: { customerId: string }) {
  const { data, isLoading } = useMasterOrders({ customerId, limit: 20 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const orders = data?.data ?? [];

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Khách hàng chưa có đơn hàng nào</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Mã đơn</th>
            <th className="px-4 py-3 text-left font-medium">Chi nhánh</th>
            <th className="px-4 py-3 text-left font-medium">Số đơn con</th>
            <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
            <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = order.overallStatus as MasterOrderStatus;
            return (
              <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/don-hang/${order.id}`} className="text-primary hover:underline font-medium">
                    {order.code}
                  </Link>
                </td>
                <td className="px-4 py-3">{order.branch ? BRANCH_LABELS[order.branch] : '---'}</td>
                <td className="px-4 py-3">{order._count?.subOrders ?? order.subOrders?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={MASTER_ORDER_STATUS_LABELS[status] || status}
                    colorClass={MASTER_ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Sub-component: Wallet tab with topup form */
function CustomerWallet({ customerId, wallet }: { customerId: string; wallet?: { balance: number } | null }) {
  const topup = useTopupWallet();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');

  const handleTopup = () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;
    topup.mutate(
      {
        id: customerId,
        data: {
          amount: numAmount,
          note: note || undefined,
          reference: reference || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setAmount('');
          setNote('');
          setReference('');
        },
      },
    );
  };

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ví khách hàng</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nạp ví
          </button>
        )}
      </div>

      {wallet ? (
        <div>
          <p className="text-2xl font-bold">{formatCurrency(wallet.balance)}</p>
          <p className="text-sm text-muted-foreground mt-1">Số dư hiện tại</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Chưa có ví (sẽ tạo khi nạp tiền lần đầu)</p>
      )}

      {/* Transaction History */}
      {wallet && (wallet as any).transactions && (wallet as any).transactions.length > 0 && (
        <div className="rounded-md border">
          <div className="px-4 py-2 border-b bg-muted/50">
            <p className="text-sm font-medium">Lịch sử giao dịch</p>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Ngày</th>
                  <th className="px-4 py-2 font-medium">Loại</th>
                  <th className="px-4 py-2 font-medium">Số tiền</th>
                  <th className="px-4 py-2 font-medium">Tham chiếu</th>
                  <th className="px-4 py-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {(wallet as any).transactions.map((txn: any) => (
                  <tr key={txn.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(txn.createdAt, 'dd/MM/yyyy HH:mm')}</td>
                    <td className="px-4 py-2">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
                        'bg-green-100 text-green-700': txn.type === 'TOPUP',
                        'bg-red-100 text-red-700': txn.type === 'DEDUCT',
                        'bg-blue-100 text-blue-700': txn.type === 'REFUND',
                      })}>
                        {txn.type === 'TOPUP' ? 'Nạp' : txn.type === 'DEDUCT' ? 'Rút' : 'Hoàn'}
                      </span>
                    </td>
                    <td className={cn('px-4 py-2 font-semibold', {
                      'text-green-600': txn.type === 'TOPUP' || txn.type === 'REFUND',
                      'text-red-600': txn.type === 'DEDUCT',
                    })}>
                      {(txn.type === 'TOPUP' || txn.type === 'REFUND') ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{txn.reference || '---'}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{txn.note || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-md border p-4 space-y-3">
          <p className="text-sm font-medium">Nạp tiền vào ví</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium">Số tiền *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Mã tham chiếu</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Mã GD ngân hàng..."
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Ghi chú</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú..."
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTopup}
              disabled={topup.isPending || !amount || Number(amount) <= 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {topup.isPending ? 'Đang nạp...' : 'Xác nhận nạp'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setAmount(''); setNote(''); setReference(''); }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Sub-component: Debt tab with progress bar and unpaid invoices */
function CustomerDebt({ customerId, customer }: { customerId: string; customer: any }) {
  const { data: arData, isLoading } = useReceivables({ customerId, limit: 20 } as any);

  const receivables = (arData?.data ?? []) as any[];
  const usagePercent = customer.creditLimit > 0
    ? (customer.currentDebt / customer.creditLimit) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Credit Summary with Progress Bar */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Tổng quan tín dụng</h3>
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Công nợ hiện tại</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(customer.currentDebt)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hạn mức tín dụng</p>
            <p className="text-2xl font-bold">{formatCurrency(customer.creditLimit)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sử dụng hạn mức</span>
            <span className={cn('font-semibold', {
              'text-red-600': usagePercent >= 100,
              'text-orange-600': usagePercent >= 80 && usagePercent < 100,
              'text-green-600': usagePercent < 80,
            })}>
              {usagePercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full transition-all', {
                'bg-red-500': usagePercent >= 100,
                'bg-orange-500': usagePercent >= 80 && usagePercent < 100,
                'bg-green-500': usagePercent < 80,
              })}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          {usagePercent >= 80 && (
            <p className={cn('text-xs', {
              'text-red-600': usagePercent >= 100,
              'text-orange-600': usagePercent < 100,
            })}>
              {usagePercent >= 100 ? '⚠️ Đã vượt hạn mức!' : '⚠️ Sắp đạt hạn mức!'}
            </p>
          )}
        </div>
      </div>

      {/* Unpaid Receivables Table */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Công nợ phải thu</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : receivables.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Không có công nợ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Mã chứng từ</th>
                  <th className="pb-2 font-medium">Số tiền</th>
                  <th className="pb-2 font-medium">Đã thanh toán</th>
                  <th className="pb-2 font-medium">Còn lại</th>
                  <th className="pb-2 font-medium">Hạn thanh toán</th>
                  <th className="pb-2 font-medium">Quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((ar: any) => {
                  const remaining = ar.amount - (ar.paidAmount || 0);
                  const daysOverdue = ar.dueDate
                    ? Math.floor((new Date().getTime() - new Date(ar.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  const isOverdue = daysOverdue > 0;

                  return (
                    <tr key={ar.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Link href={`/tai-chinh/cong-no-phai-thu/${ar.id}`} className="text-primary hover:underline">
                          {ar.code || ar.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{formatCurrency(ar.amount)}</td>
                      <td className="py-3 pr-4 text-green-600">{formatCurrency(ar.paidAmount || 0)}</td>
                      <td className="py-3 pr-4 font-semibold">{formatCurrency(remaining)}</td>
                      <td className="py-3 pr-4">{ar.dueDate ? formatDate(ar.dueDate) : '---'}</td>
                      <td className="py-3">
                        {isOverdue ? (
                          <span className="text-red-600 font-medium">{daysOverdue} ngày</span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sub-component: Complaints tab for a customer */
function CustomerComplaints({ customerId }: { customerId: string }) {
  const { data, isLoading } = useComplaints({ customerId, limit: 20 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const complaints = data?.data ?? [];

  if (complaints.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Khách hàng chưa có khiếu nại nào</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Mã khiếu nại</th>
            <th className="px-4 py-3 text-left font-medium">Nội dung</th>
            <th className="px-4 py-3 text-left font-medium">Mức độ</th>
            <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
            <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((complaint: any) => {
            const status = complaint.status as ComplaintStatus;
            return (
              <tr key={complaint.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/khieu-nai/${complaint.id}`} className="text-primary hover:underline font-medium">
                    {complaint.code || complaint.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[250px] truncate">{complaint.subject || '---'}</td>
                <td className="px-4 py-3">
                  <span className={cn('font-medium', {
                    'text-red-600': complaint.severity === 'CRITICAL',
                    'text-orange-600': complaint.severity === 'HIGH',
                    'text-yellow-600': complaint.severity === 'MEDIUM',
                    'text-blue-600': complaint.severity === 'LOW',
                  })}>
                    {complaint.severity || '---'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={COMPLAINT_STATUS_LABELS[status] || status}
                    colorClass={COMPLAINT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(complaint.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
