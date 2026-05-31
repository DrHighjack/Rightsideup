const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSalesmen() {
  const salesmen = [
    {
      firstName: 'Tyson',
      lastName: 'Sims',
      email: 'postproidaho@gmail.com',
      password: 'CloudMoon956$',
    },
    {
      firstName: 'Lexee',
      lastName: '',
      email: '02awofford@gmail.com',
      password: 'SilverWave284#',
    },
    {
      firstName: 'Max',
      lastName: 'Treble',
      email: 'maxtreblebusiness@gmail.com',
      password: 'GoldenPath739@',
    },
  ];

  try {
    for (const salesman of salesmen) {
      const passwordHash = await bcrypt.hash(salesman.password, 10);
      
      const user = await prisma.user.create({
        data: {
          email: salesman.email,
          passwordHash,
          firstName: salesman.firstName,
          lastName: salesman.lastName,
          role: 'SALESMEN',
        },
      });
      
      console.log(`✅ Created: ${salesman.firstName} ${salesman.lastName}`);
      console.log(`   Email: ${salesman.email}`);
      console.log(`   Password: ${salesman.password}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error creating salesmen:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSalesmen();
