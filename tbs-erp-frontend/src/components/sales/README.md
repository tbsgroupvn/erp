# Sales Dashboard - Documentation

## Tổng quan

Component **SalesDashboard** là dashboard toàn diện cho Sales tracking đơn hàng, công nợ khách hàng và tình trạng hoa hồng theo thời gian thực.

## Tính năng chính

### ✅ Real-time KPI Cards
- **Tổng đơn hàng**: Số lượng đơn hiện tại
- **Chờ thanh toán**: Tổng công nợ phải thu
- **Nợ quá hạn**: Công nợ đã qua hạn thanh toán
- **Hoa hồng chờ duyệt**: Hoa hồng pending chờ khách thanh toán

### ✅ Orders Table
- Danh sách đơn hàng với payment status
- Sortable columns (click header để sort)
- Payment status badges (màu xanh/vàng/đỏ)
- Action buttons per row:
  - **Send**: Gửi yêu cầu thanh toán
  - **Eye**: Xem chi tiết công nợ

### ✅ Aging Analysis Widget
- Bar chart phân tích tuổi nợ
- 3 buckets: 0-15 ngày, 15-30 ngày, 30+ ngày
- Màu mã: Xanh (OK), Vàng (Warning), Đỏ (Critical)
- Hiển thị số đơn + tổng tiền mỗi bucket

### ✅ Commission Summary
- Pie chart tổng hợp hoa hồng
- 3 trạng thái:
  - **Đã duyệt** (Xanh): Đơn đã thanh toán đủ
  - **Chờ duyệt** (Vàng): Đơn chưa thanh toán hoặc thiếu
  - **Đã trả** (Xanh dương): Hoa hồng đã được chi trả

### ✅ Advanced Filters
- Filter by customer (search)
- Filter by order status
- Filter by payment status
- Date range picker

### ✅ Export to Excel
- Export filtered data to CSV
- Vietnamese column headers
- UTF-8 BOM encoding

## Cấu trúc Component

```
SalesDashboard/
├── SalesDashboard.tsx            (Main component)
├── README.md                     (This file)
└── SalesDashboard.test.tsx       (Unit tests - TBD)
```

## Props Interface

```typescript
// Component không nhận props - self-contained dashboard
// Có thể extend để nhận configs:

interface SalesDashboardProps {
  saleId?: string;          // Filter for specific sale
  autoRefresh?: boolean;    // Enable auto-refresh
  refreshInterval?: number; // Refresh interval in ms
}
```

## Data Flow

```
Component Mount
    ↓
Fetch Orders (API)
    ↓
Apply Filters
    ↓
Calculate KPIs & Charts
    ↓
Render Dashboard
    ↓
User Interaction (Filter/Sort/Action)
    ↓
Re-calculate & Re-render
```

## KPI Calculation Logic

### 1. Tổng đơn hàng
```typescript
totalOrders = filteredOrders.length
```

### 2. Chờ thanh toán
```typescript
pendingPayment = Σ(order.outstandingAmount) for all orders
```

### 3. Nợ quá hạn
```typescript
overdueDebt = Σ(order.outstandingAmount)
  where order.daysOverdue > 0
```

### 4. Hoa hồng chờ duyệt
```typescript
pendingCommission = Σ(order.commissionAmount)
  where order.commissionStatus === 'PENDING'
```

## Aging Analysis Buckets

```typescript
// Bucket 1: 0-15 ngày (Xanh - OK)
orders.filter(o => o.daysOverdue >= 0 && o.daysOverdue <= 15)

// Bucket 2: 15-30 ngày (Vàng - Warning)
orders.filter(o => o.daysOverdue > 15 && o.daysOverdue <= 30)

// Bucket 3: 30+ ngày (Đỏ - Critical)
orders.filter(o => o.daysOverdue > 30)
```

## Commission Status Logic

```typescript
// PENDING: Đơn chưa thanh toán đủ
commissionStatus = 'PENDING'
  if order.outstandingAmount > 0

// APPROVED: Đơn đã thanh toán đủ, chờ xuất lương
commissionStatus = 'APPROVED'
  if order.outstandingAmount === 0 && not yet paid

// PAID: Hoa hồng đã được chi trả
commissionStatus = 'PAID'
  if already paid to sale
```

## Usage Example

### Basic Usage

```tsx
import { SalesDashboard } from '@/components/sales/SalesDashboard';

function SalesPage() {
  return (
    <div>
      <SalesDashboard />
    </div>
  );
}
```

### With Sale Filter

```tsx
import { SalesDashboard } from '@/components/sales/SalesDashboard';
import { useCurrentUser } from '@/hooks/useAuth';

function MySalesPage() {
  const user = useCurrentUser();

  return (
    <SalesDashboard saleId={user.id} />
  );
}
```

### With Auto-Refresh

```tsx
import { SalesDashboard } from '@/components/sales/SalesDashboard';

function LiveDashboard() {
  return (
    <SalesDashboard
      autoRefresh={true}
      refreshInterval={30000} // 30 seconds
    />
  );
}
```

## API Integration

### Required API Endpoints

1. **GET /orders/sales/:saleId** - Lấy đơn hàng của Sale
   ```typescript
   interface OrderResponse {
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
   ```

2. **POST /orders/:orderId/request-payment** - Gửi yêu cầu thanh toán
   ```typescript
   interface RequestPaymentRequest {
     orderId: string;
     message?: string;
   }
   ```

3. **GET /customers/:customerId/debt** - Xem chi tiết công nợ
   ```typescript
   interface CustomerDebtResponse {
     customerId: string;
     totalDebt: number;
     overdueDebt: number;
     receivables: Array<{
       orderId: string;
       amount: number;
       dueDate: string;
       daysOverdue: number;
     }>;
   }
   ```

## Filter Logic

### Customer Filter
```typescript
// Case-insensitive substring match
orders.filter(o =>
  o.customerName.toLowerCase().includes(filter.customer.toLowerCase())
)
```

### Order Status Filter
```typescript
// Exact match
orders.filter(o => o.status === filter.orderStatus)
```

### Payment Status Filter
```typescript
// PAID: Đã thanh toán đủ
orders.filter(o => o.outstandingAmount === 0)

// PARTIAL: Thanh toán một phần
orders.filter(o =>
  o.outstandingAmount > 0 && o.paidAmount > 0
)

// UNPAID: Chưa thanh toán
orders.filter(o => o.paidAmount === 0)
```

### Date Range Filter (TBD)
```typescript
// Filter by createdAt
orders.filter(o =>
  new Date(o.createdAt) >= filter.dateRange.from &&
  new Date(o.createdAt) <= filter.dateRange.to
)
```

## Sorting Logic

```typescript
// Click column header to toggle sort
// Default: Sort by createdAt DESC (newest first)

// String sorting
if (typeof aVal === 'string') {
  return direction * aVal.localeCompare(bVal);
}

// Number sorting
return direction * (aVal - bVal);
```

## Export to Excel

```typescript
// Generate CSV with UTF-8 BOM
const csv = [headers, ...rows]
  .map(row => row.join(','))
  .join('\n');

const blob = new Blob(['\uFEFF' + csv], {
  type: 'text/csv;charset=utf-8;'
});

// Trigger download
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = `sales-dashboard-${date}.csv`;
link.click();
```

## Chart Libraries

### Recharts (Currently Used)
```bash
npm install recharts
```

Pros:
- ✅ React-friendly, declarative API
- ✅ Responsive by default
- ✅ Good TypeScript support
- ✅ Lightweight (40kb gzipped)

Cons:
- ❌ Limited animation options
- ❌ No 3D charts

### Alternative: Chart.js
```bash
npm install react-chartjs-2 chart.js
```

Pros:
- ✅ More chart types
- ✅ Better animations
- ✅ Active community

Cons:
- ❌ Imperative API (less React-ish)
- ❌ Heavier bundle (60kb)

## Styling & Accessibility

### Design System Compliance
- ✅ Minimalism style (clean, grid-based)
- ✅ Navy (#1E3A8A) + Gold (#CA8A04) accents
- ✅ Fira Sans font family
- ✅ 4.5:1 contrast ratio for all text
- ✅ Smooth transitions (150-300ms)

### Accessibility Features
- ✅ All buttons have `aria-label` or visible text
- ✅ Icon buttons have `title` attribute
- ✅ Focus states with blue ring
- ✅ Color is not the only indicator (badges have text)
- ✅ Table headers use semantic `<th>`
- ✅ Touch targets minimum 44x44px

### Responsive Design
- ✅ Mobile-first approach
- ✅ Breakpoints: 640px (sm), 768px (md), 1024px (lg)
- ✅ KPI cards: 1 col mobile → 2 cols tablet → 4 cols desktop
- ✅ Charts: Full width mobile, 2 cols desktop
- ✅ Table: Horizontal scroll on mobile

## Performance Optimization

### Memoization
```typescript
// Recalculate only when filters change
const filteredOrders = useMemo(() => {
  return orders.filter(/* ... */);
}, [orders, filters]);

const kpiData = useMemo(() => {
  return calculateKPIs(filteredOrders);
}, [filteredOrders]);
```

### Virtual Scrolling (TBD)
```typescript
// For 1000+ orders, use react-window
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={orders.length}
  itemSize={60}
  width="100%"
>
  {OrderRow}
</FixedSizeList>
```

### Pagination (TBD)
```typescript
// Instead of showing all orders, paginate
const [page, setPage] = useState(1);
const pageSize = 20;

const paginatedOrders = sortedOrders.slice(
  (page - 1) * pageSize,
  page * pageSize
);
```

## Testing Checklist

### Unit Tests (TBD)
- [ ] KPI calculation logic
- [ ] Aging bucket calculation
- [ ] Commission summary calculation
- [ ] Filter logic (customer, status, payment)
- [ ] Sort logic (asc/desc toggle)
- [ ] Currency formatting
- [ ] Date formatting

### Integration Tests (TBD)
- [ ] API calls on mount
- [ ] Filter updates trigger re-render
- [ ] Sort toggle updates order
- [ ] Export generates correct CSV
- [ ] Action buttons call correct APIs

### E2E Tests (TBD)
- [ ] Load dashboard with data
- [ ] Apply filters and verify results
- [ ] Sort table columns
- [ ] Click "Request Payment" button
- [ ] Click "View Debt" button
- [ ] Export to Excel and download file

## Known Limitations

1. **Mock Data**: Currently uses `mockOrders`. Replace with API calls.
2. **No Real-time Updates**: No WebSocket/polling. Add auto-refresh.
3. **No Pagination**: Shows all orders at once. Add pagination for 1000+.
4. **Limited Date Range**: Date range filter not fully implemented.
5. **No Multi-sale View**: Admin can't see all sales' dashboards.

## Future Enhancements

### Phase 2
- [ ] Real-time updates via WebSocket
- [ ] Pagination for large datasets
- [ ] Advanced filters (multiple customers, date range)
- [ ] Save filter presets
- [ ] Print dashboard report

### Phase 3
- [ ] Predictive analytics (AI forecasting)
- [ ] Custom KPI builder
- [ ] Team leaderboard
- [ ] Mobile app version
- [ ] Push notifications for overdue

## Troubleshooting

### Issue: Charts không hiển thị
**Cause**: Recharts chưa được cài đặt
**Fix**: `npm install recharts`

### Issue: KPI numbers sai
**Cause**: Filter logic không match với backend
**Fix**: Kiểm tra filter logic, đảm bảo sync với API

### Issue: Export file không có dấu tiếng Việt
**Cause**: Thiếu UTF-8 BOM
**Fix**: Đã fix với `\uFEFF` prefix

### Issue: Table quá rộng trên mobile
**Cause**: Nhiều cột
**Fix**: Đã thêm `overflow-x-auto`

## Performance Metrics

### Target Metrics
- **Initial Load**: < 2s
- **Filter Apply**: < 200ms
- **Sort Toggle**: < 100ms
- **Chart Render**: < 500ms
- **Export**: < 1s for 1000 orders

### Optimization Tips
1. Use `useMemo` for expensive calculations
2. Lazy load charts (code splitting)
3. Debounce search input (300ms)
4. Virtual scroll for 1000+ rows
5. Paginate instead of showing all

## Support

- **Documentation**: README.md (this file)
- **Code**: `SalesDashboard.tsx`
- **Issues**: Report to dev team
- **Contact**: Tech Lead / Sales Team

---

**Last Updated**: 2026-02-11
**Version**: 1.0.0
**Author**: Claude AI + Dev Team
