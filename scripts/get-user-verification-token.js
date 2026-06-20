const { PrismaClient } = require('@prisma/client');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node get-user-verification-token.js <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      emailVerificationToken: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    console.error('User not found');
    process.exit(2);
  }

  console.log(JSON.stringify(user));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
