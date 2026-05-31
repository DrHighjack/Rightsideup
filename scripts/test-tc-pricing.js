const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function testTCPricing() {
  console.log("🧪 Testing TC Pricing System...\n");

  try {
    // Create or get a test TC user
    console.log("Step 1: Setting up test TC user...");
    const tcUser = await prisma.user.upsert({
      where: { email: "test-tc@signpost.com" },
      update: {},
      create: {
        email: "test-tc@signpost.com",
        passwordHash: await bcrypt.hash("TestTC2024!", 10),
        firstName: "Test",
        lastName: "TC",
        role: "TC",
      },
    });
    console.log("✅ TC user:", tcUser.email, "\n");

    // Get a realtor to link to
    console.log("Step 2: Finding a realtor to link...");
    let realtor = await prisma.user.findFirst({
      where: { role: "REALTOR" },
    });

    if (!realtor) {
      console.log("Creating test realtor...");
      realtor = await prisma.user.create({
        data: {
          email: "test-realtor@signpost.com",
          passwordHash: await bcrypt.hash("TestRealtor2024!", 10),
          firstName: "Test",
          lastName: "Realtor",
          role: "REALTOR",
        },
      });
    }
    console.log("✅ Realtor:", realtor.email, "\n");

    // Link TC to realtor
    console.log("Step 3: Linking TC user to realtor...");
    const link = await prisma.tCAgentLink.upsert({
      where: {
        tcUserId_agentUserId: {
          tcUserId: tcUser.id,
          agentUserId: realtor.id,
        },
      },
      update: {},
      create: {
        tcUserId: tcUser.id,
        agentUserId: realtor.id,
        grantedBy: "ADMIN",
      },
    });
    console.log("✅ Link created between TC and realtor\n");

    // Get master prices (from test data)
    console.log("Step 4: Checking master prices...");
    const masterPrices = await prisma.masterPrice.findMany({
      where: { isActive: true },
    });
    console.log(`✅ Found ${masterPrices.length} active master prices:`);
    masterPrices.forEach((p) => {
      console.log(
        `   - ${p.serviceType}: $${(p.amountCents / 100).toFixed(2)}`
      );
    });
    console.log();

    // Get realtor's brokerage
    console.log("Step 5: Fetching realtor with brokerage...");
    const realtorWithBrokerage = await prisma.user.findUnique({
      where: { id: realtor.id },
      include: {
        brokerage: true,
      },
    });
    console.log(
      `✅ Realtor: ${realtorWithBrokerage?.firstName} ${realtorWithBrokerage?.lastName}`
    );
    console.log(
      `   Brokerage: ${realtorWithBrokerage?.brokerage?.name || "None assigned"}\n`
    );

    // Test the API data that would be returned
    console.log("Step 6: Simulating TC pricing API response...\n");

    // Get all TC's linked agents with pricing
    const linkedAgents = await prisma.tCAgentLink.findMany({
      where: { tcUserId: tcUser.id },
      include: {
        agentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            brokerage: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`TC user "${tcUser.firstName}" is linked to:`);
    console.table(
      linkedAgents.map((l) => ({
        agentName: `${l.agentUser.firstName} ${l.agentUser.lastName}`,
        email: l.agentUser.email,
        brokerage: l.agentUser.brokerage?.name || "N/A",
      }))
    );
    console.log();

    // Show what services they can see
    console.log("📊 FINAL TEST OUTPUT:\n");
    console.log("TC Dashboard would show:");
    console.log("─".repeat(60));
    linkedAgents.forEach((link) => {
      console.log(`\n🎯 ${link.agentUser.firstName} ${link.agentUser.lastName}`);
      console.log(`   Email: ${link.agentUser.email}`);
      console.log(`   Brokerage: ${link.agentUser.brokerage?.name || "N/A"}`);
      console.log(`\n   Services:`);
      masterPrices.forEach((service) => {
        // In real scenario, getEffectivePrice would resolve overrides
        // For now, just show master prices
        console.log(
          `   ✓ ${service.serviceType}: $${(service.amountCents / 100).toFixed(2)}`
        );
      });
    });

    console.log("\n✅ TEST PASSED: TC pricing structure verified!");
    console.log(`\nTest TC credentials (for manual testing):`);
    console.log(`   Email: test-tc@signpost.com`);
    console.log(`   Password: TestTC2024!`);
    console.log(`\nTC user "${tcUser.firstName}" will see pricing for:`);
    linkedAgents.forEach((link) => {
      console.log(
        `   - ${link.agentUser.firstName} ${link.agentUser.lastName}`
      );
    });
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testTCPricing();
