#!/usr/bin/env npx ts-node
/**
 * Setup test realtor for 811 portal testing
 */

import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';

async function setupTestRealtor() {
  try {
    console.log('🔧 Setting up test realtor for 811 portal testing\n');

    // Create or update test realtor with known credentials
    const hashedPassword = await hash('password123', 10);

    const realtor = await prisma.user.upsert({
      where: { email: 'testrealtor@example.com' },
      update: {
        passwordHash: hashedPassword,
      },
      create: {
        email: 'testrealtor@example.com',
        firstName: 'Test',
        lastName: 'Realtor',
        passwordHash: hashedPassword,
        role: 'REALTOR',
      },
    });

    console.log(`✅ Realtor account ready:`);
    console.log(`   Email: ${realtor.email}`);
    console.log(`   Password: password123`);
    console.log(`   ID: ${realtor.id}\n`);

    // Check if there are any existing 811 tickets for this realtor
    const existingTickets = await prisma.ticket811.findMany({
      where: { realtorId: realtor.id },
    });

    if (existingTickets.length > 0) {
      console.log(`✅ Found ${existingTickets.length} existing 811 ticket(s) for this realtor`);
      existingTickets.forEach((ticket) => {
        console.log(`   - ${ticket.id}: ${ticket.parsedAddress}`);
      });
    } else {
      console.log('ℹ️  No existing 811 tickets found');
      console.log('   Create a test ticket by running: npx tsx scripts/test-811-routes.ts');
    }

    console.log('\n✅ Test setup complete!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestRealtor();
