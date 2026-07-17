require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      take: 5,
    });
    
    console.log('Users in database:');
    console.log(JSON.stringify(users, null, 2));
    
    if (users.length === 0) {
      console.log('\nNo users found. You may need to create a user first.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
