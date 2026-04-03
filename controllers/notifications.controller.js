import { prisma } from '../lib/prisma.js';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../utils/notifications.js';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    const where = {
      userId: req.user.id
    };

    const total = await prisma.notification.count({ where });

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    return res.json({
      items: notifications,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Notificationlarni olishda xatolik:', error);

    return res.status(500).json({
      error: error?.message || 'Notificationlarni olishda xatolik yuz berdi'
    });
  }
};

export const readNotification = async (req, res) => {
  try {
    await markNotificationAsRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Notificationni o‘qilgan qilishda xatolik:', error);
    res.status(500).json({ error: 'Notificationni yangilashda xatolik yuz berdi' });
  }
};

export const readAllNotifications = async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Hamma notificationni o‘qilgan qilishda xatolik:', error);
    res.status(500).json({ error: 'Notificationlarni yangilashda xatolik yuz berdi' });
  }
};