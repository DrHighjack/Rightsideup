const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    const inGroundCount = await prisma.order.count({
      where: { status: "IN_GROUND" },
    });

    const completedCount = await prisma.order.count({
      where: { status: "COMPLETED" },
    });

    console.log(`IN_GROUND orders: ${inGroundCount}`);
    console.log(`COMPLETED orders: ${completedCount}`);

    const statusBreakdown = await prisma.order.groupBy({
      by: ["status"],
      _count: true,
    });

    console.log("\nStatus breakdown:");
    statusBreakdown.forEach((item) => {
      console.log(`  ${item.status}: ${item._count}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
