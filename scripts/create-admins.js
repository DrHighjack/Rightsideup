#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const admins = [
  {
    firstName: 'Brennan',
    lastName: 'Me',
    email: 'brennan@northshoresignco.com',
    password: 'ToTheMoon2020$'
  },
  {
    firstName: 'Max',
    lastName: 'Treble',
    email: 'maxtreblebusiness@gmail.com',
    password: 'GoldenPath739@'
  },
  {
    firstName: 'Tyson',
    lastName: 'Sims',
    email: 'postproidaho@gmail.com',
    password: 'CloudMoon956$'
  },
  {
    firstName: 'Lexee',
    lastName: 'Offord',
    email: '02awofford@gmail.com',
    password: 'SilverWave284#'
  }
];

async function createAdmins() {
  console.log('🚀 Creating Admin Accounts...\n');

  for (const admin of admins) {
    try {
      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email: admin.email }
      });

      if (existing) {
        console.log(`⏭️  ${admin.firstName} ${admin.lastName} already exists (${admin.email})`);
        continue;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(admin.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          passwordHash,
          role: 'ADMIN'
        }
      });

      console.log(`✅ Created ${admin.firstName} ${admin.lastName}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ADMIN`);
      console.log(`   ID: ${user.id}\n`);
    } catch (error) {
      console.error(`❌ Error creating ${admin.firstName} ${admin.lastName}:`, error.message);
    }
  }

  console.log('✨ Admin creation complete!');
}

createAdmins()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
