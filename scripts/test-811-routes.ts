/**
 * Test script for 811 ticket tracker API routes
 */

import { prisma } from '@/lib/prisma';

async function testTicket811Routes() {
  try {
    console.log('🧪 Testing 811 Ticket Tracker API Routes\n');

    // Step 1: Get test realtor user
    const testRealtorId = 'cmpu9v0uu0000iy277uabg8vc'; // Test realtor created by setup script
    
    const realtor = await prisma.user.findUnique({
      where: { id: testRealtorId },
    });

    if (!realtor) {
      console.error('❌ Test realtor not found');
      console.error('   Run: npx tsx scripts/setup-test-realtor.ts');
      return;
    }

    console.log(`✅ Found realtor: ${realtor.firstName} ${realtor.lastName} (${realtor.id})\n`);

    // Step 2: Create test ticket with 3 utility lines
    const utilityLines = [
      { name: 'Electric', status: 'PENDING' as const },
      { name: 'Gas', status: 'PENDING' as const },
      { name: 'Water', status: 'PENDING' as const },
    ];

    const testTicket = await prisma.ticket811.create({
      data: {
        ticketNumber: 'TEST-811-001',
        sourceEmail: 'test@811service.com',
        emailSubject: 'Locate Request',
        emailBody: 'Test ticket for development',
        parsedAddress: '123 Main St, Springfield, IL 62701',
        workStartDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        realtorId: realtor.id,
        utilityLines: utilityLines as any,
        requestedDate: new Date(),
        stage: 'REQUESTED',
      },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    console.log(`✅ Created test ticket: ${testTicket.ticketNumber} (${testTicket.id})`);
    console.log(`   Address: ${testTicket.parsedAddress}`);
    const utilLines = Array.isArray(testTicket.utilityLines) ? testTicket.utilityLines : [];
    console.log(`   Utilities: ${utilLines.length} lines`);
    console.log(`   Current Stage: ${testTicket.stage}\n`);

    // Step 3: Test GET /api/realtor/811
    console.log('📡 TEST 1: GET /api/realtor/811');
    const response1 = await fetch('http://localhost:3000/api/realtor/811', {
      headers: {
        'Content-Type': 'application/json',
        // Note: In real test, would need valid auth session
      },
    });

    if (!response1.ok) {
      console.log(`⚠️  Response: ${response1.status} (expected without auth session)\n`);
    } else {
      const data = await response1.json();
      console.log(`✅ Response: ${data.tickets?.length || 0} tickets returned`);
      console.log(`   (Note: Actual count depends on your session auth)\n`);
    }

    // Step 4: Test PUT /api/admin/811/[id]/utilities
    console.log('📡 TEST 2: PUT /api/admin/811/[id]/utilities');
    console.log(`   Updating "Electric" utility to RESPONDED status...\n`);

    const response2 = await fetch(
      `http://localhost:3000/api/admin/811/${testTicket.id}/utilities`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineName: 'Electric',
          status: 'RESPONDED',
          respondedAt: new Date().toISOString(),
        }),
      }
    );

    if (!response2.ok) {
      console.log(`⚠️  Response: ${response2.status} (expected without admin auth)\n`);
    } else {
      const data = await response2.json();
      console.log(`✅ Utility line updated`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Current Stage: ${data.ticket.stage}`);
      console.log(`   Utilities:`);
      const lines2 = Array.isArray(data.ticket.utilityLines) ? data.ticket.utilityLines : [];
      lines2.forEach((line: any) => {
        console.log(`     - ${line.name}: ${line.status}`);
      });
      console.log();
    }

    // Step 5: Test updating another utility line to CLEAR
    console.log('📡 TEST 3: PUT /api/admin/811/[id]/utilities (update Gas to CLEAR)');
    const response3 = await fetch(
      `http://localhost:3000/api/admin/811/${testTicket.id}/utilities`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineName: 'Gas',
          status: 'CLEAR',
          respondedAt: new Date().toISOString(),
        }),
      }
    );

    if (!response3.ok) {
      console.log(`⚠️  Response: ${response3.status} (expected without admin auth)\n`);
    } else {
      const data = await response3.json();
      console.log(`✅ Utility line updated`);
      console.log(`   Message: ${data.message}`);
      console.log(`   Current Stage: ${data.ticket.stage}`);
      console.log(`   Utilities:`);
      const lines3 = Array.isArray(data.ticket.utilityLines) ? data.ticket.utilityLines : [];
      lines3.forEach((line: any) => {
        console.log(`     - ${line.name}: ${line.status}`);
      });
      console.log();
    }

    // Step 6: Test PUT /api/admin/811/[id]/stage
    console.log('📡 TEST 4: PUT /api/admin/811/[id]/stage');
    console.log(`   Advancing stage to TICKET_SUBMITTED...\n`);

    const response4 = await fetch(
      `http://localhost:3000/api/admin/811/${testTicket.id}/stage`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: 'TICKET_SUBMITTED',
        }),
      }
    );

    if (!response4.ok) {
      console.log(`⚠️  Response: ${response4.status} (expected without admin auth)\n`);
    } else {
      const data = await response4.json();
      console.log(`✅ Stage updated`);
      console.log(`   Message: ${data.message}`);
      console.log(`   New Stage: ${data.ticket.stage}\n`);
    }

    // Fetch final state
    const finalTicket = await prisma.ticket811.findUnique({
      where: { id: testTicket.id },
      include: {
        realtor: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    console.log('📊 Final Ticket State:');
    console.log(`   ID: ${finalTicket?.id}`);
    console.log(`   Realtor: ${finalTicket?.realtor?.firstName} ${finalTicket?.realtor?.lastName}`);
    console.log(`   Address: ${finalTicket?.parsedAddress}`);
    console.log(`   Stage: ${finalTicket?.stage}`);
    console.log(`   Utilities:`);
    const finalLines = Array.isArray(finalTicket?.utilityLines) ? finalTicket?.utilityLines : [];
    finalLines.forEach((line: any) => {
      console.log(`     - ${line.name}: ${line.status}`);
    });
    console.log();

    console.log(
      '✅ All API routes created and test ticket ready for browser testing!\n'
    );
    console.log(`Test ticket ID: ${testTicket.id}`);
    console.log(`Realtor ID: ${realtor.id}`);
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTicket811Routes();
