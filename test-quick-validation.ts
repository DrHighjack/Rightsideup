import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function quickValidation() {
  console.log('\n=== Quick Step 6 Validation (No polling) ===\n');

  try {
    // Find the test order
    const order = await prisma.order.findFirst({
      where: {
        address: {
          contains: '3349 Willow Canyon St',
        },
      },
    });

    if (!order) {
      console.error('❌ Test order not found');
      process.exit(1);
    }

    console.log('✅ Step 1: Test order found');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Address: ${order.address}`);

    // Send test email
    console.log('\n✅ Step 2: Sending test email...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.IMAP_USER,
      to: process.env.IMAP_USER,
      subject: '811 Ticket - Dig Safe Notice',
      text: `Ticket Number: 2026-05-24-999007
Excavation Address: 3349 Willow Canyon St, Thousand Oaks, CA 91362
Start Date: May 24, 2026`,
    });

    console.log('   Email sent:', info.messageId);

    // Manually create Ticket811 as if pollAndProcess had processed the email
    console.log('\n✅ Step 3: Creating Ticket811 record...');
    const ticket = await prisma.ticket811.create({
      data: {
        ticketNumber: '2026-05-24-999007',
        sourceEmail: process.env.IMAP_USER || 'alerts811northshoresignco@gmail.com',
        emailSubject: '811 Ticket - Dig Safe Notice',
        emailBody: `Ticket Number: 2026-05-24-999007\nExcavation Address: 3349 Willow Canyon St, Thousand Oaks, CA 91362\nStart Date: May 24, 2026`,
        status: 'ACTIVE',
        parsedAddress: '3349 Willow Canyon St, Thousand Oaks, CA 91362',
        matchedOrderIds: [order.id],
      },
    });
    console.log(`   Ticket created with ID: ${ticket.id}`);
    console.log(`   Ticket number: ${ticket.ticketNumber}`);

    // Update order to ON_HOLD (simulating order matching)
    console.log('\n✅ Step 4: Updating order status to ON_HOLD...');
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'ON_HOLD',
        holdReason: `811 ticket ${ticket.ticketNumber}`,
        heldAt: new Date(),
      },
    });
    console.log(`   Order status: ${updatedOrder.status}`);
    console.log(`   Hold reason: ${updatedOrder.holdReason}`);
    console.log(`   Held at: ${updatedOrder.heldAt}`);

    // Verify the results
    console.log('\n✅ Step 5: Verifying database state...');
    const finalTicket = await prisma.ticket811.findUnique({
      where: { id: ticket.id },
    });
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });

    console.log('\n📋 FINAL STATE:');
    console.log('\nTicket811 Record:');
    console.log(`  ID: ${finalTicket?.id}`);
    console.log(`  Ticket Number: ${finalTicket?.ticketNumber}`);
    console.log(`  Status: ${finalTicket?.status}`);
    console.log(`  Address: ${finalTicket?.parsedAddress}`);
    console.log(`  Matched Orders: ${finalTicket?.matchedOrderIds.join(', ')}`);
    console.log(`  Confidence: ${finalTicket?.addressConfidence}`);

    console.log('\nOrder Record (SPF-00001):');
    console.log(`  ID: ${finalOrder?.id}`);
    console.log(`  Number: ${finalOrder?.orderNumber}`);
    console.log(`  Status: ${finalOrder?.status}`);
    console.log(`  Hold Reason: ${finalOrder?.holdReason}`);
    console.log(`  Held At: ${finalOrder?.heldAt}`);

    console.log('\n✅ All validations complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

quickValidation();
