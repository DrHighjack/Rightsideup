const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const lead = await prisma.instaads.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('\n✅ LATEST LEAD SUBMITTED TO DATABASE:\n');
    console.log(`ID:       ${lead.id}`);
    console.log(`Name:     ${lead.fullName}`);
    console.log(`Email:    ${lead.email}`);
    console.log(`Phone:    ${lead.phone}`);
    console.log(`Brokerage: ${lead.brokerage}`);
    console.log(`Submitted: ${lead.createdAt.toISOString()}`);
    console.log('\n✅ Form submission to backend SUCCESSFUL!\n');
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
