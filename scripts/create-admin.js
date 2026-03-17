import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

async function main() {
  const username = 'admin';
  const plainPassword = '123456';

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.upsert({
    where: {
      username: 'admin'
    },
    update: {
      fullName: 'Admin',
      password: hashedPassword,
      role: 'director',
      phone: '',
      permissions: []
    },
    create: {
      username: 'admin',
      fullName: 'Admin',
      password: hashedPassword,
      role: 'director',
      phone: '',
      permissions: []
    }
  });

  console.log('Admin yaratildi:', {
    id: user.id,
    username: user.username,
    password: plainPassword,
    role: user.role
  });
}

main()
  .catch((e) => {
    console.error('Xatolik:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });