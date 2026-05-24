import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function seedFieldTech() {
  try {
    console.log('[SEED] Creating test FIELD_TECH user...');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'fieldtech@test.com' },
    });

    if (existingUser) {
      console.log('✅ FIELD_TECH user already exists:');
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
        email: 'fieldtech@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Tech',
        phone: null,
        brokerageName: null,
        role: 'FIELD_TECH',
      },
    });

    console.log('✅ FIELD_TECH user created successfully:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: ${user.role}`);
    console.log('\n📝 Use these credentials to test:');
    console.log('   Email: fieldtech@test.com');
    console.log('   Password: test1234');
  } catch (error) {
    console.error('❌ Error creating FIELD_TECH user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedFieldTech();
