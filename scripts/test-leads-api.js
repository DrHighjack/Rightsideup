#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLeadsAPI() {
  try {
    console.log('🧪 Testing Leads Query...\n');

    // Test the exact query the API uses
    const leads = await prisma.instaads.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        brokerage: true,
        createdAt: true,
      },
    });

    console.log('✅ Query successful!\n');
    console.log('Results:', JSON.stringify(leads.map(lead => ({
      ...lead,
      createdAt: lead.createdAt.toISOString(),
    })), null, 2));

  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLeadsAPI();
