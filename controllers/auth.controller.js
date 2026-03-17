import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const login = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        error: "Login va parol kiritilishi shart!"
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        password: true,
        role: true,
        phone: true,
        permissions: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: "Bunday foydalanuvchi mavjud emas!"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Parol noto'g'ri!"
      });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        permissions: Array.isArray(user.permissions) ? user.permissions : []
      }
    });
  } catch (error) {
    console.error('login xatosi:', error);
    return res.status(500).json({
      error: "Serverda xatolik yuz berdi"
    });
  }
};