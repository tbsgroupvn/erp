# 🎯 NEXT STEPS - Implementation Checklist

## Phase 1: Verification & Setup (Day 1) ⏰ 2-3 hours

### Step 1.1: Verify Backend Structure
```bash
cd D:\ERPv1\tbs-erp-backend

# Check if all files exist
ls src/modules/order/guards/credit-check.guard.ts
ls src/modules/migration/migrate-legacy-ar.script.ts
ls src/modules/commission/services/commission-calculator.service.ts
ls src/modules/commission/listeners/ar-payment.listener.ts
ls prisma/seeds/commission-rules.seed.ts
```

**Expected**: All files should exist ✅

---

### Step 1.2: Install Dependencies & Build
```bash
cd D:\ERPv1\tbs-erp-backend

# Install any missing dependencies
npm install

# Build project
npm run build

# Run tests to verify everything works
npm test
```

**Expected Results**:
- ✅ Build successful (no TypeScript errors)
- ✅ 37+ tests passing
- ⚠️ If tests fail, check:
  - Prisma client generated? Run `npx prisma generate`
  - Database connected? Check `.env` DATABASE_URL

---

### Step 1.3: Verify Frontend Structure
```bash
cd D:\ERPv1\tbs-erp-frontend

# Check if components exist
ls src/components/finance/PaymentAllocationForm.tsx
ls src/components/sales/SalesDashboard.tsx

# Install dependencies
npm install recharts lucide-react

# Build to check for TypeScript errors
npm run build
```

**Expected**: Build successful ✅

---

## Phase 2: Database Setup (Day 1) ⏰ 30 minutes

### Step 2.1: Backup Current Database
```bash
# PostgreSQL backup
pg_dump -U postgres -d tbs_erp > backup_before_migration_$(date +%Y%m%d).sql

# Or use your database tool (pgAdmin, DBeaver, etc.)
```

**⚠️ CRITICAL**: Always backup before migrations!

---

### Step 2.2: Seed Commission Rules
```bash
cd D:\ERPv1\tbs-erp-backend

npx ts-node prisma/seeds/commission-rules.seed.ts
```

**Expected Output**:
```
✅ Seeded 16 commission rules
   - VCT: 4 rules
   - MHH: 4 rules
   - UTXNK: 4 rules
   - LCLCN: 4 rules
```

**Verify in Database**:
```sql
SELECT * FROM "CommissionRule" ORDER BY "serviceType", "minProfit";
```

---

### Step 2.3: Run Migration Script (Dry-Run First)
```bash
cd D:\ERPv1\tbs-erp-backend

# DRY RUN - Preview what will happen (SAFE)
npm run migrate:legacy-ar:dry-run
```

**Expected Output**:
```
============================================================
Migration Preview (DRY RUN)
============================================================
Total orders found:        247
Orders to migrate:         183
Total AR amount:           VND 3,847,500,000

Breakdown:
  OPEN:      121 orders (VND 1,950,000,000)
  OVERDUE:    62 orders (VND 1,897,500,000)

⚠️ This is a DRY RUN. No data has been changed.
Run 'npm run migrate:legacy-ar' to execute.
============================================================
```

**Review carefully!** Check if numbers make sense:
- Are there really that many unpaid orders?
- Do the amounts look correct?

---

### Step 2.4: Execute Migration (If Dry-Run Looks Good)
```bash
# REAL MIGRATION - This will create AR records
npm run migrate:legacy-ar
```

**⚠️ Important**: This will modify your database!

**Expected Output**:
```
============================================================
Migration Complete ✅
============================================================
AR records created:        183
Total amount:              VND 3,847,500,000
Execution time:            12.3s

Rollback file saved to:
  D:\ERPv1\tbs-erp-backend\src\modules\migration\rollback-20260211-143052.json

If something went wrong, run:
  npm run migrate:legacy-ar:rollback
============================================================
```

**Verify in Database**:
```sql
SELECT COUNT(*), SUM(amount)
FROM "AccountReceivable"
WHERE note LIKE '%Migration%';
```

---

### Step 2.5: Verify Commission Setup
```bash
cd D:\ERPv1\tbs-erp-backend

npx ts-node src/modules/commission/scripts/verify-setup.ts
```

**Expected Output**:
```
✅ Database schema check: PASS
✅ Commission rules seeded: PASS (16 rules)
✅ Required indexes exist: PASS
✅ No orphaned commission records: PASS
✅ Rule coverage complete: PASS

System is ready for commission flow! 🎉
```

---

## Phase 3: API Integration (Day 2) ⏰ 4-6 hours

### Problem: Frontend components currently use MOCK DATA

### Step 3.1: Create API Service Layer

**File**: `tbs-erp-frontend/src/services/api.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const contractsApi = {
  search: async (query: string) => {
    const { data } = await api.get('/contracts', { params: { q: query } });
    return data;
  },
};

export const ordersApi = {
  search: async (query: string) => {
    const { data } = await api.get('/orders', { params: { q: query } });
    return data;
  },
  getSalesDashboard: async (saleId?: string) => {
    const { data } = await api.get('/orders/sales/dashboard', {
      params: { saleId },
    });
    return data;
  },
  requestPayment: async (orderId: string) => {
    const { data } = await api.post(`/orders/${orderId}/request-payment`);
    return data;
  },
};

export const paymentVouchersApi = {
  create: async (payload: any) => {
    const { data } = await api.post('/payment-vouchers', payload);
    return data;
  },
};

export const customersApi = {
  getDebt: async (customerId: string) => {
    const { data } = await api.get(`/customers/${customerId}/debt`);
    return data;
  },
};

export default api;
```

---

### Step 3.2: Update PaymentAllocationForm to Use Real API

**File**: `tbs-erp-frontend/src/components/finance/PaymentAllocationForm.tsx`

Find this section (around line 65):
```typescript
// ============================================
// MOCK DATA (Replace with API calls)
// ============================================

const mockContracts: ContractOption[] = [
  // ... mock data
];
```

Replace with:
```typescript
// ============================================
// API DATA
// ============================================

import { contractsApi, ordersApi, paymentVouchersApi } from '@/services/api';

// Inside component:
const [contracts, setContracts] = useState<ContractOption[]>([]);
const [orders, setOrders] = useState<OrderOption[]>([]);
const [isLoadingTargets, setIsLoadingTargets] = useState(false);

// Add useEffect to fetch data
useEffect(() => {
  const fetchTargets = async () => {
    setIsLoadingTargets(true);
    try {
      const [contractsData, ordersData] = await Promise.all([
        contractsApi.search(''),
        ordersApi.search(''),
      ]);
      setContracts(contractsData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      alert('Không thể tải danh sách hợp đồng/đơn hàng');
    } finally {
      setIsLoadingTargets(false);
    }
  };

  fetchTargets();
}, []);

// Update handleSubmit to use API
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) return;

  setIsSubmitting(true);

  try {
    await paymentVouchersApi.create({
      type: 'RECEIPT',
      amount: parseCurrency(formData.amount),
      currency: formData.currency,
      paymentMethod: formData.paymentMethod,
      beneficiary: formData.beneficiary,
      reason: formData.reason,
      allocations: formData.allocations.map(row => ({
        targetType: row.targetType,
        targetId: row.targetId,
        amount: parseCurrency(row.amount),
        purposeType: row.purposeType,
        note: row.note,
      })),
    });

    alert('✅ Phiếu thu đã được tạo thành công!');
    // Redirect or reset form
    window.location.href = '/finance/payment-vouchers';
  } catch (error: any) {
    console.error('Submit error:', error);
    if (error.response?.data?.message) {
      alert(`❌ ${error.response.data.message}`);
    } else {
      alert('❌ Có lỗi xảy ra khi tạo phiếu thu');
    }
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### Step 3.3: Update SalesDashboard to Use Real API

**File**: `tbs-erp-frontend/src/components/sales/SalesDashboard.tsx`

Find this section (around line 85):
```typescript
const mockOrders: Order[] = [
  // ... mock data
];
```

Replace with:
```typescript
import { ordersApi, customersApi } from '@/services/api';
import { useCurrentUser } from '@/hooks/useAuth'; // Assuming you have this

// Inside component:
const user = useCurrentUser();
const [orders, setOrders] = useState<Order[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await ordersApi.getSalesDashboard(user.id);
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      alert('Không thể tải dữ liệu dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  fetchOrders();
}, [user.id]);

// Update action handlers
const handleRequestPayment = async (orderId: string) => {
  try {
    await ordersApi.requestPayment(orderId);
    alert('✅ Đã gửi yêu cầu thanh toán');
    // Optionally refresh data
  } catch (error) {
    alert('❌ Không thể gửi yêu cầu');
  }
};

const handleViewDebt = async (orderId: string) => {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  try {
    const debtData = await customersApi.getDebt(order.customerId);
    // Show in modal or navigate to detail page
    console.log('Customer debt:', debtData);
    // TODO: Implement modal or navigation
  } catch (error) {
    alert('❌ Không thể tải thông tin công nợ');
  }
};
```

---

### Step 3.4: Create Missing Backend Endpoints

You need these API endpoints in your backend:

**File**: `tbs-erp-backend/src/modules/order/order.controller.ts`

```typescript
@Get('sales/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
async getSalesDashboard(
  @CurrentUser() user: User,
  @Query('saleId') saleId?: string,
) {
  const targetSaleId = saleId || user.id;

  // Verify user can access this sale's data
  if (saleId && user.role !== 'ADMIN' && user.id !== saleId) {
    throw new ForbiddenException('Không có quyền xem dashboard của sale khác');
  }

  const orders = await this.orderService.findBySale(targetSaleId);

  // Calculate commission status for each order
  const ordersWithCommission = await Promise.all(
    orders.map(async (order) => {
      const commission = await this.prisma.commissionRecord.findFirst({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
      });

      const receivables = await this.prisma.accountReceivable.findMany({
        where: { orderId: order.id, status: { in: ['OPEN', 'PARTIAL'] } },
      });

      const outstandingAmount = receivables.reduce(
        (sum, ar) => sum + Number(ar.amount) - Number(ar.paidAmount),
        0,
      );

      const daysOverdue = receivables.length > 0
        ? Math.max(
            ...receivables.map((ar) =>
              Math.floor(
                (Date.now() - ar.dueDate.getTime()) / (1000 * 60 * 60 * 24),
              ),
            ),
          )
        : 0;

      return {
        id: order.id,
        code: order.code,
        customerName: order.customer.fullName,
        totalAmount: Number(order.totalAmount),
        paidAmount: Number(order.totalAmount) - outstandingAmount,
        outstandingAmount,
        status: order.status,
        dueDate: receivables[0]?.dueDate || null,
        daysOverdue: Math.max(0, daysOverdue),
        createdAt: order.createdAt,
        commissionStatus: commission?.status || 'PENDING',
        commissionAmount: commission ? Number(commission.commissionAmount) : 0,
      };
    }),
  );

  return ordersWithCommission;
}

@Post(':id/request-payment')
@UseGuards(JwtAuthGuard)
async requestPayment(
  @Param('id') orderId: string,
  @CurrentUser() user: User,
) {
  const order = await this.orderService.findOne(orderId);

  if (!order) {
    throw new NotFoundException('Order not found');
  }

  // Send notification to customer
  await this.eventEmitter.emit('payment.request', {
    orderId,
    customerId: order.customerId,
    requestedBy: user.id,
    amount: order.outstandingAmount,
  });

  return { success: true, message: 'Đã gửi yêu cầu thanh toán' };
}
```

**File**: `tbs-erp-backend/src/modules/crm/crm.controller.ts`

```typescript
@Get(':id/debt')
@UseGuards(JwtAuthGuard)
async getCustomerDebt(@Param('id') customerId: string) {
  const receivables = await this.prisma.accountReceivable.findMany({
    where: {
      customerId,
      status: { in: ['OPEN', 'PARTIAL'] },
    },
    include: {
      order: {
        select: { id: true, code: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  const totalDebt = receivables.reduce(
    (sum, ar) => sum + Number(ar.amount) - Number(ar.paidAmount),
    0,
  );

  const overdueDebt = receivables
    .filter((ar) => ar.dueDate < new Date())
    .reduce((sum, ar) => sum + Number(ar.amount) - Number(ar.paidAmount), 0);

  return {
    customerId,
    totalDebt,
    overdueDebt,
    receivables: receivables.map((ar) => ({
      orderId: ar.orderId,
      orderCode: ar.order?.code,
      amount: Number(ar.amount) - Number(ar.paidAmount),
      dueDate: ar.dueDate,
      daysOverdue: Math.max(
        0,
        Math.floor((Date.now() - ar.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      ),
    })),
  };
}
```

---

## Phase 4: Testing (Day 3) ⏰ 4-6 hours

### Step 4.1: Backend Unit Tests
```bash
cd D:\ERPv1\tbs-erp-backend

# Run all tests
npm test

# Run specific test suites
npm test credit-check.guard
npm test commission-calculator
npm test migrate-legacy-ar
```

**Expected**: All tests pass ✅

---

### Step 4.2: Backend E2E Tests
```bash
# Run E2E tests
npm run test:e2e

# Specific E2E test
npm run test:e2e order-credit-check
```

---

### Step 4.3: Manual Testing Scenarios

#### Scenario 1: Credit Check Blocks Order Creation
1. Create a customer with overdue debt
2. Try to create new order for that customer
3. **Expected**: Error message "Khách hàng có công nợ quá hạn..."

#### Scenario 2: Payment Allocation Form
1. Open form at `/finance/payment-allocation`
2. Enter amount: 50,000,000 VND
3. Add allocation row: Contract ABC - 30,000,000 VND
4. Add allocation row: Order XYZ - 20,000,000 VND
5. **Expected**: Status shows "Phân bổ chính xác ✅"
6. Submit form
7. **Expected**: Success message + redirect

#### Scenario 3: Commission Auto-Approval
1. Create an order (status = PENDING)
2. Complete order (change status to COMPLETED)
3. **Check database**: CommissionRecord created with status=PENDING
4. Record AR payment (mark as fully paid)
5. **Check database**: CommissionRecord status changed to APPROVED
6. **Check**: approvedBy = 'SYSTEM_AUTO'

#### Scenario 4: Sales Dashboard
1. Open dashboard at `/sales/dashboard`
2. **Check**: KPI cards show correct numbers
3. Apply filter: Customer name
4. **Check**: Table updates correctly
5. Click "Request Payment" button
6. **Check**: Notification sent
7. Click "Export" button
8. **Check**: CSV file downloads

---

## Phase 5: Staging Deployment (Day 4) ⏰ 2-3 hours

### Step 5.1: Prepare Staging Environment
```bash
# Staging server (replace with your server)
ssh user@staging.tbslogistics.com

# Create directory
mkdir -p /var/www/tbs-erp
cd /var/www/tbs-erp
```

---

### Step 5.2: Deploy Backend to Staging
```bash
# On local machine
cd D:\ERPv1\tbs-erp-backend

# Build
npm run build

# Upload to staging (using scp or git)
git push staging main

# On staging server
cd /var/www/tbs-erp/backend
npm install --production
npx prisma migrate deploy
npx prisma generate

# Seed commission rules
npx ts-node prisma/seeds/commission-rules.seed.ts

# Run migration
npm run migrate:legacy-ar:dry-run  # Preview first
npm run migrate:legacy-ar          # Execute

# Restart service
pm2 restart tbs-erp-backend
# or
systemctl restart tbs-erp-backend
```

---

### Step 5.3: Deploy Frontend to Staging
```bash
# On local machine
cd D:\ERPv1\tbs-erp-frontend

# Build
npm run build

# Upload to staging
git push staging main

# On staging server
cd /var/www/tbs-erp/frontend
npm install --production
npm run build

# Restart service
pm2 restart tbs-erp-frontend
# or
systemctl restart tbs-erp-frontend
```

---

### Step 5.4: Verify Staging Deployment
```bash
# Check backend health
curl https://staging-api.tbslogistics.com/health

# Check frontend
curl https://staging.tbslogistics.com

# Test API endpoints
curl -H "Authorization: Bearer <token>" \
  https://staging-api.tbslogistics.com/orders/sales/dashboard
```

---

## Phase 6: User Training (Day 5) ⏰ 3-4 hours

### Step 6.1: Prepare Training Materials

**Create**: `TRAINING_GUIDE.md`

### Session 1: Kế toán (Tuyết) - 1 hour
**Topics**:
- Payment Allocation Form walkthrough
- How to create payment voucher with allocations
- Validation rules explained
- Common error messages and solutions

**Demo**:
1. Show form on staging
2. Create sample payment voucher
3. Handle validation errors
4. Submit successfully

---

### Session 2: Sales Team - 1 hour
**Topics**:
- Sales Dashboard overview
- KPI cards explanation
- How to filter and sort orders
- Request payment button
- View customer debt
- Export to Excel

**Demo**:
1. Show dashboard with live data
2. Apply filters
3. Sort columns
4. Use action buttons
5. Export report

---

### Session 3: Sales Leaders - 30 minutes
**Topics**:
- Credit check policy explanation
- How credit check works
- When orders are blocked
- Approval process for exceptions

**Demo**:
1. Show blocked order scenario
2. Explain error message
3. Show how to grant exceptions

---

### Session 4: Q&A for All - 30 minutes
**Topics**:
- Open questions
- Edge cases discussion
- Feedback collection

---

## Phase 7: Production Deployment (Day 6-7) ⏰ 4-6 hours

### Step 7.1: Pre-Deployment Checklist

**Critical checks before production**:
- [ ] All staging tests passed
- [ ] Database backup completed
- [ ] Rollback plan documented
- [ ] User training completed
- [ ] Stakeholders notified (CEO, CFO, IT Manager)
- [ ] Deployment window scheduled (low traffic time)

---

### Step 7.2: Production Deployment

**Recommended time**: Friday 6 PM or Saturday morning (low traffic)

```bash
# 1. Backup production database
pg_dump -U postgres -d tbs_erp_prod > backup_prod_$(date +%Y%m%d_%H%M).sql

# 2. Deploy backend
ssh user@prod.tbslogistics.com
cd /var/www/tbs-erp/backend
git pull origin main
npm install --production
npm run build
npx prisma migrate deploy

# 3. Seed commission rules (if not already done)
npx ts-node prisma/seeds/commission-rules.seed.ts

# 4. Run migration script
npm run migrate:legacy-ar:dry-run  # Verify numbers match expectation
npm run migrate:legacy-ar          # Execute

# 5. Restart backend
pm2 restart tbs-erp-backend

# 6. Deploy frontend
cd /var/www/tbs-erp/frontend
git pull origin main
npm install --production
npm run build
pm2 restart tbs-erp-frontend

# 7. Verify deployment
curl https://api.tbslogistics.com/health
curl https://app.tbslogistics.com
```

---

### Step 7.3: Post-Deployment Monitoring (24 hours)

**Monitor these metrics**:
- [ ] API error rate (should be <1%)
- [ ] Response time (should be <500ms)
- [ ] Database query performance
- [ ] User complaints/support tickets
- [ ] Commission auto-approval working
- [ ] Credit check blocking correctly

**Tools**:
- Application logs (`tail -f /var/log/tbs-erp/backend.log`)
- Database query logs
- APM tool (e.g., New Relic, Datadog)
- User feedback channel (Slack, email)

---

### Step 7.4: Hotfix Plan (If Issues Arise)

**If critical bug found**:
1. **Assess severity**:
   - P0 (Critical): Blocks all users → Immediate rollback
   - P1 (High): Blocks some features → Hotfix within 2 hours
   - P2 (Medium): Minor issues → Fix in next release

2. **Rollback procedure**:
```bash
# Rollback database migration
cd /var/www/tbs-erp/backend
npm run migrate:legacy-ar:rollback

# Rollback code
git checkout <previous-commit>
npm run build
pm2 restart all

# Verify rollback successful
curl https://api.tbslogistics.com/health
```

3. **Communicate**:
   - Notify all users via email/Slack
   - Explain issue and timeline for fix
   - Provide workaround if available

---

## Phase 8: Post-Launch (Week 2+) ⏰ Ongoing

### Step 8.1: Collect User Feedback

**Create feedback form**:
- Google Form or internal survey
- Questions:
  - Ease of use (1-5 stars)
  - Feature completeness
  - Bugs encountered
  - Suggestions for improvement

**Schedule**:
- Week 1 feedback: Quick survey
- Week 2 feedback: Detailed interview
- Month 1 feedback: Full retrospective

---

### Step 8.2: Performance Tuning

**Monitor and optimize**:
- Slow queries (use `EXPLAIN ANALYZE`)
- API endpoints taking >1s
- Frontend bundle size (use Webpack Bundle Analyzer)
- Database indexes (add if needed)

**Example optimization**:
```sql
-- Add index for common queries
CREATE INDEX idx_orders_sale_status
ON "Order" ("saleId", "status");

CREATE INDEX idx_ar_customer_status
ON "AccountReceivable" ("customerId", "status");
```

---

### Step 8.3: Feature Enhancements (Backlog)

**Based on feedback, prioritize**:
1. **High priority**:
   - Mobile app for Sales Dashboard
   - WhatsApp notifications for overdue
   - AI allocation suggestions

2. **Medium priority**:
   - Bulk import payment vouchers
   - Commission rule builder UI
   - Advanced filters

3. **Low priority**:
   - Dark mode
   - Custom dashboard widgets
   - Blockchain audit trail

---

## 📊 Success Metrics to Track

### Month 1 Goals
- [ ] 90% user adoption rate (Sales using dashboard daily)
- [ ] 80% reduction in "đơn treo" (pending orders)
- [ ] Zero critical bugs reported
- [ ] <5% payment allocation errors

### Month 3 Goals
- [ ] 95% reduction in manual reconciliation time
- [ ] 50% reduction in DSO (Days Sales Outstanding)
- [ ] 100% commission records accurate
- [ ] Positive ROI (savings > implementation cost)

### Month 6 Goals (From IMPLEMENTATION_COMPLETE_SUMMARY.md)
- [ ] 95% reduction in reconciliation time
- [ ] 83% reduction in pending orders
- [ ] 99% accuracy in financial reporting
- [ ] 44% reduction in DSO
- [ ] 70% reduction in overdue debt

---

## 🆘 Support & Escalation

### L1 Support (First Response)
- **Who**: IT Support team
- **Handles**: Basic questions, password resets, how-to
- **SLA**: Respond within 1 hour

### L2 Support (Technical Issues)
- **Who**: Backend/Frontend developers
- **Handles**: Bugs, errors, performance issues
- **SLA**: Resolve within 4 hours (business hours)

### L3 Support (Critical Escalation)
- **Who**: Tech Lead / CTO
- **Handles**: System down, data loss, security breach
- **SLA**: Immediate response (24/7 on-call)

**Escalation Path**:
1. User reports issue → L1 Support (Slack/Email)
2. L1 can't resolve → Escalate to L2 (Ticket system)
3. L2 can't resolve → Escalate to L3 (Phone call)

---

## 📞 Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Tech Lead | [Name] | [Phone] | [Email] |
| Backend Dev | [Name] | [Phone] | [Email] |
| Frontend Dev | [Name] | [Phone] | [Email] |
| Database Admin | [Name] | [Phone] | [Email] |
| Product Owner | [Name] | [Phone] | [Email] |

---

## ✅ Final Checklist

Before marking project as "COMPLETE":
- [ ] All 5 tasks implemented and tested
- [ ] Backend deployed to production
- [ ] Frontend deployed to production
- [ ] Database migrated successfully
- [ ] Users trained and onboarded
- [ ] Documentation delivered
- [ ] Support plan established
- [ ] Success metrics tracking set up
- [ ] Stakeholders signed off

---

**Last Updated**: 2026-02-11
**Status**: Ready for Phase 1 execution
**Next Action**: Run Step 1.1 (Verification)
