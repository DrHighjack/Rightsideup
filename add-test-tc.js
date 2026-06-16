require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addTestTC() {
  try {
    console.log('Creating test TC coordinator user...');

    const email = 'test.tc@rightsignup.local';
    const password = 'tc123456';

    // Delete existing test TC if it exists so credentials stay predictable.
    await prisma.user.deleteMany({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Coordinator',
        phone: null,
        brokerageName: null,
        role: 'TC',
      },
    });

    console.log('✅ Test TC coordinator created successfully:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}`);
  } catch (error) {
    console.error('❌ Error creating test TC coordinator:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addTestTC();