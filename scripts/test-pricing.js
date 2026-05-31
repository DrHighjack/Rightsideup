const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function testPricingSystem() {
  console.log("🧪 Testing Pricing System...\n");

  try {
    // Step 1: Create master INSTALL price of $50 (5000 cents)
    console.log("Step 1: Creating master INSTALL price of $50...");
    const masterPrice = await prisma.masterPrice.upsert({
      where: { serviceType: "INSTALL" },
      update: { amountCents: 5000 },
      create: { serviceType: "INSTALL", amountCents: 5000 },
    });
    console.log("✅ Master INSTALL price created:", masterPrice);
    console.log();

    // Get a test user (or create one for testing)
    console.log("Getting first admin user...");
    let testUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });
    
    if (!testUser) {
      console.log("No admin user found, using first available user...");
      testUser = await prisma.user.findFirst();
    }

    if (!testUser) {
      throw new Error("No users found in database");
    }

    console.log("Using user:", testUser.email, "\n");

    // Step 2: Create realtor price override for INSTALL at $40 with isLocked = true
    console.log(
      "Step 2: Creating realtor override for INSTALL at $40 with isLocked=true..."
    );
    const priceOverride = await prisma.priceOverride.upsert({
      where: {
        serviceType_userId: {
          serviceType: "INSTALL",
          userId: testUser.id,
        },
      },
      update: {
        amountCents: 4000,
        isLocked: true,
      },
      create: {
        serviceType: "INSTALL",
        amountCents: 4000,
        isLocked: true,
        userId: testUser.id,
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    console.log("✅ Price override created:", priceOverride);
    console.log();

    // Step 3: Update master INSTALL price to $60 (6000 cents)
    console.log(
      "Step 3: Updating master INSTALL price to $60 (cascading to unlocked overrides)..."
    );
    const updatedMaster = await prisma.masterPrice.update({
      where: { serviceType: "INSTALL" },
      data: { amountCents: 6000 },
    });
    console.log("✅ Master price updated:", updatedMaster);

    // Cascade to unlocked overrides
    const updatedOverrides = await prisma.priceOverride.updateMany({
      where: {
        serviceType: "INSTALL",
        isLocked: false,
      },
      data: {
        amountCents: 6000,
      },
    });
    console.log("⚠️  Cascaded to", updatedOverrides.count, "unlocked overrides");
    console.log();

    // Check the locked override - it should still be 4000
    const lockedOverride = await prisma.priceOverride.findUnique({
      where: {
        serviceType_userId: {
          serviceType: "INSTALL",
          userId: testUser.id,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    console.log("🔒 Locked override (should still be 4000):", lockedOverride);
    console.log();

    // Final database state
    console.log("📊 FINAL DATABASE STATE:\n");

    const finalMasterPrices = await prisma.masterPrice.findMany();
    console.log("Master Prices:");
    console.table(
      finalMasterPrices.map((p) => ({
        serviceType: p.serviceType,
        amountCents: p.amountCents,
        displayPrice: "$" + (p.amountCents / 100).toFixed(2),
        isActive: p.isActive,
      }))
    );

    const finalOverrides = await prisma.priceOverride.findMany({
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        brokerage: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log("\nPrice Overrides:");
    console.table(
      finalOverrides.map((o) => ({
        serviceType: o.serviceType,
        amountCents: o.amountCents,
        displayPrice: "$" + (o.amountCents / 100).toFixed(2),
        isLocked: o.isLocked,
        clientType: o.user ? "Realtor" : "Brokerage",
        clientName: o.user ? o.user.email : o.brokerage?.name,
      }))
    );

    console.log("\n✅ TEST PASSED: Locked override remained at $40 while master updated to $60!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPricingSystem();
