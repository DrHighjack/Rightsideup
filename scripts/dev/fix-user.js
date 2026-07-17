const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete the old admin user with the wrong ID
  await prisma.user.deleteMany({
    where: { id: 'cmphhjulg00004r74topy4i0d' }
  });
  console.log('Deleted old admin user');

  // Create admin user with the correct ID from session
  const user = await prisma.user.create({
    data: {
      id: 'cmph6kceq00008w7rmh75kouy',
      email: 'admin@signpost.local',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: '$2a$12$v2RbkM5foKK8vKQ0uqHbfOneCuvnVIuOjjBGJ61jG4wJVyiJUKE2S',
      role: 'ADMIN'
    }
  });
  console.log('Created admin user:', user);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
