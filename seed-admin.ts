import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  try {
    console.log('[SEED] Creating test ADMIN user...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@test.com' },
    });

    if (existingUser) {
      console.log('✅ ADMIN user already exists:');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.firstName} ${existingUser.lastName}`);
      console.log(`   Role: ${existingUser.role}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('test1234', 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Admin',
        phone: null,
        brokerageName: null,
        role: 'ADMIN',
      },
    });

    console.log('✅ ADMIN user created successfully:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: ${user.role}`);
  } catch (error) {
    console.error('❌ Error creating ADMIN user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
