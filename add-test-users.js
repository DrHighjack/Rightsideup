const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addTestUsers() {
  try {
    console.log('Creating test users...');

    // Hash password
    const hashedPassword = await bcrypt.hash('12345', 10);

    // Delete existing test users if they exist
    await prisma.user.deleteMany({
      where: {
        email: { in: ['brennan@chaoscap.org', 'billing@northshoresignco.com'] },
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
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addTestUsers();
