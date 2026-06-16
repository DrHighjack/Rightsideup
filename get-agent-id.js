const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const tcUser = await prisma.user.findUnique({
    where: { email: "test-tc@signpost.com" },
  });

  if (tcUser) {
    const links = await prisma.tCAgentLink.findMany({
      where: { tcUserId: tcUser.id },
      include: { agentUser: { select: { id: true, firstName: true, lastName: true } } }
    });

    if (links.length > 0) {
      console.log("Agent ID:", links[0].agentUser.id);
      console.log("Agent Name:", links[0].agentUser.firstName + " " + links[0].agentUser.lastName);
    }
  }

  await prisma.$disconnect();
})();
