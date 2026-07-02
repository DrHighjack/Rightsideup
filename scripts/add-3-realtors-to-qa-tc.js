require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function ensureRealtorAndLink(tcEmail, realtorData) {
  const tc = await prisma.user.findUnique({ where: { email: tcEmail } });
  if (!tc) throw new Error(`TC account not found: ${tcEmail}`);

  const passwordHash = await bcrypt.hash(realtorData.password, 10);

  const realtor = await prisma.user.upsert({
    where: { email: realtorData.email },
    update: {
      firstName: realtorData.firstName,
      lastName: realtorData.lastName,
      role: "REALTOR",
      passwordHash,
    },
    create: {
      email: realtorData.email,
      passwordHash,
      firstName: realtorData.firstName,
      lastName: realtorData.lastName,
      role: "REALTOR",
    },
  });

  await prisma.tCAgentLink.upsert({
    where: {
      tcUserId_agentUserId: {
        tcUserId: tc.id,
        agentUserId: realtor.id,
      },
    },
    update: {},
    create: {
      tcUserId: tc.id,
      agentUserId: realtor.id,
      grantedBy: "ADMIN",
    },
  });

  return realtor;
}

async function main() {
  const tcEmail = "qa.tc@rightsignup.local";
  const realtors = [
    {
      firstName: "Alex",
      lastName: "Morgan",
      email: "alex.morgan.tc1@rightsignup.local",
      password: "realtor123456",
    },
    {
      firstName: "Casey",
      lastName: "Parker",
      email: "casey.parker.tc2@rightsignup.local",
      password: "realtor123456",
    },
    {
      firstName: "Jordan",
      lastName: "Blake",
      email: "jordan.blake.tc3@rightsignup.local",
      password: "realtor123456",
    },
  ];

  for (const realtor of realtors) {
    const saved = await ensureRealtorAndLink(tcEmail, realtor);
    console.log(`Linked: ${saved.firstName} ${saved.lastName} <${saved.email}>`);
  }

  const tc = await prisma.user.findUnique({ where: { email: tcEmail } });
  const links = await prisma.tCAgentLink.findMany({
    where: { tcUserId: tc.id },
    include: {
      agentUser: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nTC ${tcEmail} now has ${links.length} linked realtor(s):`);
  links.forEach((l, i) => {
    console.log(`${i + 1}. ${l.agentUser.firstName} ${l.agentUser.lastName} <${l.agentUser.email}>`);
  });
}

main()
  .catch((err) => {
    console.error("Error:", err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
