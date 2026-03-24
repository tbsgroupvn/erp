// create-admin-user.js - Uses Prisma (available in prod container)
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const hash = await bcrypt.hash('Admin@123', 10);
  console.log('Hash generated');
  
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('DB connected');
  
  // Check tables
  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables:', tables.map(t => t.table_name).join(', '));
  
  // Check if users table exists
  const hasUsers = tables.some(t => t.table_name === 'users');
  console.log('Has users table:', hasUsers);
  
  if (hasUsers) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO users (id, email, full_name, password_hash, role, branch, is_active, is_2fa_enabled, preferred_two_factor_method, created_at, updated_at) VALUES ('admin-sys-001', 'admin@tbs.com', 'System Admin', $1, 'COO', 'HN', true, false, 'TOTP', NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET password_hash = $1, updated_at = NOW()",
      hash
    );
    console.log('Admin user created!');
    
    const users = await prisma.$queryRawUnsafe("SELECT email, role, is_active FROM users LIMIT 5");
    console.log('Users:', JSON.stringify(users));
  } else {
    console.log('No users table - listing all tables for debug');
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
