import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api';

async function testClearTicket() {
  console.log('\n=== Testing Step 7: Clear Ticket & Verify Order Release ===\n');

  try {
    // Step 1: Find the ticket we created
    console.log('Step 1: Finding ticket 2026-05-24-999007...');
    const ticket = await prisma.ticket811.findFirst({
      where: { ticketNumber: '2026-05-24-999007' },
      include: {
        clearedByUser: true,
      },
    });

    if (!ticket) {
      console.error('❌ Ticket not found');
      process.exit(1);
    }

    console.log(`✅ Found ticket: ${ticket.id}`);
    console.log(`   Status: ${ticket.status}`);
    console.log(`   Matched Orders: ${ticket.matchedOrderIds.join(', ')}`);

    // Step 2: Get the order before clearing
    console.log('\nStep 2: Checking order status before clear...');
    const orderBefore = await prisma.order.findUnique({
      where: { id: ticket.matchedOrderIds[0] },
    });

    console.log(`✅ Order ${orderBefore?.orderNumber}:`);
    console.log(`   Status: ${orderBefore?.status}`);
    console.log(`   Hold Reason: ${orderBefore?.holdReason}`);

    if (orderBefore?.status !== 'ON_HOLD') {
      console.warn('⚠️  Order is not ON_HOLD, skipping test');
      process.exit(0);
    }

    // Step 3: Call the clear endpoint
    console.log('\nStep 3: Calling clear endpoint...');
    const response = await fetch(`${API_BASE}/admin/811/${ticket.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'clear',
        adminNotes: 'Test clear - excavation completed safely',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Clear failed with status ${response.status}: ${JSON.stringify(errorData, null, 2)}`);
    }

    const result = (await response.json()) as any;
    console.log(`✅ Clear response: ${result.message}`);

    // Step 4: Verify the order is now SCHEDULED
    console.log('\nStep 4: Verifying order status after clear...');
    const orderAfter = await prisma.order.findUnique({
      where: { id: ticket.matchedOrderIds[0] },
    });

    console.log(`✅ Order ${orderAfter?.orderNumber}:`);
    console.log(`   Status: ${orderAfter?.status}`);
    console.log(`   Hold Reason: ${orderAfter?.holdReason}`);

    // Step 5: Verify ticket status changed to CLEARED
    console.log('\nStep 5: Verifying ticket status...');
    const ticketAfter = await prisma.ticket811.findUnique({
      where: { id: ticket.id },
    });

    console.log(`✅ Ticket ${ticketAfter?.ticketNumber}:`);
    console.log(`   Status: ${ticketAfter?.status}`);
    console.log(`   Cleared At: ${ticketAfter?.clearedAt}`);

    // Step 6: Validation
    console.log('\n=== VALIDATION ===');
    const passed =
      orderAfter?.status === 'SCHEDULED' &&
      orderAfter?.holdReason === null &&
      ticketAfter?.status === 'CLEARED';

    if (passed) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('   - Order returned to SCHEDULED status');
      console.log('   - Hold reason cleared');
      console.log('   - Ticket marked as CLEARED');
    } else {
      console.error('❌ VALIDATION FAILED!');
      if (orderAfter?.status !== 'SCHEDULED') {
        console.error(`   - Order status is ${orderAfter?.status}, expected SCHEDULED`);
      }
      if (orderAfter?.holdReason !== null) {
        console.error(`   - Hold reason is still set: ${orderAfter?.holdReason}`);
      }
      if (ticketAfter?.status !== 'CLEARED') {
        console.error(`   - Ticket status is ${ticketAfter?.status}, expected CLEARED`);
      }
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testClearTicket();
