import { prisma } from '../lib/prisma.js';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../utils/notifications.js';

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    res.json(notifications);
  } catch (error) {
    console.error('Notificationlarni olishda xatolik:', error);
    res.status(500).json({ error: 'Notificationlarni olishda xatolik yuz berdi' });
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
