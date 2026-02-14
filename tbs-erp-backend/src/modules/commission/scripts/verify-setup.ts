import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';

const prisma = new PrismaClient();

/**
 * Verification script to ensure commission flow is properly set up.
 * Run this after deployment to verify everything is working.
 *
 * Usage:
 *   npx ts-node src/modules/commission/scripts/verify-setup.ts
 */

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function verifyCommissionRulesExist() {
  console.log(chalk.blue('\n📋 Checking Commission Rules...'));

  const rules = await prisma.commissionRule.findMany({
    where: { isActive: true },
  });

  const rulesByType = rules.reduce((acc, rule) => {
    if (!acc[rule.serviceType]) {
      acc[rule.serviceType] = [];
    }
    acc[rule.serviceType].push(rule);
    return acc;
  }, {} as Record<string, any[]>);

  const serviceTypes = ['VCT', 'MHH', 'UTXNK', 'LCLCN'];
  let allPassed = true;

  for (const type of serviceTypes) {
    const typeRules = rulesByType[type] || [];
    const passed = typeRules.length > 0;
    allPassed = allPassed && passed;

    results.push({
      name: `Commission Rules: ${type}`,
      passed,
      message: passed
        ? `${typeRules.length} rule(s) found`
        : 'No rules found - run seed script',
      details: typeRules.map((r) => ({
        range: `${r.minProfit / 1_000_000}M - ${r.maxProfit / 1_000_000}M`,
        rate: `${r.rate * 100}%`,
      })),
    });
  }

  return allPassed;
}

async function verifyDatabaseSchema() {
  console.log(chalk.blue('\n📊 Checking Database Schema...'));

  try {
    // Check CommissionRecord table
    await prisma.commissionRecord.findFirst();
    results.push({
      name: 'CommissionRecord table',
      passed: true,
      message: 'Table exists and is accessible',
    });
  } catch (error) {
    results.push({
      name: 'CommissionRecord table',
      passed: false,
      message: `Error: ${error.message}`,
    });
  }

  try {
    // Check CommissionRule table
    await prisma.commissionRule.findFirst();
    results.push({
      name: 'CommissionRule table',
      passed: true,
      message: 'Table exists and is accessible',
    });
  } catch (error) {
    results.push({
      name: 'CommissionRule table',
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function verifyIndexes() {
  console.log(chalk.blue('\n🔍 Checking Database Indexes...'));

  // Note: This is a simple check. For production, you'd want to query
  // the database metadata to verify indexes actually exist.

  try {
    // Test query performance with indexes
    const start = Date.now();
    await prisma.commissionRecord.findMany({
      where: { status: 'PENDING' },
      take: 1,
    });
    const duration = Date.now() - start;

    results.push({
      name: 'CommissionRecord status index',
      passed: duration < 100,
      message: `Query time: ${duration}ms (expected < 100ms)`,
    });
  } catch (error) {
    results.push({
      name: 'CommissionRecord indexes',
      passed: false,
      message: `Error: ${error.message}`,
    });
  }
}

async function verifyCommissionRecords() {
  console.log(chalk.blue('\n💰 Checking Commission Records...'));

  const totalRecords = await prisma.commissionRecord.count();
  const pendingRecords = await prisma.commissionRecord.count({
    where: { status: 'PENDING' },
  });
  const approvedRecords = await prisma.commissionRecord.count({
    where: { status: 'APPROVED' },
  });
  const paidRecords = await prisma.commissionRecord.count({
    where: { status: 'PAID' },
  });

  results.push({
    name: 'Commission Records Summary',
    passed: true,
    message: `Total: ${totalRecords} (Pending: ${pendingRecords}, Approved: ${approvedRecords}, Paid: ${paidRecords})`,
    details: {
      total: totalRecords,
      pending: pendingRecords,
      approved: approvedRecords,
      paid: paidRecords,
    },
  });
}

async function verifyOrphanedRecords() {
  console.log(chalk.blue('\n🔗 Checking for Orphaned Records...'));

  // Check for commission records with invalid order references
  const commissions = await prisma.commissionRecord.findMany({
    select: { id: true, orderId: true },
    take: 100,
  });

  let orphanedCount = 0;
  for (const commission of commissions) {
    const order = await prisma.order.findUnique({
      where: { id: commission.orderId },
    });
    if (!order) {
      orphanedCount++;
    }
  }

  results.push({
    name: 'Orphaned Commission Records',
    passed: orphanedCount === 0,
    message:
      orphanedCount === 0
        ? 'No orphaned records found'
        : `${orphanedCount} orphaned record(s) found`,
  });
}

async function verifyRuleCoverage() {
  console.log(chalk.blue('\n📐 Checking Rule Coverage...'));

  const serviceTypes = ['VCT', 'MHH', 'UTXNK', 'LCLCN'];

  for (const type of serviceTypes) {
    const rules = await prisma.commissionRule.findMany({
      where: { serviceType: type as any, isActive: true },
      orderBy: { minProfit: 'asc' },
    });

    const errors: string[] = [];

    // Check for gaps and overlaps
    for (let i = 0; i < rules.length - 1; i++) {
      const current = rules[i];
      const next = rules[i + 1];

      // Check overlap
      if (current.maxProfit > next.minProfit) {
        errors.push(
          `Overlap: [${current.minProfit}-${current.maxProfit}] overlaps with [${next.minProfit}-${next.maxProfit}]`,
        );
      }

      // Check gap
      if (current.maxProfit < next.minProfit) {
        errors.push(
          `Gap: No rule covers [${current.maxProfit}-${next.minProfit}]`,
        );
      }
    }

    results.push({
      name: `Rule Coverage: ${type}`,
      passed: errors.length === 0,
      message: errors.length === 0 ? 'No gaps or overlaps' : errors.join('; '),
      details: errors.length > 0 ? errors : undefined,
    });
  }
}

async function printResults() {
  console.log(chalk.bold('\n\n🎯 Verification Results:\n'));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');

    console.log(`${icon} ${status} - ${result.name}`);
    console.log(`  ${result.message}`);

    if (result.details && !result.passed) {
      console.log(chalk.gray('  Details:'), result.details);
    }
    console.log();
  });

  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  console.log(chalk.red(`  ✗ Failed: ${failed}`));
  console.log();

  if (failed === 0) {
    console.log(
      chalk.green.bold('🎉 All checks passed! Commission flow is ready.'),
    );
  } else {
    console.log(
      chalk.yellow.bold(
        '⚠️  Some checks failed. Please review and fix before deployment.',
      ),
    );
  }
}

async function main() {
  console.log(
    chalk.bold.blue('🔧 Commission Flow Verification Script\n'),
  );

  try {
    await verifyDatabaseSchema();
    await verifyCommissionRulesExist();
    await verifyIndexes();
    await verifyCommissionRecords();
    await verifyOrphanedRecords();
    await verifyRuleCoverage();

    await printResults();

    const allPassed = results.every((r) => r.passed);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('\n❌ Verification failed:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
