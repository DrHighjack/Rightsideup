require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@signpost.local' },
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:');
    console.log('- Email:', user.email);
    console.log('- Password hash:', user.passwordHash);
    console.log('');

    // Test password
    const testPassword = 'password123';
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`Password "${testPassword}" is ${isValid ? 'VALID' : 'INVALID'}`);

    // Also try a hash to understand the format
    if (!isValid) {
      console.log('\nTrying to hash the test password to see what it looks like:');
      const hashedTest = await bcrypt.hash(testPassword, 10);
      console.log('Hashed test password:', hashedTest);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
