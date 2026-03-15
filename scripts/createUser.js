import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

async function createUser() {
  try {
    const password = await bcrypt.hash('123456', 10);

    const user = await prisma.user.create({
      data: {
        fullName: 'TEST DIRECTOR',
        username: 'admin',
        password,
        role: 'DIRECTOR',
        phone: '998901234567'
      }
    });

    console.log('User yaratildi:', user);
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
