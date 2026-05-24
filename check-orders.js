const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        realtor: true,
        items: true,
      },
    });

    console.log('\n=== ORDERS IN DATABASE ===\n');
    if (orders.length === 0) {
      console.log('No orders found in database');
    } else {
      orders.forEach((order, index) => {
        console.log(`Order ${index + 1}:`);
        console.log(`  ID: ${order.id}`);
        console.log(`  Number: ${order.orderNumber}`);
        console.log(`  Realtor: ${order.realtor.firstName} ${order.realtor.lastName}`);
        console.log(`  Address: ${order.address}`);
        console.log(`  Type: ${order.type}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Created: ${order.createdAt}`);
        console.log(`  Items: ${order.items.length} item(s)`);
        console.log('');
      });
    }

    const userCount = await prisma.user.count();
    console.log(`Total Users in Database: ${userCount}`);
    console.log(`Total Orders in Database: ${orders.length}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
