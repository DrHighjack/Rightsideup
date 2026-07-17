const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Updating salesmen to admins...\n");

    // Update Tyson Sims
    const tyson = await prisma.user.updateMany({
      where: {
        firstName: "Tyson",
        lastName: "Sims",
        role: "SALESMEN",
      },
      data: {
        role: "ADMIN",
      },
    });
    console.log(`✅ Tyson Sims: ${tyson.count} user(s) updated to ADMIN`);

    // Update Lexee
    const lexee = await prisma.user.updateMany({
      where: {
        firstName: "Lexee",
        role: "SALESMEN",
      },
      data: {
        role: "ADMIN",
      },
    });
    console.log(`✅ Lexee: ${lexee.count} user(s) updated to ADMIN`);

    // Update Max Treble
    const max = await prisma.user.updateMany({
      where: {
        firstName: "Max",
        lastName: "Treble",
        role: "SALESMEN",
      },
      data: {
        role: "ADMIN",
      },
    });
    console.log(`✅ Max Treble: ${max.count} user(s) updated to ADMIN`);

    console.log("\n✅ All three users updated to ADMIN role!");

    // Verify the updates
    console.log("\n📋 Verification:");
    const updated = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: "Tyson", lastName: "Sims" },
          { firstName: "Lexee" },
          { firstName: "Max", lastName: "Treble" },
        ],
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    updated.forEach((user) => {
      console.log(`${user.firstName} ${user.lastName}: ${user.role} (${user.email})`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
})();
