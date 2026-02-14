# Payment Allocation Form - Documentation

## Tổng quan

Component **PaymentAllocationForm** là form tạo phiếu thu với tính năng bắt buộc phân bổ thanh toán chi tiết, ngăn chặn tình trạng "ví tổng" gây nhập nhằng trong kế toán.

## Tính năng chính

### ✅ Bắt buộc phân bổ chi tiết
- Mọi khoản tiền thu PHẢI được chỉ định rõ vào Hợp đồng hoặc Đơn hàng cụ thể
- Không cho phép tạo phiếu thu mà không có thông tin phân bổ

### ✅ Validation realtime
- Tổng phân bổ PHẢI bằng số tiền thu
- Hiển thị ngay trạng thái khớp/chưa khớp
- Error messages tiếng Việt rõ ràng

### ✅ Dynamic allocation rows
- Thêm/xóa dòng phân bổ linh hoạt
- Tối thiểu 1 dòng (không cho xóa hết)

### ✅ Search dropdown
- Tìm kiếm Hợp đồng theo mã/tiêu đề
- Tìm kiếm Đơn hàng theo mã/tên khách hàng
- Autocomplete với filtering

### ✅ Purpose tracking
- DEPOSIT: Tiền cọc
- SETTLEMENT: Thanh lý hợp đồng/đơn
- INSTALLMENT: Trả góp

## Cấu trúc Component

```
PaymentAllocationForm/
├── PaymentAllocationForm.tsx    (Main component)
├── README.md                     (This file)
└── PaymentAllocationForm.test.tsx (Unit tests - TBD)
```

## Props Interface

```typescript
// Component không nhận props - self-contained form
// Có thể extend để nhận callbacks:

interface PaymentAllocationFormProps {
  onSubmit?: (data: PaymentVoucherFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<PaymentVoucherFormData>;
}
```

## Data Flow

```
User Input
    ↓
Form State (useState)
    ↓
Real-time Validation
    ↓
Allocation Calculation
    ↓
Submit → API Call
    ↓
Success/Error Feedback
```

## Validation Rules

### 1. Số tiền thu
- **Bắt buộc**: Có
- **Minimum**: > 0
- **Format**: Số thực, tối đa 2 chữ số thập phân

### 2. Hình thức thanh toán
- **Bắt buộc**: Có
- **Options**: CASH, BANK_TRANSFER, CREDIT_CARD, E_WALLET

### 3. Người thụ hưởng
- **Bắt buộc**: Có
- **Minimum**: 1 ký tự

### 4. Lý do thu tiền
- **Bắt buộc**: Có
- **Minimum**: 20 ký tự (để đảm bảo mô tả đầy đủ)

### 5. Phân bổ thanh toán
- **Minimum rows**: 1
- **Validation per row**:
  - Target Type: Bắt buộc (CONTRACT hoặc ORDER)
  - Target ID: Bắt buộc (phải chọn từ dropdown)
  - Amount: Bắt buộc, > 0
  - Purpose: Bắt buộc (DEPOSIT, SETTLEMENT, INSTALLMENT)
  - Note: Không bắt buộc

### 6. Tổng phân bổ
- **Rule**: `Σ(allocation.amount) === totalAmount`
- **Error**: "Tổng phân bổ (X) phải bằng số tiền thu (Y)"

## Usage Example

### Basic Usage

```tsx
import { PaymentAllocationForm } from '@/components/finance/PaymentAllocationForm';

function FinancePage() {
  return (
    <div>
      <PaymentAllocationForm />
    </div>
  );
}
```

### With Custom Handlers

```tsx
import { PaymentAllocationForm } from '@/components/finance/PaymentAllocationForm';

function FinancePage() {
  const handleSubmit = async (data) => {
    try {
      await api.createPaymentVoucher(data);
      toast.success('Phiếu thu đã được tạo');
      router.push('/finance/vouchers');
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  return <PaymentAllocationForm onSubmit={handleSubmit} />;
}
```

## API Integration

### Required API Endpoints

1. **GET /contracts** - Lấy danh sách hợp đồng
   ```typescript
   interface ContractResponse {
     id: string;
     code: string;
     title: string;
     totalValue: number;
     paidAmount: number;
     customerId: string;
     customerName: string;
   }
   ```

2. **GET /orders** - Lấy danh sách đơn hàng
   ```typescript
   interface OrderResponse {
     id: string;
     code: string;
     customerId: string;
     customerName: string;
     totalAmount: number;
     depositPaid: number;
     status: string;
   }
   ```

3. **POST /payment-vouchers** - Tạo phiếu thu
   ```typescript
   interface CreatePaymentVoucherRequest {
     amount: number;
     currency: Currency;
     paymentMethod: PaymentMethod;
     beneficiary: string;
     reason: string;
     allocations: Array<{
       targetType: 'CONTRACT' | 'ORDER';
       targetId: string;
       amount: number;
       purposeType: 'DEPOSIT' | 'SETTLEMENT' | 'INSTALLMENT';
       note?: string;
     }>;
   }
   ```

## Error Handling

### Client-side Validation Errors

```typescript
// Displayed inline with red text + AlertCircle icon
errors = {
  amount: "Vui lòng nhập số tiền hợp lệ",
  paymentMethod: "Vui lòng chọn hình thức thanh toán",
  beneficiary: "Vui lòng nhập người thụ hưởng",
  reason: "Lý do phải có tối thiểu 20 ký tự",
  allocations: "Vui lòng điền đầy đủ thông tin phân bổ",
  totalMismatch: "Tổng phân bổ (X) phải bằng số tiền thu (Y)"
}
```

### Server-side Errors

```typescript
try {
  await api.createPaymentVoucher(formData);
} catch (error) {
  if (error.code === 'ALLOCATION_SUM_MISMATCH') {
    setErrors({ totalMismatch: error.message });
  } else if (error.code === 'TARGET_NOT_FOUND') {
    setErrors({ allocations: 'Hợp đồng/Đơn hàng không tồn tại' });
  } else {
    alert('❌ Có lỗi xảy ra khi tạo phiếu thu');
  }
}
```

## Styling & Accessibility

### Design System Compliance
- ✅ Minimalism style (clean, spacious, high contrast)
- ✅ Navy (#1E3A8A) + Gold (#CA8A04) color scheme
- ✅ Fira Sans font family
- ✅ 4.5:1 contrast ratio for all text
- ✅ Smooth transitions (150-300ms)

### Accessibility Features
- ✅ All inputs have `<label>` with `for` attribute
- ✅ Error messages use `role="alert"` (via AlertCircle icon)
- ✅ Required fields marked with `*`
- ✅ Focus states with blue ring (`focus:ring-2 focus:ring-blue-500`)
- ✅ Keyboard navigation support
- ✅ Touch targets minimum 44x44px

### Responsive Design
- ✅ Mobile-first approach
- ✅ Breakpoints: 640px (sm), 768px (md), 1024px (lg)
- ✅ Grid layout adapts: 1 col mobile → 2 cols tablet → flexible desktop
- ✅ Dropdown menus fit mobile viewport

## Performance Optimization

### Memoization
```typescript
// Calculate totals only when allocations change
const totalAllocated = useMemo(
  () => formData.allocations.reduce((sum, row) => sum + parseCurrency(row.amount), 0),
  [formData.allocations]
);
```

### Debounced Search
```typescript
// TODO: Add debounced search for large datasets
const debouncedSearch = useDebounce(searchQuery, 300);
```

### Virtual Scrolling
```typescript
// TODO: For 100+ contracts/orders, use react-window
<VirtualList items={filteredContracts} height={400} itemHeight={60} />
```

## Testing Checklist

### Unit Tests (TBD)
- [ ] Amount validation (empty, negative, zero)
- [ ] Payment method selection
- [ ] Reason minimum length (20 chars)
- [ ] Allocation row add/remove
- [ ] Total allocation calculation
- [ ] Form submission with valid data
- [ ] Form submission with invalid data

### Integration Tests (TBD)
- [ ] API call on form submit
- [ ] Success toast + redirect
- [ ] Error handling + error display
- [ ] Search dropdown filtering
- [ ] Target selection updates row

### E2E Tests (TBD)
- [ ] Complete form flow from empty to submit
- [ ] Add multiple allocation rows
- [ ] Search and select contract
- [ ] Validate total mismatch error
- [ ] Submit and verify API call

## Known Limitations

1. **Mock Data**: Currently uses `mockContracts` and `mockOrders`. Replace with API calls.
2. **No Pagination**: Dropdown shows all results. Add pagination for 100+ items.
3. **No Debounce**: Search triggers filter on every keystroke. Add debounce.
4. **No Attachments**: Missing file upload for supporting documents.
5. **Single Currency**: Only VND supported. Add multi-currency support.

## Future Enhancements

### Phase 2
- [ ] Attachments upload (PDF, images)
- [ ] Multi-currency support
- [ ] Recurring payment templates
- [ ] Bulk import from Excel
- [ ] Print voucher functionality

### Phase 3
- [ ] AI-powered allocation suggestions
- [ ] Auto-match bank transactions
- [ ] Real-time balance updates
- [ ] Mobile app version

## Troubleshooting

### Issue: Dropdown không hiển thị
**Cause**: `targetType` chưa được chọn
**Fix**: Chọn "Loại" trước khi tìm kiếm

### Issue: Không thể submit dù đã điền đủ
**Cause**: Tổng phân bổ ≠ số tiền thu
**Fix**: Kiểm tra "Trạng thái" section, điều chỉnh số tiền

### Issue: Validation không trigger
**Cause**: `validateForm()` chỉ chạy khi submit
**Fix**: Add `onBlur` validation cho từng field

## Support

- **Documentation**: README.md (this file)
- **Code**: `PaymentAllocationForm.tsx`
- **Issues**: Report to dev team
- **Contact**: Tech Lead / Finance Team

---

**Last Updated**: 2026-02-11
**Version**: 1.0.0
**Author**: Claude AI + Dev Team
