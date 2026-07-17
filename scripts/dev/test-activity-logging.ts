import { PrismaClient, ActivityAction } from '@prisma/client';
import { logActivity } from '../../lib/activityLog';

const prisma = new PrismaClient();

async function testActivityLogging() {
  try {
    console.log('Creating/getting test admin user...');
    const uniqueEmail = `test-admin-${Date.now()}@test.com`;
    const admin = await prisma.user.create({
      data: {
        email: uniqueEmail,
        firstName: 'Test',
        lastName: 'Admin',
        role: 'ADMIN',
        passwordHash: 'hashed_password_placeholder',
      },
    });
    console.log('✓ Admin created:', admin.id);

    console.log('\nCreating test order...');
    const order = await prisma.order.create({
      data: {
        orderNumber: `TEST-${Date.now()}`,
        status: 'PENDING',
        realtorId: admin.id,
        type: 'SIGN_INSTALLATION',
        address: '123 Test St, Test City, ST 12345',
      },
    });
    console.log('✓ Order created:', order.id, 'Status:', order.status);

    console.log('\nUpdating order status to SCHEDULED...');
    const oldStatus = order.status;
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'SCHEDULED', scheduledDate: new Date() },
    });
    console.log('✓ Order updated:', updatedOrder.id, 'New Status:', updatedOrder.status);

    // Simulate what the API route does - log the activity
    console.log('\nLogging activity...');
    await logActivity({
      userId: admin.id,
      action: ActivityAction.ORDER_STATUS_CHANGED,
      entityType: 'Order',
      entityId: order.id,
      description: `Order status changed from ${oldStatus} to ${updatedOrder.status}`,
      metadata: {
        orderNumber: updatedOrder.orderNumber,
        oldStatus,
        newStatus: updatedOrder.status,
      },
    });
    console.log('✓ Activity logged');

    console.log('\nWaiting 2 seconds for activity log to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\nFetching ActivityLog records...');
    const activityLogs = await prisma.activityLog.findMany({
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n✓ Found ${activityLogs.length} activity log(s)\n`);
    activityLogs.forEach((log, idx) => {
      console.log(`[${idx + 1}] Activity Log:`);
      console.log(`   ID: ${log.id}`);
      console.log(`   User: ${log.user.email}`);
      console.log(`   Action: ${log.action}`);
      console.log(`   Entity Type: ${log.entityType}`);
      console.log(`   Entity ID: ${log.entityId}`);
      console.log(`   Description: ${log.description}`);
      console.log(`   Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log(`   Created: ${log.createdAt}\n`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testActivityLogging();
