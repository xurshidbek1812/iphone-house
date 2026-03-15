const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);

  const existing = await prisma.user.findUnique({
    where: { username: 'testadmin' }
  });

  if (existing) {
    console.log('User already exists');
    return;
  }

  const user = await prisma.user.create({
    data: {
      fullName: 'Test Admin',
      username: 'testadmin',
      password: hashedPassword,
      phone: '+998900000000',
      role: 'director'
    }
  });

  console.log('Created user:', user.username);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());