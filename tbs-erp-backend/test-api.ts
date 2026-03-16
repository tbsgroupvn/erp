import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET || 'CHANGE_ME_generate_with_openssl_rand_hex_64';
const API_URL = 'http://localhost:3333/api/v1/customers/quick';

async function run() {
  console.log('Connecting to DB...');
  try {
    // 1. Get a user with a sale role
    let saleUser = await prisma.user.findFirst({
      where: { role: 'SALE', isActive: true, saleCode: { not: null } }
    });

    if (!saleUser) {
      console.log('No SALE user found. Creating a temporary one...');
      saleUser = await prisma.user.create({
        data: {
          email: 'temp_sale@example.com',
          passwordHash: 'fake_hash',
          fullName: 'Temp Sale',
          role: 'SALE',
          saleCode: 'TEMP-SALE-001',
          isActive: true
        }
      });
    }

    // 2. Get a user without a sale role
    let accUser = await prisma.user.findFirst({
      where: { role: 'ACCOUNTANT', isActive: true, saleCode: null }
    });

    if (!accUser) {
        console.log('No ACCOUNTANT user found. Creating a temporary one...');
        accUser = await prisma.user.create({
          data: {
            email: 'temp_acc@example.com',
            passwordHash: 'fake_hash',
            fullName: 'Temp Accountant',
            role: 'ACCOUNTANT',
            isActive: true
          }
        });
    }

    // 3. Create dummy sessions for validation
    const saleSession = await prisma.session.create({
      data: {
        userId: saleUser.id,
        refreshToken: 'fake',
        expiresAt: new Date(Date.now() + 86400000)
      }
    });
    const accSession = await prisma.session.create({
      data: {
        userId: accUser.id,
        refreshToken: 'fake',
        expiresAt: new Date(Date.now() + 86400000)
      }
    });

    // 4. Generate tokens with the new hasSaleCode flag
    console.log('Generating JWT Tokens...');
    const saleToken = jwt.sign({
      sub: saleUser.id,
      email: saleUser.email,
      role: saleUser.role,
      branch: saleUser.branch,
      hasSaleCode: true,
      sessionId: saleSession.id
    }, secret);

    const accToken = jwt.sign({
      sub: accUser.id,
      email: accUser.email,
      role: accUser.role,
      branch: accUser.branch,
      hasSaleCode: false,
      sessionId: accSession.id
    }, secret);

    // 5. Test API with Accountant Token (Should Fail 403)
    console.log('\n--- TESTING ACCOUNTANT (NO SALE CODE) ---');
    const res1 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accToken}` },
        body: JSON.stringify({ fullName: 'Test Acc', phone: '0999888111' })
    });
    const data1 = await res1.json();
    console.log(`Status: ${res1.status}`);
    console.log(`Response:`, JSON.stringify(data1, null, 2));
    if (res1.status !== 403) console.error('❌ Expected 403 Forbidden!');
    else console.log('✅ Passed 403 check!');

    // 5. Test API with Sale Token (Should Pass 201)
    console.log('\n--- TESTING SALE (WITH SALE CODE) ---');
    const randomPhone = `0999${Math.floor(100000 + Math.random() * 900000)}`;
    const res2 = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saleToken}` },
        body: JSON.stringify({ fullName: 'Khách Test Từ Code', phone: randomPhone })
    });
    const data2 = await res2.json();
    console.log(`Status: ${res2.status}`);
    console.log(`Response:`, JSON.stringify(data2, null, 2));
    if (res2.status === 201) {
        console.log(`✅ Passed! Customer Created: ${data2.data?.id}`);
        // Cleanup if created successfully
        await prisma.customer.delete({ where: { id: data2.data.id } });
    } else {
        console.error('❌ Expected 201 Created!');
    }

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    // Xoá sessions rác
    await prisma.session.deleteMany({
      where: { refreshToken: 'fake' }
    });
    await prisma.$disconnect();
    console.log('\nDone.');
  }
}

run();
