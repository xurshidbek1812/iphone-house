import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token topilmadi!' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token topilmadi!' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.id) },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        phone: true,
        permissions: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi!' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware xatosi:', error);
    return res.status(403).json({ error: "Ruxsat etilmagan!" });
  }
};