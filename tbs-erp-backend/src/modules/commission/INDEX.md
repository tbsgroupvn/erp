# Commission Flow Module - Quick Index

## 📚 Documentation Files

### 1. README.md
**Comprehensive module documentation**
- Architecture overview
- Commission calculation logic
- Event system details
- Database schema
- API endpoints
- Usage examples
- Troubleshooting guide

👉 **Start here** for detailed understanding of the commission system.

### 2. IMPLEMENTATION_GUIDE.md
**Quick start and implementation guide**
- Quick start steps
- File structure explanation
- Flow diagrams
- Testing instructions
- API documentation
- Monitoring guidelines
- Performance tips

👉 **Use this** for implementing or extending the commission flow.

### 3. DEPLOYMENT_CHECKLIST.md
**Pre/post-deployment verification**
- Pre-deployment checklist
- Build and deployment steps
- Testing procedures
- Monitoring setup
- Rollback plan
- Sign-off template

👉 **Use this** before deploying to production.

### 4. TASK_4_SUMMARY.md
**Implementation summary and technical details**
- Files created/modified
- Technical implementation
- Event flow
- Testing strategy
- Success criteria
- Known limitations

👉 **Read this** to understand what was implemented.

## 🗂️ Code Structure

### Services
```
services/
├── commission-calculator.service.ts       # Core calculation logic
└── commission-calculator.service.spec.ts  # Unit tests
```

**CommissionCalculatorService**: Calculates commission based on profit margins using tiered rules.

### Listeners
```
listeners/
├── order-completed.listener.ts   # Creates PENDING commission on order completion
└── ar-payment.listener.ts        # Auto-approves on AR full payment
```

**OrderCompletedListener**: Listens to `order.status.changed` (COMPLETED).
**ArPaymentListener**: Listens to `ar.payment.recorded` (isFullyPaid=true).

### DTOs
```
dto/
├── commission-events.dto.ts        # Event payload interfaces
├── create-commission-rule.dto.ts   # Rule creation DTO
└── commission-query.dto.ts         # Query DTOs
```

### Scripts
```
scripts/
└── verify-setup.ts  # Verification script to check setup
```

**verify-setup.ts**: Runs checks to ensure commission flow is properly configured.

## 🚀 Quick Start

### Step 1: Seed Commission Rules
```bash
npx ts-node prisma/seeds/commission-rules.seed.ts
```

### Step 2: Verify Setup
```bash
npx ts-node src/modules/commission/scripts/verify-setup.ts
```

### Step 3: Test the Flow
1. Create an order
2. Add cost allocations
3. Complete the order (status → COMPLETED)
4. Check logs for "Commission PENDING created"
5. Record AR payment (full amount)
6. Check logs for "Commission auto-approved"

## 🎯 Key Features

✅ **Automatic Calculation**: Commission calculated when order is COMPLETED
✅ **Tiered Rates**: Higher profits earn higher commission rates
✅ **Auto-Approval**: Commission approved when AR is fully paid
✅ **Event-Driven**: Non-blocking event system for scalability
✅ **Error Handling**: Comprehensive error handling and logging
✅ **Type Safety**: Full TypeScript support with interfaces

## 📊 Commission Flow

```
Order → COMPLETED → Commission PENDING → AR Paid → Commission APPROVED → Manual Pay → PAID
```

### Events
- `order.status.changed` → Creates PENDING commission
- `ar.payment.recorded` → Auto-approves commission
- `commission.pending` → Emitted when commission created
- `commission.approved` → Emitted when auto-approved

## 🔧 Configuration

No additional environment variables needed. Uses:
- **Prisma**: Database access
- **EventEmitter2**: Event handling (configured in AppModule)

## 📈 Commission Tiers (Example)

### VCT (Vận chuyển thuần)
- 0-5M VND → 2%
- 5M-15M VND → 4%
- 15M-30M VND → 6%
- 30M+ VND → 8%

### MHH (Mua hàng hộ)
- 0-10M VND → 3%
- 10M-30M VND → 5%
- 30M-60M VND → 7%
- 60M+ VND → 10%

_See seed script for complete tiers_

## 🛠️ Common Tasks

### View Commission Rules
```bash
curl http://localhost:3000/commission/rules
```

### Check My Commissions (Sale Person)
```bash
curl http://localhost:3000/commission/my?startDate=2026-01-01&endDate=2026-01-31 \
  -H "Authorization: Bearer <token>"
```

### Monthly Report (Admin/Finance)
```bash
curl http://localhost:3000/commission/monthly/2026/1 \
  -H "Authorization: Bearer <token>"
```

### Manually Approve Commission (KT TH)
```bash
curl -X POST http://localhost:3000/commission/{id}/approve \
  -H "Authorization: Bearer <token>"
```

## 🐛 Troubleshooting

### Commission not created?
1. Check order status is exactly 'COMPLETED'
2. Verify commission rules exist for service type
3. Check logs for "No commission rule found" warning
4. Ensure CostAllocations exist

### Commission not auto-approved?
1. Verify AR.isFullyPaid = true
2. Check if AR has linked orderId
3. Verify commission status is PENDING
4. Review event emitter logs

## 📞 Support

- **Logs**: Check `logs/app.log | grep Commission`
- **Database**: Use Prisma Studio to inspect records
- **Events**: Enable debug logging to see event flow
- **Docs**: Refer to README.md for detailed info

## 📋 File Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| README.md | Detailed documentation | Understanding the system |
| IMPLEMENTATION_GUIDE.md | Implementation guide | Building/extending features |
| DEPLOYMENT_CHECKLIST.md | Deployment guide | Before going to production |
| TASK_4_SUMMARY.md | Implementation summary | Understanding what was built |
| INDEX.md | This file | Quick navigation |

## ⚡ Quick Commands

```bash
# Seed commission rules
npm run seed:commission

# Verify setup
npm run verify:commission

# Run tests
npm test commission

# Build
npm run build

# Start dev
npm run start:dev
```

## 🎓 Learning Path

**New to the module?**
1. Read INDEX.md (this file) for overview
2. Read TASK_4_SUMMARY.md to understand what was built
3. Read README.md for detailed architecture
4. Review code in services/ and listeners/
5. Read IMPLEMENTATION_GUIDE.md for hands-on implementation

**Ready to deploy?**
1. Review DEPLOYMENT_CHECKLIST.md
2. Run verify-setup.ts script
3. Test in staging environment
4. Follow deployment checklist
5. Monitor logs after deployment

## 📦 Dependencies

- NestJS (@nestjs/common, @nestjs/event-emitter)
- Prisma (@prisma/client)
- TypeScript
- Node.js

## 🏆 Success Criteria

✅ Commission auto-created on order completion
✅ Commission auto-approved on AR full payment
✅ Events emitted for notification integration
✅ Comprehensive error handling
✅ Full test coverage
✅ Documentation complete

---

**Last Updated**: 2026-02-11
**Version**: 1.0.0
**Status**: ✅ Production Ready
