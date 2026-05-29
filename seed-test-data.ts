import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTestData() {
  try {
    console.log('🌱 Seeding test data for Analytics Dashboard...\n');

    // Create or update admin user
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    console.log('✓ Admin user created:', adminUser.email);

    // Create test realtor
    const realtor = await prisma.user.upsert({
      where: { email: 'realtor@test.com' },
      update: {},
      create: {
        email: 'realtor@test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'Realtor',
        role: 'REALTOR',
      },
    });
    console.log('✓ Realtor user created:', realtor.email);

    // Create test orders with different statuses
    const now = new Date();
    
    // Today's orders for revenue metric
    for (let i = 0; i < 3; i++) {
      await prisma.order.create({
        data: {
          orderNumber: `ORD-TODAY-${i + 1}`,
          realtorId: realtor.id,
          address: `Test Address ${i + 1}, City, State ${i}`,
          type: ['INSTALL', 'REMOVAL', 'CHANGE'][i % 3],
          status: 'COMPLETED',
          createdAt: new Date(now.getTime() - Math.random() * 3600000),
        },
      });
    }
    console.log('✓ Created 3 orders from today');

    // Orders from past week (for weekly metrics)
    for (let day = 1; day <= 7; day++) {
      for (let i = 0; i < 2; i++) {
        const types = ['INSTALL', 'REMOVAL', 'CHANGE'];
        const statuses = ['IN_GROUND', 'SCHEDULED', 'PENDING', 'IN_PROGRESS'];
        const orderType = types[(day + i) % types.length];
        let status = statuses[(day + i) % statuses.length];
        
        // For REMOVAL orders that are 'completed', use COMPLETED status
        if (orderType === 'REMOVAL' && status === 'IN_GROUND') {
          status = 'COMPLETED';
        }
        
        await prisma.order.create({
          data: {
            orderNumber: `ORD-WEEK-${day}-${i + 1}`,
            realtorId: realtor.id,
            address: `Test Week Address ${day}-${i + 1}`,
            type: orderType,
            status: status as any,
            createdAt: new Date(now.getTime() - day * 86400000 - Math.random() * 3600000),
          },
        });
      }
    }
    console.log('✓ Created 14 orders from past week');

    // Orders from past month (for monthly metrics)
    for (let day = 8; day <= 30; day++) {
      const orderType = ['INSTALL', 'REMOVAL', 'CHANGE'][day % 3];
      const baseStatus = day % 5 === 0 ? 'IN_GROUND' : 'SCHEDULED';
      const status = orderType === 'REMOVAL' && baseStatus === 'IN_GROUND' ? 'COMPLETED' : baseStatus;
      
      await prisma.order.create({
        data: {
          orderNumber: `ORD-MONTH-${day}`,
          realtorId: realtor.id,
          address: `Test Month Address ${day}`,
          type: orderType,
          status: status,
          createdAt: new Date(now.getTime() - day * 86400000),
        },
      });
    }
    console.log('✓ Created 23 orders from past month');

    // Create test invoices for outstanding invoices metric
    const orders = await prisma.order.findMany({ take: 5 });
    for (let i = 0; i < orders.length; i++) {
      await prisma.invoice.create({
        data: {
          userId: realtor.id,
          orderId: orders[i].id,
          amount: 500 + i * 200,
          status: i % 2 === 0 ? 'SENT' : 'OVERDUE',
          dueDate: new Date(now.getTime() + 30 * 86400000),
        },
      });
    }
    console.log('✓ Created 5 test invoices');

    // Create signs for signs deployed metric
    await prisma.sign.createMany({
      data: [
        {
          signNumber: 'SIGN-001',
          type: 'GENERIC_24',
          status: 'DEPLOYED',
        },
        {
          signNumber: 'SIGN-002',
          type: 'GENERIC_18',
          status: 'AVAILABLE',
        },
        {
          signNumber: 'SIGN-003',
          type: 'GENERIC_24',
          status: 'DEPLOYED',
        },
        {
          signNumber: 'SIGN-004',
          type: 'RIDER',
          status: 'AVAILABLE',
        },
      ],
    });
    console.log('✓ Created 4 test signs');

    console.log('\n✨ Test data seeded successfully!');
    console.log('\nYou can now login with:');
    console.log('  Email: admin@test.com');
    console.log('  Password: password123');
  } catch (error) {
    console.error('Error seeding test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
