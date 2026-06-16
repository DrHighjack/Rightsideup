#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createInstallerAccount() {
  console.log('🚀 Creating Brennan Installer Account...\n');

  try {
    // First get Brennan's admin account
    const brennanAdmin = await prisma.user.findUnique({
      where: { email: 'brennan@northshoresignco.com' }
    });

    if (!brennanAdmin) {
      console.error('❌ Could not find Brennan admin account');
      process.exit(1);
    }

    // Check if installer account already exists
    const existing = await prisma.user.findFirst({
      where: { email: 'brennan-installer@northshoresignco.com' }
    });

    if (existing) {
      console.log('⚠️  Brennan Installer account already exists!');
      console.log(`   Email: ${existing.email}`);
      console.log(`   Role: ${existing.role}`);
      console.log(`   ID: ${existing.id}\n`);
      process.exit(0);
    }

    // Create installer account with same password as Brennan's admin account
    const defaultPassword = 'ToTheMoon2020$'; // Same as Brennan's admin account for easy switching
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const installerAccount = await prisma.user.create({
      data: {
        email: 'brennan-installer@northshoresignco.com',
        firstName: 'Brennan',
        lastName: 'Installer',
        phone: null,
        passwordHash,
        role: 'FIELD_TECH',
        adminNotes: JSON.stringify([
          {
            text: 'Linked to Brennan admin account (brennan@northshoresignco.com)',
            createdAt: new Date().toISOString(),
            adminId: brennanAdmin.id
          }
        ])
      }
    });

    console.log('✅ Brennan Installer Account Created!\n');
    console.log(`   Name: Brennan Installer`);
    console.log(`   Email: brennan-installer@northshoresignco.com`);
    console.log(`   Role: FIELD_TECH`);
    console.log(`   Password: ToTheMoon2020$ (same as your admin account)`);
    console.log(`   ID: ${installerAccount.id}\n`);
    console.log('💡 Login Instructions:');
    console.log('   1. Go to /login');
    console.log('   2. Use email: brennan-installer@northshoresignco.com');
    console.log('   3. Use password: ToTheMoon2020$');
    console.log('   4. You can now manage field jobs and sign deployments!\n');

  } catch (error) {
    console.error('❌ Error creating installer account:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createInstallerAccount();
