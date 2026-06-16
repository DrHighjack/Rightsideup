import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function debugAuth() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@test.com' },
    });

    console.log('User found:', user?.email);
    console.log('Stored hash:', user?.passwordHash);
    console.log('Hash length:', user?.passwordHash?.length);
    
    if (user) {
      // Try to verify the password
      const isValid = await bcrypt.compare('password123', user.passwordHash);
      console.log('Password verification result:', isValid);
      
      // Also try hashing again to see the hash
      const newHash = await bcrypt.hash('password123', 10);
      console.log('New hash for testing:', newHash);
      
      // Try comparing the new hash
      const isValid2 = await bcrypt.compare('password123', newHash);
      console.log('Verification of new hash:', isValid2);
    }
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAuth();
