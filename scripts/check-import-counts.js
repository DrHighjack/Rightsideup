#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const realtorUsers = await prisma.user.count({
    where: { role: 'REALTOR' },
  });

  const orders = await prisma.order.count();
  const leads = await prisma.instaads.count();

  console.log(
    JSON.stringify(
      {
        realtorUsers,
        orders,
        leads,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });