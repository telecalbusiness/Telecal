// @ts-nocheck

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ── Admin account ────────────────────────────────────────────
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@telecal.com';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@Telecal2025!';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log(`✓ Admin account already exists: ${adminEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
    console.log(`✓ Admin account created: ${adminEmail}`);
    console.log(`  ⚠  Default password: ${adminPassword}`);
    console.log(`  ⚠  CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN\n`);
  }

  // ── System config defaults ────────────────────────────────────
  const configs = [
    { key: 'PLATFORM_NAME', value: 'Telecal' },
    { key: 'SUPPORT_EMAIL', value: 'support@telecal.com' },
    { key: 'MAINTENANCE_MODE', value: 'false' },
    { key: 'MAX_PATIENTS_PER_DOCTOR', value: '5' },
    { key: 'SESSION_WARNING_SECONDS', value: '120' },
    { key: 'DOCTOR_COMMISSION_PERCENT', value: '75' },
    { key: 'PLATFORM_COMMISSION_PERCENT', value: '25' },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }
  console.log(`✓ System config defaults set (${configs.length} entries)`);

  console.log('\n✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
