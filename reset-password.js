require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const testPassword = 'admin123456';
    const hashedPassword = await bcrypt.hash(testPassword, 12);

    const updated = await prisma.user.update({
      where: { email: 'admin@signpost.local' },
      data: { passwordHash: hashedPassword },
    });

    console.log('✅ Password reset successfully!');
    console.log('');
    console.log('New credentials:');
    console.log(`- Email: ${updated.email}`);
    console.log(`- Password: ${testPassword}`);
    console.log('');
    console.log('Try logging in again with these credentials.');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
