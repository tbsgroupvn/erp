import { PrismaClient } from '@prisma/client';

/**
 * Seeds fleet data: 6 vehicles (2 trucks, 2 vans, 2 motorcycles) + 2 drivers.
 * Drivers are linked to taixe01/taixe02 employee records.
 */
export async function seedFleet(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') {
    console.log('  → Skipping fleet seed in production');
    return;
  }

  console.log('  → Seeding fleet (6 vehicles, 2 drivers)...');

  const vehicles = [
    // Trucks
    {
      plateNumber: '30H-12345',
      type: 'TRUCK' as const,
      brand: 'Hyundai',
      model: 'HD72',
      year: 2022,
      capacityKg: 3500,
      volumeM3: 18,
      branch: 'HN' as const,
      insuranceExpiry: new Date('2027-06-30'),
      registrationExpiry: new Date('2027-12-31'),
    },
    {
      plateNumber: '51H-67890',
      type: 'TRUCK' as const,
      brand: 'Isuzu',
      model: 'QKR77HE4',
      year: 2023,
      capacityKg: 2500,
      volumeM3: 14,
      branch: 'HCM' as const,
      insuranceExpiry: new Date('2027-09-30'),
      registrationExpiry: new Date('2028-03-31'),
    },
    // Vans
    {
      plateNumber: '30H-11111',
      type: 'VAN' as const,
      brand: 'Ford',
      model: 'Transit',
      year: 2023,
      capacityKg: 1200,
      volumeM3: 10,
      branch: 'HN' as const,
      insuranceExpiry: new Date('2027-08-31'),
      registrationExpiry: new Date('2028-01-31'),
    },
    {
      plateNumber: '51H-22222',
      type: 'VAN' as const,
      brand: 'Mercedes',
      model: 'Sprinter',
      year: 2022,
      capacityKg: 1500,
      volumeM3: 12,
      branch: 'HCM' as const,
      insuranceExpiry: new Date('2027-05-31'),
      registrationExpiry: new Date('2027-11-30'),
    },
    // Motorcycles
    {
      plateNumber: '30X1-33333',
      type: 'MOTORCYCLE' as const,
      brand: 'Honda',
      model: 'Wave RSX',
      year: 2024,
      capacityKg: 50,
      volumeM3: 0.3,
      branch: 'HN' as const,
      insuranceExpiry: new Date('2027-12-31'),
      registrationExpiry: new Date('2029-01-31'),
    },
    {
      plateNumber: '59X1-44444',
      type: 'MOTORCYCLE' as const,
      brand: 'Honda',
      model: 'Winner X',
      year: 2024,
      capacityKg: 50,
      volumeM3: 0.3,
      branch: 'HCM' as const,
      insuranceExpiry: new Date('2027-12-31'),
      registrationExpiry: new Date('2029-01-31'),
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { plateNumber: v.plateNumber },
      update: {},
      create: {
        ...v,
        status: 'ACTIVE',
      },
    });
  }

  // Drivers linked to taixe01/taixe02 employees
  const emailDomain = process.env.SEED_EMAIL_DOMAIN || 'example.com';

  const driverDefs = [
    {
      emailPrefix: 'taixe01',
      fullName: 'Tài xế 01',
      phone: '0900000029',
      branch: 'HN' as const,
      licenseNumber: 'B2-001234',
      licenseType: 'B2',
      vehiclePlate: '30H-12345',
    },
    {
      emailPrefix: 'taixe02',
      fullName: 'Tài xế 02',
      phone: '0900000030',
      branch: 'HCM' as const,
      licenseNumber: 'C-005678',
      licenseType: 'C',
      vehiclePlate: '51H-67890',
    },
  ];

  for (const d of driverDefs) {
    const employee = await prisma.employee.findFirst({
      where: { email: `${d.emailPrefix}@${emailDomain}` },
    });

    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: d.vehiclePlate },
    });

    // Count-guard: skip if driver already exists for this employee
    if (employee) {
      const existing = await prisma.driver.findFirst({
        where: { employeeId: employee.id },
      });
      if (!existing) {
        await prisma.driver.create({
          data: {
            employeeId: employee.id,
            fullName: d.fullName,
            phone: d.phone,
            licenseNumber: d.licenseNumber,
            licenseExpiry: new Date('2028-12-31'),
            licenseType: d.licenseType,
            vehicleId: vehicle?.id ?? null,
            branch: d.branch,
            status: 'AVAILABLE',
          },
        });
      }
    }
  }

  console.log('  ✅ Fleet seeded (6 vehicles, 2 drivers)');
}
