import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { PERMISSIONS } from '../utils/permissions.js';

const hasPermission = (user, permission) => {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'director') return true;

  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
};

export const getUsers = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.USERS_MANAGE)) {
    return res.status(403).json({
      message: "Sizda xodimlar ro'yxatini ko'rish huquqi yo'q!"
    });
  }

  try {
    const isRequesterDirector =
      String(req.user.role || '').toLowerCase() === 'director';

    const users = await prisma.user.findMany({
      where: isRequesterDirector
        ? {}
        : {
            NOT: {
              role: {
                in: ['director', 'DIRECTOR']
              }
            }
          },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        phone: true,
        permissions: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('getUsers xatosi:', error);
    res.status(500).json({ message: "Xodimlarni yuklashda xato" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        phone: true,
        permissions: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('getMe xatosi:', error);
    res.status(500).json({ message: "Xato" });
  }
};

export const createUser = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.USERS_MANAGE)) {
    return res.status(403).json({
      message: "Sizda yangi xodim qo'shish huquqi yo'q!"
    });
  }

  try {
    const {
      username,
      password,
      fullName,
      phone,
      role,
      permissions
    } = req.body;

    const normalizedUsername = String(username || '').trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        username: normalizedUsername
      }
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Bu login allaqachon band! Boshqa login o'ylab toping."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: normalizedUsername,
        password: hashedPassword,
        fullName,
        phone,
        role,
        permissions: Array.isArray(permissions) ? permissions.filter(Boolean) : []
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        phone: true,
        permissions: true
      }
    });

    res.json(newUser);
  } catch (error) {
    console.error('createUser xatosi:', error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const tokenUserId = req.user.id;
    const isSelfEdit = tokenUserId === targetUserId;

    if (!isSelfEdit && !hasPermission(req.user, PERMISSIONS.USERS_MANAGE)) {
    return res.status(403).json({
        message: "Sizda bu xodimni tahrirlash huquqi yo'q!"
    });
    }


    const {
      username,
      password,
      currentPassword,
      fullName,
      phone,
      role,
      permissions
    } = req.body;

    if (username) {
      const usernameTaken = await prisma.user.findFirst({
        where: {
          username: String(username).trim().toLowerCase(),
          NOT: { id: targetUserId }
        }
      });

      if (usernameTaken) {
        return res.status(400).json({
          message: "Bu login boshqa xodim tomonidan band qilingan!"
        });
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        username: String(username || '').trim().toLowerCase()
      }
    });

    const isTargetDirector = String(existingUser.role || '').toLowerCase() === 'director';
    const isRequesterDirector = String(req.user.role || '').toLowerCase() === 'director';



    if (!existingUser) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    const updateData = {
  username: username
    ? String(username).trim().toLowerCase()
    : existingUser.username,
  fullName: fullName || existingUser.fullName,
  phone: phone || existingUser.phone,
  role:
    !isSelfEdit && hasPermission(req.user, PERMISSIONS.USERS_MANAGE) && !isTargetDirector
      ? (role || existingUser.role)
      : existingUser.role,

  permissions: {
    set:
      !isSelfEdit && hasPermission(req.user, PERMISSIONS.USERS_MANAGE) && !isTargetDirector
        ? (Array.isArray(permissions)
            ? permissions.filter(Boolean)
            : (existingUser.permissions || []))
        : (existingUser.permissions || [])
  }
};



    if (password) {
      if (tokenUserId === targetUserId) {
        if (!currentPassword) {
          return res.status(400).json({
            message: "Parolni o'zgartirish uchun joriy (eski) parolni kiritishingiz shart!"
          });
        }

        const isMatch = await bcrypt.compare(currentPassword, existingUser.password);

        if (!isMatch) {
          return res.status(400).json({
            message: "Joriy parol noto'g'ri kiritildi!"
          });
        }
      }

      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        phone: true,
        permissions: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('updateUser xatosi:', error);
    res.status(500).json({
      message: "Yangilashda server xatosi yuz berdi"
    });
  }
};

export const deleteUser = async (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.USERS_MANAGE)) {
    return res.status(403).json({
        message: "Sizda xodimlarni o'chirish huquqi yo'q!"
    });
  }


  const targetUserId = Number(req.params.id);

  const targetUser = await prisma.user.findUnique({
  where: { id: targetUserId },
  select: {
    id: true,
    role: true
  }
});

if (!targetUser) {
  return res.status(404).json({
    message: "Foydalanuvchi topilmadi"
  });
}

if (String(targetUser.role || '').toLowerCase() === 'director') {
  return res.status(403).json({
    message: "Direktor akkauntini o'chirish mumkin emas!"
  });
}


  if (req.user.id === targetUserId) {
    return res.status(400).json({
      message: "Xatolik: Siz o'z hisobingizni o'chira olmaysiz!"
    });
  }

  try {
    await prisma.user.delete({
      where: { id: targetUserId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Xodimni o'chirishda xato:", error);
    res.status(500).json({
      message: "O'chirishda xato yuz berdi"
    });
  }
};

export const getUsersSimpleList = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];

    const allowed =
      role === 'director' ||
      permissions.includes(PERMISSIONS.USERS_MANAGE) ||
      permissions.includes(PERMISSIONS.CASHBOX_MANAGE);

    if (!allowed) {
      return res.status(403).json({
        message: "Sizda xodimlar ro'yxatini ko'rish huquqi yo'q!"
      });
    }

    const users = await prisma.user.findMany({
      where:
        role === 'director'
          ? {}
          : {
              NOT: {
                role: {
                  in: ['director', 'DIRECTOR']
                }
              }
            },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        role: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('getUsersSimpleList xatosi:', error);
    res.status(500).json({
      message: "Xodimlarni yuklashda xato"
    });
  }
};