import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token topilmadi' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        permissions: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token noto‘g‘ri yoki eskirgan' });
  }
};