const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@signpost.local' },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      emailVerifiedAt: true,
      tags: true,
    },
  });

  console.log(JSON.stringify(user, null, 2));

  if (user) {
    console.log('PASSWORD_OK', await bcrypt.compare('admin123456', user.passwordHash));
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
