import { PrismaClient } from '@prisma/client';

/**
 * Seeds warehouse storage locations.
 * HN: Shelves A1-A5, Levels 01-04, Slots 01-10 = 200 locations
 * HCM: Shelves B1-B3, Levels 01-03, Slots 01-08 = 72 locations
 * Total: 272 locations
 */
export async function seedStorageLocations(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') {
    console.log('  → Skipping storage locations in production');
    return;
  }

  console.log('  → Seeding storage locations (272)...');

  const locations: {
    code: string;
    shelf: string;
    level: string;
    slot: string;
    branch: 'HN' | 'HCM';
    zone: string;
  }[] = [];

  // HN warehouse: A1-A5, Levels 01-04, Slots 01-10
  const hnShelves = ['A1', 'A2', 'A3', 'A4', 'A5'];
  for (const shelf of hnShelves) {
    const zone = ['A1', 'A2', 'A3'].includes(shelf)
      ? 'REGULAR'
      : shelf === 'A4'
        ? 'COLD'
        : 'HAZARDOUS';
    for (let lvl = 1; lvl <= 4; lvl++) {
      for (let slot = 1; slot <= 10; slot++) {
        const level = String(lvl).padStart(2, '0');
        const slotStr = String(slot).padStart(2, '0');
        locations.push({
          code: `${shelf}-${level}-${slotStr}`,
          shelf,
          level,
          slot: slotStr,
          branch: 'HN',
          zone,
        });
      }
    }
  }

  // HCM warehouse: B1-B3, Levels 01-03, Slots 01-08
  const hcmShelves = ['B1', 'B2', 'B3'];
  for (const shelf of hcmShelves) {
    const zone = ['B1', 'B2'].includes(shelf) ? 'REGULAR' : 'COLD';
    for (let lvl = 1; lvl <= 3; lvl++) {
      for (let slot = 1; slot <= 8; slot++) {
        const level = String(lvl).padStart(2, '0');
        const slotStr = String(slot).padStart(2, '0');
        locations.push({
          code: `${shelf}-${level}-${slotStr}`,
          shelf,
          level,
          slot: slotStr,
          branch: 'HCM',
          zone,
        });
      }
    }
  }

  await prisma.storageLocation.createMany({
    data: locations,
    skipDuplicates: true,
  });

  console.log(`  ✅ ${locations.length} storage locations seeded`);
}
