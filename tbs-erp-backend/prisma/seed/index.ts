import { PrismaClient } from '@prisma/client';
import { seedRoles } from './roles.seed';
import { seedChartOfAccounts } from './coa.seed';
import { seedEmployees } from './employees.seed';
import { seedSampleData } from './sample-data.seed';
import { seedHSCodes } from './hs-codes.seed';
import { seedComplianceRules } from './compliance-rules.seed';
import { seedStorageLocations } from './storage-locations.seed';
import { seedVendors } from './vendors.seed';
import { seedCommissionRules } from './commission-rules.seed';
import { seedFleet } from './fleet.seed';
import { seedApprovalFlows } from './approval-flows.seed';
import { seedDemoData } from './demo-seed';
import { seedCancelPenaltyConfig } from './cancel-penalty.seed';
import { seedRealisticData } from './realistic-data.seed';
import { seedOrderStageConfigs } from './order-stage-config.seed';
import { seedApprovalTemplates } from './approval-templates.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Users (30) — must be first, all other seeders depend on user IDs
  await seedRoles(prisma);

  // 2. Chart of Accounts — must run before sample-data (331.99 needs 331 parent)
  await seedChartOfAccounts(prisma);

  // 3. Employees — linked to Users
  await seedEmployees(prisma);

  // 4. Sample data — exchange rates, customers, wallets (dev only)
  await seedSampleData(prisma);

  // 5. HS Codes — customs library
  await seedHSCodes(prisma);

  // 6. Compliance rules — customs validation
  await seedComplianceRules(prisma);

  // 7. Storage locations — warehouse bin grid (dev only)
  await seedStorageLocations(prisma);

  // 8. Vendors — Chinese suppliers for MHH (dev only)
  await seedVendors(prisma);

  // 9. Commission rules — 14 brackets (dev only)
  await seedCommissionRules(prisma);

  // 10. Fleet — vehicles + drivers, needs Employee IDs (dev only)
  await seedFleet(prisma);

  // 11. Approval flows — 19 flows
  await seedApprovalFlows(prisma);

  // 12. Cancel penalty configs — return request penalty rates
  await seedCancelPenaltyConfig(prisma);

  // 13. Realistic business data — orders, containers, packages, etc.
  await seedRealisticData(prisma);

  // 14. Demo data — only when DEMO_MODE=true
  await seedDemoData(prisma);

  // 15. Order stage configs — stage-to-department mapping for project management
  await seedOrderStageConfigs(prisma);

  // 16. Approval flow templates — 15 pre-built templates
  await seedApprovalTemplates(prisma);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
