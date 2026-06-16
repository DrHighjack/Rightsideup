import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function fixPassword() {
  try {
    const newHash = await bcrypt.hash('password123', 10);
    console.log('Creating new hash:', newHash);
    
    const user = await prisma.user.update({
      where: { email: 'admin@test.com' },
      data: {
        passwordHash: newHash,
      },
    });

    console.log('✓ User password updated');
    
    // Verify it works
    const isValid = await bcrypt.compare('password123', user.passwordHash);
    console.log('Verification result:', isValid);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPassword();
