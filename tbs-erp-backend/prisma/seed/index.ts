import { PrismaClient } from '@prisma/client';
import { seedRoles } from './roles.seed';
import { seedSampleData } from './sample-data.seed';
import { seedApprovalFlows } from './approval-flows.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await seedRoles(prisma);
  await seedSampleData(prisma);
  await seedApprovalFlows(prisma);

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
