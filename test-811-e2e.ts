import { PrismaClient } from '@prisma/client';
import { pollAndProcess } from './lib/emailPoller';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function runE2ETest() {
  console.log('\n=== 811 E2E Test ===\n');

  try {
    // Step 1: Find the order with matching address
    console.log('Step 1: Looking for order with address "3349 Willow Canyon St, Thousand Oaks, CA 91362"...');
    const order = await prisma.order.findFirst({
      where: {
        address: {
          contains: '3349 Willow Canyon St',
        },
      },
    });

    if (!order) {
      console.error('❌ Order not found! Cannot run test without matching order.');
      process.exit(1);
    }

    console.log(`✅ Found order: ${order.orderNumber} (ID: ${order.id})`);
    console.log(`   Address: ${order.address}`);
    console.log(`   Current Status: ${order.status}`);

    if (order.status !== 'PENDING' && order.status !== 'SCHEDULED') {
      console.warn(`⚠️  Order status is ${order.status}, not PENDING/SCHEDULED. Updating to PENDING...`);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PENDING' },
      });
      console.log('✅ Order status updated to PENDING');
    }

    // Step 2: Send test email to 811 inbox
    console.log('\nStep 2: Sending test 811 email...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASSWORD,
      },
    });

    const emailSubject = '811 Ticket - Dig Safe Notice';
    const emailBody = `Ticket Number: 2026-05-24-999001
Excavation Address: 3349 Willow Canyon St, Thousand Oaks, CA 91362
Work Start Date: 05/28/2026
Contractor: SoCal Gas
Status: Active`;

    await transporter.sendMail({
      from: process.env.IMAP_USER,
      to: process.env.IMAP_USER, // Send to same inbox
      subject: emailSubject,
      text: emailBody,
    });

    console.log(`✅ Test email sent to ${process.env.IMAP_USER}`);
    console.log(`   Subject: ${emailSubject}`);
    console.log(`   Body preview: ${emailBody.substring(0, 100)}...`);

    // Step 3: Wait a moment for email to arrive, then run pollAndProcess
    console.log('\nStep 3: Waiting 3 seconds for email to arrive in inbox...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('✅ Running pollAndProcess()...');
    await pollAndProcess();
    console.log('✅ Poll cycle completed');

    // Step 4: Verify results
    console.log('\nStep 4: Verifying results...\n');

    // Check Ticket811 record
    const ticket = await prisma.ticket811.findFirst({
      where: {
        ticketNumber: '2026-05-24-999001',
      },
    });

    if (ticket) {
      console.log('✅ TICKET811 RECORD CREATED:');
      console.log(`   ID: ${ticket.id}`);
      console.log(`   Ticket Number: ${ticket.ticketNumber}`);
      console.log(`   Address: ${ticket.parsedAddress}`);
      console.log(`   Status: ${ticket.status}`);
      console.log(`   Matched Order IDs: ${JSON.stringify(ticket.matchedOrderIds)}`);
      console.log(`   Created At: ${ticket.createdAt}`);
    } else {
      console.error('❌ Ticket811 record NOT found!');
    }

    // Check order status
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    if (updatedOrder) {
      console.log('\n✅ ORDER STATUS UPDATE:');
      console.log(`   Order ID: ${updatedOrder.id}`);
      console.log(`   Order Number: ${updatedOrder.orderNumber}`);
      console.log(`   Status: ${updatedOrder.status}`);
      console.log(`   Hold Reason: ${updatedOrder.holdReason || '(none)'}`);
      console.log(`   Held At: ${updatedOrder.heldAt ? updatedOrder.heldAt.toISOString() : '(not set)'}`);

      if (updatedOrder.status === 'ON_HOLD') {
        console.log('   ✅ Status correctly changed to ON_HOLD');
      } else {
        console.error('   ❌ Status was NOT changed to ON_HOLD');
      }

      if (updatedOrder.holdReason?.includes('2026-05-24-999001')) {
        console.log('   ✅ Hold reason correctly references ticket number');
      } else {
        console.error('   ❌ Hold reason does not reference ticket');
      }
    }

    console.log('\n=== E2E Test Complete ===\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETest();
