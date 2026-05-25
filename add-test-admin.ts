import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function addTestAdmin() {
  try {
    console.log('Creating test admin user...');

    // Delete existing test admin if it exists
    await prisma.user.deleteMany({
      where: { email: 'test@admin.com' },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash('admin1234', 10);

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email: 'test@admin.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Admin',
        phone: null,
        brokerageName: null,
        role: 'ADMIN',
      },
    });

    console.log('✅ Test admin user created successfully:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: admin1234`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}`);
  } catch (error) {
    console.error('❌ Error creating test admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addTestAdmin();
