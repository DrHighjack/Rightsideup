const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.inventoryItem.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      imageUrl: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`COUNT\t${rows.length}`);

  for (const row of rows) {
    console.log([row.id, row.name, row.category, row.imageUrl || ''].join('\t'));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
