require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addTestUsers() {
  try {
    console.log('Creating test users...');

    // Hash password
    const hashedPassword = await bcrypt.hash('12345', 10);
    const demoPasswordHash = await bcrypt.hash('123456', 10);

    // Delete existing test users if they exist
    await prisma.user.deleteMany({
      where: {
        email: { in: ['brennan@chaoscap.org', 'billing@northshoresignco.com', 'hello@northshoresignco.com'] },
      },
    });

    // Create TC user
    const tcUser = await prisma.user.create({
      data: {
        email: 'brennan@chaoscap.org',
        passwordHash: hashedPassword,
        firstName: 'Linda',
        lastName: 'Rogers',
        phone: null,
        brokerageName: null,
        role: 'TC',
      },
    });

    console.log('✅ Test TC user created successfully:');
    console.log(`   Email: ${tcUser.email}`);
    console.log(`   Password: 12345`);
    console.log(`   ID: ${tcUser.id}`);
    console.log(`   Role: ${tcUser.role}`);
    console.log('');

    // Create realtor user
    const realtorUser = await prisma.user.create({
      data: {
        email: 'billing@northshoresignco.com',
        passwordHash: hashedPassword,
        firstName: 'Sebastian',
        lastName: 'Gurich',
        phone: null,
        brokerageName: 'North Shore Sign Co',
        role: 'REALTOR',
      },
    });

    console.log('✅ Test realtor user created successfully:');
    console.log(`   Email: ${realtorUser.email}`);
    console.log(`   Password: 12345`);
    console.log(`   ID: ${realtorUser.id}`);
    console.log(`   Role: ${realtorUser.role}`);

    // Create underwriter demo user as a realtor
    const demoUser = await prisma.user.create({
      data: {
        email: 'hello@northshoresignco.com',
        passwordHash: demoPasswordHash,
        firstName: 'Demo',
        lastName: 'Test',
        phone: null,
        brokerageName: 'North Shore Sign Co',
        role: 'REALTOR',
      },
    });

    console.log('✅ Demo realtor user created successfully:');
    console.log(`   Email: ${demoUser.email}`);
    console.log(`   Password: 123456`);
    console.log(`   ID: ${demoUser.id}`);
    console.log(`   Role: ${demoUser.role}`);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addTestUsers();
