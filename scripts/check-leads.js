#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLeads() {
  try {
    const leads = await prisma.instaads.findMany({
      orderBy: {
        createdAt: 'desc',
      }
    });

    console.log(`\n📊 Total Leads in Database: ${leads.length}\n`);
    
    if (leads.length === 0) {
      console.log('❌ No leads found in the instaads table');
      console.log('\n💡 The test lead (Sarah Johnson) was wiped when you cleared the database.');
      console.log('   Would you like me to add it back or create a sample lead?\n');
    } else {
      console.log('Leads:');
      leads.forEach((lead, index) => {
        console.log(`\n${index + 1}. ${lead.fullName}`);
        console.log(`   Email: ${lead.email}`);
        console.log(`   Phone: ${lead.phone}`);
        console.log(`   Brokerage: ${lead.brokerage}`);
        console.log(`   Submitted: ${lead.createdAt}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking leads:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLeads();
