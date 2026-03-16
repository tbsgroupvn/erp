/**
 * Sales Dashboard Component
 *
 * Dashboard toàn diện cho Sales tracking đơn hàng, công nợ và hoa hồng.
 *
 * Features:
 * - Real-time KPI cards
 * - Orders table với payment status
 * - Aging analysis widget
 * - Commission summary
 * - Filter & export functionality
 * - Responsive design với Tailwind + shadcn/ui
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Filter,
  Download,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Eye,
  Send,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';
import { useOrders } from '@/lib/hooks/use-orders';
import type { Order as ApiOrder } from '@/lib/types';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Order {
  id: string;
  code: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  dueDate: string;
  daysOverdue: number;
  createdAt: string;
  commissionStatus: 'PENDING' | 'APPROVED' | 'PAID';
  commissionAmount: number;
}

interface KPIData {
  totalOrders: number;
  pendingPayment: number;
  overdueDebt: number;
  pendingCommission: number;
}

interface AgingBucket {
  range: string;
  count: number;
  amount: number;
  color: string;
}

interface FilterState {
  dateRange: {
    from: string;
    to: string;
  };
  customer: string;
  orderStatus: string;
  paymentStatus: string;
}

// ============================================
// API DATA MAPPING
// ============================================

/**
 * Maps an API Order to the dashboard's local Order shape.
 * Fields not available from the API (paidAmount, outstandingAmount,
 * daysOverdue, commission) are derived from available data.
 */
function mapApiOrderToDashboardOrder(apiOrder: ApiOrder): Order {
  const depositPaid = apiOrder.depositPaid ?? 0;
  const totalAmount = apiOrder.totalAmount ?? 0;
  const outstandingAmount = Math.max(0, totalAmount - depositPaid);
  const createdDate = new Date(apiOrder.createdAt);
  const now = new Date();
  const daysSinceCreated = Math.max(
    0,
    Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  // Consider overdue only if the order is not completed and outstanding > 0
  const isCompleted = apiOrder.status === 'COMPLETED' || apiOrder.status === 'CANCELLED';
  const daysOverdue = !isCompleted && outstandingAmount > 0 ? daysSinceCreated : 0;

  return {
    id: apiOrder.id,
    code: apiOrder.code,
    customerName: apiOrder.customer?.fullName || apiOrder.customer?.companyName || apiOrder.customerId,
    totalAmount,
    paidAmount: depositPaid,
    outstandingAmount,
    status: apiOrder.status,
    dueDate: apiOrder.createdAt, // No explicit dueDate in API, use createdAt as fallback
    daysOverdue,
    createdAt: apiOrder.createdAt,
    commissionStatus: 'PENDING',
    commissionAmount: 0,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const calculateAgingBuckets = (orders: Order[]): AgingBucket[] => {
  const buckets: AgingBucket[] = [
    { range: '0-15 ngày', count: 0, amount: 0, color: '#10B981' },
    { range: '15-30 ngày', count: 0, amount: 0, color: '#F59E0B' },
    { range: '30+ ngày', count: 0, amount: 0, color: '#EF4444' },
  ];

  orders.forEach((order) => {
    if (order.outstandingAmount > 0) {
      if (order.daysOverdue <= 15) {
        buckets[0].count++;
        buckets[0].amount += order.outstandingAmount;
      } else if (order.daysOverdue <= 30) {
        buckets[1].count++;
        buckets[1].amount += order.outstandingAmount;
      } else {
        buckets[2].count++;
        buckets[2].amount += order.outstandingAmount;
      }
    }
  });

  return buckets;
};

// ============================================
// MAIN COMPONENT
// ============================================

export const SalesDashboard: React.FC = () => {
  const { data: ordersResponse, isLoading, isError } = useOrders();
  const orders: Order[] = useMemo(() => {
    const apiOrders = ordersResponse?.data ?? [];
    return apiOrders.map(mapApiOrderToDashboardOrder);
  }, [ordersResponse]);

  const [filters, setFilters] = useState<FilterState>({
    dateRange: { from: '', to: '' },
    customer: '',
    orderStatus: '',
    paymentStatus: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<keyof Order>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // ============================================
  // COMPUTED DATA
  // ============================================

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filters.customer && !order.customerName.toLowerCase().includes(filters.customer.toLowerCase())) {
        return false;
      }
      if (filters.orderStatus && order.status !== filters.orderStatus) {
        return false;
      }
      if (filters.paymentStatus) {
        if (filters.paymentStatus === 'PAID' && order.outstandingAmount > 0) return false;
        if (filters.paymentStatus === 'PARTIAL' && (order.outstandingAmount === 0 || order.paidAmount === 0)) return false;
        if (filters.paymentStatus === 'UNPAID' && order.paidAmount > 0) return false;
      }
      return true;
    });
  }, [orders, filters]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (typeof aVal === 'string') {
        return direction * aVal.localeCompare(bVal as string);
      }
      return direction * ((aVal as number) - (bVal as number));
    });
  }, [filteredOrders, sortField, sortDirection]);

  const kpiData: KPIData = useMemo(() => {
    return {
      totalOrders: filteredOrders.length,
      pendingPayment: filteredOrders.reduce((sum, o) => sum + o.outstandingAmount, 0),
      overdueDebt: filteredOrders
        .filter((o) => o.daysOverdue > 0)
        .reduce((sum, o) => sum + o.outstandingAmount, 0),
      pendingCommission: filteredOrders
        .filter((o) => o.commissionStatus === 'PENDING')
        .reduce((sum, o) => sum + o.commissionAmount, 0),
    };
  }, [filteredOrders]);

  const agingBuckets = useMemo(() => calculateAgingBuckets(filteredOrders), [filteredOrders]);

  const commissionSummary = useMemo(() => {
    const approved = filteredOrders
      .filter((o) => o.commissionStatus === 'APPROVED')
      .reduce((sum, o) => sum + o.commissionAmount, 0);
    const pending = filteredOrders
      .filter((o) => o.commissionStatus === 'PENDING')
      .reduce((sum, o) => sum + o.commissionAmount, 0);
    const paid = filteredOrders
      .filter((o) => o.commissionStatus === 'PAID')
      .reduce((sum, o) => sum + o.commissionAmount, 0);

    return [
      { name: 'Đã duyệt', value: approved, color: '#10B981' },
      { name: 'Chờ duyệt', value: pending, color: '#F59E0B' },
      { name: 'Đã trả', value: paid, color: '#3B82F6' },
    ];
  }, [filteredOrders]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleSort = useCallback((field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const handleExport = useCallback(() => {
    const escapeCSV = (value: string | number): string => {
      let str = String(value);
      // Prevent CSV injection: prefix formula-triggering characters with a single quote
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (/[,"\n\r]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Convert to CSV
    const headers = ['Mã đơn', 'Khách hàng', 'Tổng tiền', 'Đã thanh toán', 'Còn nợ', 'Trạng thái', 'Hạn thanh toán', 'Quá hạn', 'Hoa hồng'];
    const rows = sortedOrders.map((order) => [
      escapeCSV(order.code),
      escapeCSV(order.customerName),
      escapeCSV(order.totalAmount),
      escapeCSV(order.paidAmount),
      escapeCSV(order.outstandingAmount),
      escapeCSV(order.status),
      escapeCSV(formatDate(order.dueDate)),
      escapeCSV(`${order.daysOverdue} ngày`),
      escapeCSV(order.commissionAmount),
    ]);

    const csv = [headers.map(escapeCSV), ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales-dashboard-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, [sortedOrders]);

  const handleRequestPayment = useCallback((orderId: string) => {
    toast.info('Tính năng đang phát triển');
  }, []);

  const handleViewDebt = useCallback((orderId: string) => {
    toast.info('Tính năng đang phát triển');
  }, []);

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <span className="ml-2 text-slate-600">Không thể tải dữ liệu. Vui lòng thử lại sau.</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Dashboard Sales
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Theo dõi đơn hàng, công nợ và hoa hồng của bạn
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Bộ lọc
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Xuất Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="block text-sm font-medium text-slate-700">
                  Khách hàng
                </p>
                <input
                  type="text"
                  value={filters.customer}
                  onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
                  placeholder="Tìm kiếm..."
                  className="mt-1 block w-full rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <p className="block text-sm font-medium text-slate-700">
                  Trạng thái đơn
                </p>
                <select
                  value={filters.orderStatus}
                  onChange={(e) => setFilters({ ...filters, orderStatus: e.target.value })}
                  className="mt-1 block w-full rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Tất cả</option>
                  <option value="SOURCING">Mua hàng</option>
                  <option value="IN_TRANSIT">Vận chuyển</option>
                  <option value="SETTLEMENT">Quyết toán</option>
                  <option value="COMPLETED">Hoàn thành</option>
                </select>
              </div>
              <div>
                <p className="block text-sm font-medium text-slate-700">
                  Trạng thái thanh toán
                </p>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                  className="mt-1 block w-full rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Tất cả</option>
                  <option value="PAID">Đã thanh toán đủ</option>
                  <option value="PARTIAL">Thanh toán một phần</option>
                  <option value="UNPAID">Chưa thanh toán</option>
                </select>
              </div>
              <div>
                <p className="block text-sm font-medium text-slate-700">
                  Từ ngày - Đến ngày
                </p>
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.from}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        dateRange: { ...filters.dateRange, from: e.target.value },
                      })
                    }
                    className="block w-full rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Tổng đơn hàng"
            value={kpiData.totalOrders.toString()}
            icon={<TrendingUp className="h-5 w-5" />}
            color="blue"
          />
          <KPICard
            title="Chờ thanh toán"
            value={formatCurrency(kpiData.pendingPayment)}
            icon={<DollarSign className="h-5 w-5" />}
            color="amber"
          />
          <KPICard
            title="Nợ quá hạn"
            value={formatCurrency(kpiData.overdueDebt)}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="red"
          />
          <KPICard
            title="Hoa hồng chờ duyệt"
            value={formatCurrency(kpiData.pendingCommission)}
            icon={<Clock className="h-5 w-5" />}
            color="green"
          />
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Aging Analysis */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-medium text-slate-900">
              Phân tích tuổi nợ
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agingBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {agingBuckets.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
              {agingBuckets.map((bucket, idx) => (
                <div key={idx}>
                  <div className="font-medium text-slate-900">{bucket.count} đơn</div>
                  <div className="text-xs text-slate-600">{bucket.range}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-medium text-slate-900">
              Tổng hợp hoa hồng
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={commissionSummary}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${formatCurrency(entry.value)}`}
                  labelLine={false}
                >
                  {commissionSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              {commissionSummary.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-700">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-lg font-medium text-slate-900">
              Danh sách đơn hàng ({sortedOrders.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <SortableHeader
                    label="Mã đơn"
                    field="code"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Khách hàng"
                    field="customerName"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Tổng tiền"
                    field="totalAmount"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Còn nợ"
                    field="outstandingAmount"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Quá hạn"
                    field="daysOverdue"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3 font-medium text-slate-700">Hoa hồng</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {order.code}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.customerName}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          order.outstandingAmount === 0
                            ? 'bg-green-100 text-green-800'
                            : order.daysOverdue > 15
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {formatCurrency(order.outstandingAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.daysOverdue > 0 ? (
                        <span className="inline-flex items-center text-red-600">
                          <AlertTriangle className="mr-1 h-4 w-4" />
                          {order.daysOverdue} ngày
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-slate-900">
                          {formatCurrency(order.commissionAmount)}
                        </div>
                        <div
                          className={`text-xs ${
                            order.commissionStatus === 'APPROVED'
                              ? 'text-green-600'
                              : order.commissionStatus === 'PAID'
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {order.commissionStatus === 'APPROVED'
                            ? 'Đã duyệt'
                            : order.commissionStatus === 'PAID'
                            ? 'Đã trả'
                            : 'Chờ duyệt'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRequestPayment(order.id)}
                          className="rounded-md p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                          title="Gửi yêu cầu thanh toán"
                          aria-label="Gui yeu cau thanh toan"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewDebt(order.id)}
                          className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
                          title="Xem công nợ"
                          aria-label="Xem cong no"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'red' | 'green';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-full p-3 ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
};

interface SortableHeaderProps {
  label: string;
  field: keyof Order;
  currentField: keyof Order;
  direction: 'asc' | 'desc';
  onSort: (field: keyof Order) => void;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentField,
  direction,
  onSort,
}) => {
  const isActive = currentField === field;

  return (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-100"
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive &&
          (direction === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </div>
    </th>
  );
};

export default SalesDashboard;
