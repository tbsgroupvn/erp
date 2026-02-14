/**
 * Data Migration Script: Seed Master Orders
 *
 * This script migrates existing flat orders into the MasterOrder/SubOrder structure:
 * 1. Assigns saleCode to all users with SALE/SALES_LEADER/SALES_DIRECTOR/ADMIN roles
 * 2. Creates a MasterOrder wrapper for each existing Order
 * 3. Links each Order to its MasterOrder with suffix 'A' and default TIEU_NGACH clearance
 *
 * Run: npx ts-node prisma/migrations/seed-master-orders.ts
 */

import { PrismaClient, MasterOrderStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting master order migration...');

  // Step 1: Assign saleCode to sales-related users
  console.log('\n--- Step 1: Assigning saleCodes to users ---');

  const salesRoles: UserRole[] = [
    UserRole.CEO,
    UserRole.COO,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
  ];

  const usersWithoutSaleCode = await prisma.user.findMany({
    where: {
      role: { in: salesRoles },
      saleCode: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${usersWithoutSaleCode.length} users without saleCode`);

  // Find the highest existing saleCode sequence
  const existingCodes = await prisma.user.findMany({
    where: { saleCode: { not: null } },
    select: { saleCode: true },
    orderBy: { saleCode: 'desc' },
    take: 1,
  });

  let nextSeq = 1;
  if (existingCodes.length > 0 && existingCodes[0].saleCode) {
    const match = existingCodes[0].saleCode.match(/NV(\d+)/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  for (const user of usersWithoutSaleCode) {
    const saleCode = `NV${String(nextSeq).padStart(3, '0')}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { saleCode },
    });
    console.log(`  Assigned ${saleCode} to ${user.fullName} (${user.role})`);
    nextSeq++;
  }

  // Step 2: Wrap existing orders in MasterOrders
  console.log('\n--- Step 2: Creating MasterOrders for existing orders ---');

  const ordersWithoutMaster = await prisma.order.findMany({
    where: { masterOrderId: null },
    include: {
      customer: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${ordersWithoutMaster.length} orders without master order`);

  let migratedCount = 0;

  for (const order of ordersWithoutMaster) {
    // Get sale user's saleCode
    const saleUser = await prisma.user.findUnique({
      where: { id: order.saleId },
      select: { saleCode: true, fullName: true },
    });

    if (!saleUser?.saleCode) {
      console.warn(`  WARNING: User ${order.saleId} has no saleCode, assigning one...`);
      const code = `NV${String(nextSeq).padStart(3, '0')}`;
      await prisma.user.update({
        where: { id: order.saleId },
        data: { saleCode: code },
      });
      nextSeq++;
      // Re-fetch
      const updated = await prisma.user.findUnique({
        where: { id: order.saleId },
        select: { saleCode: true },
      });
      if (!updated?.saleCode) {
        console.error(`  ERROR: Could not assign saleCode to user ${order.saleId}, skipping order ${order.code}`);
        continue;
      }
      saleUser!.saleCode = updated.saleCode;
    }

    // Generate master order code from order's creation date
    const orderDate = order.createdAt;
    const dateStr = [
      String(orderDate.getDate()).padStart(2, '0'),
      String(orderDate.getMonth() + 1).padStart(2, '0'),
      String(orderDate.getFullYear()).slice(-2),
    ].join('');

    const prefix = `#${saleUser!.saleCode}.${dateStr}`;

    // Find next sequence for this prefix
    const existing = await prisma.masterOrder.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
      orderBy: { code: 'desc' },
      take: 1,
    });

    let seq = 1;
    if (existing.length > 0) {
      const parts = existing[0].code.split('.');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    const masterCode = `${prefix}.${String(seq).padStart(4, '0')}`;

    // Determine overall status from order status
    let overallStatus: MasterOrderStatus = MasterOrderStatus.ACTIVE;
    if (order.status === 'COMPLETED') {
      overallStatus = MasterOrderStatus.COMPLETED;
    } else if (order.status === 'CANCELLED') {
      overallStatus = MasterOrderStatus.CANCELLED;
    }

    // Create master order and link the sub order
    await prisma.$transaction(async (tx) => {
      const masterOrder = await tx.masterOrder.create({
        data: {
          code: masterCode,
          customerId: order.customerId,
          saleId: order.saleId,
          branch: order.branch,
          overallStatus,
          note: order.note,
          createdAt: order.createdAt,
        },
      });

      // Update the order to link to master
      await tx.order.update({
        where: { id: order.id },
        data: {
          masterOrderId: masterOrder.id,
          subOrderSuffix: 'A',
          clearanceType: 'TIEU_NGACH',
        },
      });

      // Also update the order code to new format
      const newOrderCode = `${masterCode}-A`;
      await tx.order.update({
        where: { id: order.id },
        data: { code: newOrderCode },
      });
    });

    migratedCount++;
    if (migratedCount % 50 === 0) {
      console.log(`  Migrated ${migratedCount}/${ordersWithoutMaster.length} orders...`);
    }
  }

  console.log(`\n--- Migration Complete ---`);
  console.log(`  Users updated with saleCode: ${usersWithoutSaleCode.length}`);
  console.log(`  Orders migrated to MasterOrders: ${migratedCount}`);
}

main()
  .then(() => {
    console.log('\nMigration finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
