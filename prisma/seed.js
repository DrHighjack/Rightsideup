const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@signpost.local" },
  });

  let admin;
  if (!existingAdmin) {
    const adminPasswordHash = await bcrypt.hash("admin123456", 12);
    admin = await prisma.user.create({
      data: {
        email: "admin@signpost.local",
        passwordHash: adminPasswordHash,
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
      },
    });
    console.log("✅ Admin account created: admin@signpost.local / admin123456");
  } else {
    admin = existingAdmin;
    console.log("✅ Admin account already exists");
  }

  // Create test brokerage
  const existingBrokerage = await prisma.brokerage.findFirst({
    where: { name: "Test Brokerage" },
  });

  let brokerage;
  if (!existingBrokerage) {
    brokerage = await prisma.brokerage.create({
      data: {
        name: "Test Brokerage",
        phone: "555-0100",
        email: "info@testbrokerage.local",
        adminId: admin.id,
      },
    });
    console.log("✅ Test brokerage created");
  } else {
    brokerage = existingBrokerage;
    console.log("✅ Test brokerage already exists");
  }

  // Create test realtor if doesn't exist
  const existingRealtor = await prisma.user.findUnique({
    where: { email: "test@realtor.local" },
  });

  if (!existingRealtor) {
    const realtorPasswordHash = await bcrypt.hash("realtor123456", 12);
    await prisma.user.create({
      data: {
        email: "test@realtor.local",
        passwordHash: realtorPasswordHash,
        firstName: "Test",
        lastName: "Realtor",
        phone: "555-1234",
        brokerageName: "Test Brokerage",
        brokerageId: brokerage.id,
        role: "REALTOR",
        paymentMethod: "OFFICE",
      },
    });
    console.log("✅ Test realtor account created: test@realtor.local / realtor123456");
  } else {
    console.log("✅ Test realtor account already exists");
  }

  // Create sign types
  // Seed Signs (commented out due to schema mismatch - Sign model doesn't have 'name' field)
  // const signs = [
  //   {
  //     name: "Standard Yard Sign 18x24",
  //     description: "Classic yard sign for residential properties",
  //     imageUrl: "/images/sign-standard-18x24.jpg",
  //     price: 15,
  //   },
  //   {
  //     name: "Premium Yard Sign 24x36",
  //     description: "Larger premium yard sign",
  //     imageUrl: "/images/sign-premium-24x36.jpg",
  //     price: 25,
  //   },
  //   {
  //     name: "Window Sign A-Frame",
  //     description: "A-frame window sign",
  //     imageUrl: "/images/sign-aframe.jpg",
  //     price: 20,
  //   },
  //   {
  //     name: "Door Hangers",
  //     description: "Pre-printed door hangers (100 pack)",
  //     imageUrl: "/images/sign-door-hangers.jpg",
  //     price: 50,
  //   },
  // ];

  // for (const sign of signs) {
  //   const existingSign = await prisma.sign.findFirst({
  //     where: { name: sign.name },
  //   });

  //   if (!existingSign) {
  //     await prisma.sign.create({
  //       data: sign,
  //     });
  //     console.log(`✅ Sign created: ${sign.name}`);
  //   }
  // }

  // // Create inventory for signs
  // const allSigns = await prisma.sign.findMany();
  // for (const sign of allSigns) {
  //   const existingInventory = await prisma.signInventory.findFirst({
  //     where: { signId: sign.id },
  //   });

  //   if (!existingInventory) {
  //     await prisma.signInventory.create({
  //       data: {
  //         signId: sign.id,
  //         quantity: 50,
  //         location: "Warehouse A",
  //       },
  //     });
  //     console.log(`✅ Inventory created for: ${sign.name} (50 units)`);
  //   }
  // }

  console.log("✅ Database seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
