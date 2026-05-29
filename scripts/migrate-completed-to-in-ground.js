const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.order.updateMany({
      where: {
        status: "COMPLETED",
      },
      data: {
        status: "IN_GROUND",
      },
    });

    console.log(`✓ Updated ${result.count} orders from COMPLETED to IN_GROUND`);
  } catch (error) {
    console.error("Error updating orders:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
