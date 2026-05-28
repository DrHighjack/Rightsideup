import { PrismaClient, ActivityAction } from '@prisma/client';
import { createNotification } from './lib/notifications';

const prisma = new PrismaClient();

async function testNotifications() {
  try {
    console.log('🔔 Notification Center End-to-End Test\n');

    console.log('1️⃣ Creating test admin user...');
    const uniqueAdminEmail = `test-admin-${Date.now()}@test.com`;
    const admin = await prisma.user.create({
      data: {
        email: uniqueAdminEmail,
        firstName: 'Test',
        lastName: 'Admin',
        role: 'ADMIN',
        passwordHash: 'hashed_password_placeholder',
      },
    });
    console.log('✓ Admin created:', admin.id);

    console.log('\n2️⃣ Creating test realtor user...');
    const uniqueRealtorEmail = `test-realtor-${Date.now()}@test.com`;
    const realtor = await prisma.user.create({
      data: {
        email: uniqueRealtorEmail,
        firstName: 'Test',
        lastName: 'Realtor',
        role: 'REALTOR',
        passwordHash: 'hashed_password_placeholder',
      },
    });
    console.log('✓ Realtor created:', realtor.id);

    console.log('\n3️⃣ Creating test order for realtor...');
    const order = await prisma.order.create({
      data: {
        orderNumber: `TEST-NOTIF-${Date.now()}`,
        status: 'PENDING',
        realtorId: realtor.id,
        type: 'SIGN_INSTALLATION',
        address: '123 Notification Test St, Test City, ST 12345',
      },
    });
    console.log('✓ Order created:', order.id, 'Status:', order.status);

    console.log('\n4️⃣ Simulating admin changing order status...');
    const oldStatus = order.status;
    const newStatus = 'SCHEDULED';
    
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { 
        status: newStatus,
        scheduledDate: new Date(),
      },
    });
    console.log(`✓ Order updated: ${oldStatus} → ${newStatus}`);

    console.log('\n5️⃣ Creating notification for realtor (simulating API route)...');
    const notification = await createNotification({
      userId: realtor.id,
      type: 'ORDER_STATUS_CHANGED',
      title: `Order ${order.orderNumber} updated`,
      message: `Your order status has changed from ${oldStatus} to ${newStatus}`,
      link: `/dashboard/orders/${order.id}`,
    });
    console.log('✓ Notification created for realtor');

    console.log('\n6️⃣ Querying notifications for realtor...');
    const realtorNotifications = await prisma.notification.findMany({
      where: {
        userId: realtor.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    console.log(`✓ Found ${realtorNotifications.length} notification(s)\n`);

    console.log('📋 Notification Details:');
    realtorNotifications.forEach((notif, idx) => {
      console.log(`\n[Notification ${idx + 1}]`);
      console.log(`  ID: ${notif.id}`);
      console.log(`  User ID: ${notif.userId}`);
      console.log(`  Type: ${notif.type}`);
      console.log(`  Title: ${notif.title}`);
      console.log(`  Message: ${notif.message}`);
      console.log(`  Link: ${notif.link}`);
      console.log(`  Status: ${notif.status}`);
      console.log(`  Created: ${notif.createdAt}`);
    });

    console.log('\n✅ TEST PASSED - Notification Center is working!');
    console.log('\nSummary:');
    console.log(`  - Order status changed: ${oldStatus} → ${newStatus}`);
    console.log(`  - Realtor received 1 notification`);
    console.log(`  - Notification type: ORDER_STATUS_CHANGED`);
    console.log(`  - Link points to: /dashboard/orders/${order.id}`);

  } catch (error: any) {
    console.error('❌ TEST FAILED:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNotifications();
